import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_ADMIN } from '../../playwright.config'

// The administration works on the database (migrated: `pnpm db:migrate`).
// Off by default: without E2E_WITH_DB the test server never loads .env, so nothing touches a real database.
const withDb = process.env.E2E_WITH_DB === '1'

const SQUARE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/></svg>'
const NIL = '00000000-0000-4000-8000-000000000000'

function freshAddress(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1
  return `10.${octet()}.${octet()}.${octet()}`
}

async function signInAdmin(page: Page) {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshAddress() })
  const response = await page.request.post('/api/admin/login', { data: { login: E2E_ADMIN.login, password: E2E_ADMIN.password } })
  expect(response.status()).toBe(200)
}

async function signInPlayer(page: Page, country = 'RU') {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshAddress() })
  const username = `adm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const response = await page.request.post('/api/auth/login', { data: { username, country } })
  expect(response.status()).toBe(200)
  return username
}

async function upload(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post(`/api/admin/coloring/arts?name=${name}.svg`, { data: SQUARE, headers: { 'content-type': 'image/svg+xml' } })
  expect(response.status()).toBe(200)
  return (await response.json()).id
}

const galleryIds = async (request: APIRequestContext): Promise<string[]> => {
  const ids: string[] = []
  let cursor: string | null = null
  do {
    const page = await (await request.get(`/api/coloring/arts${cursor ? `?cursor=${cursor}` : ''}`)).json()
    ids.push(...page.items.map((item: { id: string }) => item.id))
    cursor = page.nextCursor
  } while (cursor)
  return ids
}

/** The admin endpoints and how to call them (the id in the paths is a placeholder: the guard answers first). */
const ENDPOINTS: { method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string }[] = [
  { method: 'get', path: '/api/admin/coloring/arts' },
  { method: 'post', path: '/api/admin/coloring/arts' },
  { method: 'get', path: `/api/admin/coloring/arts/${NIL}` },
  { method: 'patch', path: `/api/admin/coloring/arts/${NIL}` },
  { method: 'delete', path: `/api/admin/coloring/arts/${NIL}` },
  { method: 'put', path: `/api/admin/coloring/arts/${NIL}/assignments` },
  { method: 'get', path: '/api/admin/coloring/stats' },
  { method: 'get', path: '/api/admin/coloring/players?query=a' },
  { method: 'get', path: `/api/admin/coloring/players/${NIL}/arts` },
  { method: 'get', path: `/api/admin/coloring/players/${NIL}/arts/${NIL}` },
  { method: 'get', path: '/api/admin/coloring/settings' },
  { method: 'put', path: '/api/admin/coloring/settings' },
]

test.describe('admin API without the right to use it', () => {
  test('every endpoint answers 401 without a session', async ({ request }) => {
    for (const { method, path } of ENDPOINTS) {
      const response = await request[method](path, { data: method === 'get' ? undefined : {} })
      expect(response.status(), `${method} ${path}`).toBe(401)
    }
  })

  test('every endpoint answers 403 to a player', async ({ page }) => {
    test.skip(!withDb, 'Signing a player in needs the database')
    await signInPlayer(page)
    for (const { method, path } of ENDPOINTS) {
      const response = await page.request[method](path, { data: method === 'get' ? undefined : {} })
      expect(response.status(), `${method} ${path}`).toBe(403)
    }
  })
})

test.describe('administration with the database', () => {
  test.skip(!withDb, 'Set E2E_WITH_DB=1 with a migrated DATABASE_URL in .env')

  test('an uploaded art is a draft nobody sees, then published for everyone, then for chosen countries only', async ({ page, browser }) => {
    await signInAdmin(page)
    const id = await upload(page.request, 'drafty')

    const playerContext = await browser.newContext()
    const player = await playerContext.newPage()
    await signInPlayer(player, 'RU')
    expect(await galleryIds(player.request)).not.toContain(id)
    expect((await player.request.get(`/api/coloring/arts/${id}`)).status()).toBe(404)

    expect((await page.request.patch(`/api/admin/coloring/arts/${id}`, { data: { status: 'published' } })).status()).toBe(200)
    expect(await galleryIds(player.request)).toContain(id)

    await page.request.put(`/api/admin/coloring/arts/${id}/assignments`, { data: { countries: ['DE'], players: [] } })
    expect(await galleryIds(player.request)).not.toContain(id)
    await page.request.put(`/api/admin/coloring/arts/${id}/assignments`, { data: { countries: ['RU'], players: [] } })
    expect(await galleryIds(player.request)).toContain(id)
    await page.request.put(`/api/admin/coloring/arts/${id}/assignments`, { data: { countries: [], players: [] } })
    await page.request.patch(`/api/admin/coloring/arts/${id}`, { data: { status: 'hidden' } })
    expect(await galleryIds(player.request)).not.toContain(id)

    await page.request.delete(`/api/admin/coloring/arts/${id}`)
    expect((await page.request.get(`/api/admin/coloring/arts/${id}`)).status()).toBe(404)
    await playerContext.close()
  })

  test('the upload is converted by the server and refuses what is not an SVG', async ({ page }) => {
    await signInAdmin(page)

    const bad = await page.request.post('/api/admin/coloring/arts?name=bad.svg', { data: '<html></html>', headers: { 'content-type': 'image/svg+xml' } })
    expect(bad.status()).toBe(422)
    expect((await bad.json()).data.code).toBe('svg_rejected')
    expect((await page.request.post('/api/admin/coloring/arts?name=empty.svg', { data: '', headers: { 'content-type': 'image/svg+xml' } })).status()).toBe(400)
    expect((await page.request.patch(`/api/admin/coloring/arts/${NIL}`, { data: { status: 'nonsense' } })).status()).toBe(422)
  })

  test('the analytics count what a player does, and the administrator sees it', async ({ page, browser }) => {
    await signInAdmin(page)
    const id = await upload(page.request, 'counted')
    await page.request.patch(`/api/admin/coloring/arts/${id}`, { data: { status: 'published' } })
    const art = await (await page.request.get(`/api/admin/coloring/arts/${id}`)).json()
    const region = (art.art.items as { type: string, id: number, kind: string }[]).find(item => item.type === 'region' && item.kind === 'area')!.id

    const playerContext = await browser.newContext()
    const player = await playerContext.newPage()
    const username = await signInPlayer(player, 'RU')
    await player.request.get(`/api/coloring/arts/${id}/history`)
    await player.request.get(`/api/coloring/arts/${id}/history`)
    const step = [{ type: 'fill', region, color: '#e53935' }]
    const first = await player.request.put(`/api/coloring/arts/${id}/history`, { data: { attempt: 0, rev: 0, keep: 0, steps: [step], cursor: 1, percent: 100 } })
    expect(first.status()).toBe(200)
    // Saving the same finished picture again must not count a second start or completion.
    await player.request.put(`/api/coloring/arts/${id}/history`, { data: { attempt: 1, rev: 1, keep: 1, steps: [step], cursor: 2, percent: 100 } })

    const listed = await (await page.request.get('/api/admin/coloring/arts')).json()
    expect(listed.find((entry: { id: string }) => entry.id === id)).toMatchObject({ opens: 2, starts: 1, completes: 1 })
    const stats = await (await page.request.get('/api/admin/coloring/stats?days=7')).json()
    expect(stats.arts.find((entry: { id: string }) => entry.id === id)).toMatchObject({ opens: 2, starts: 1, completes: 1 })
    expect(stats.daily).toHaveLength(7)

    const found = await (await page.request.get(`/api/admin/coloring/players?query=${username.slice(0, 8)}`)).json()
    const mine = found.find((entry: { username: string }) => entry.username === username)
    expect(mine).toBeTruthy()
    const arts = await (await page.request.get(`/api/admin/coloring/players/${mine.id}/arts`)).json()
    expect(arts.arts.find((entry: { artId: string }) => entry.artId === id).attempts[0]).toMatchObject({ attempt: 1, percent: 100, steps: 2 })
    const view = await (await page.request.get(`/api/admin/coloring/players/${mine.id}/arts/${id}?attempt=1`)).json()
    expect(view.history.steps).toHaveLength(2)
    expect((await page.request.get(`/api/admin/coloring/players/${mine.id}/arts/${NIL}`)).status()).toBe(404)
    await page.request.delete(`/api/admin/coloring/arts/${id}`)
    await playerContext.close()
  })

  test('the tolerance of the administrator reaches the player and is validated', async ({ page, browser }) => {
    await signInAdmin(page)
    const before = (await (await page.request.get('/api/admin/coloring/settings')).json()).paintedTolerance

    expect((await page.request.put('/api/admin/coloring/settings', { data: { paintedTolerance: 0.2 } })).status()).toBe(422)
    expect((await page.request.put('/api/admin/coloring/settings', { data: { paintedTolerance: 1.5 } })).status()).toBe(422)
    expect((await page.request.put('/api/admin/coloring/settings', { data: { paintedTolerance: 0.8 } })).status()).toBe(200)

    const playerContext = await browser.newContext()
    const player = await playerContext.newPage()
    await signInPlayer(player)
    const seen = await player.request.get(`/api/coloring/arts`).then(response => response.json())
    const art = await (await player.request.get(`/api/coloring/arts/${seen.items[0].id}`)).json()
    expect(art.tolerance).toBe(0.8)

    await page.request.put('/api/admin/coloring/settings', { data: { paintedTolerance: before } })
    await playerContext.close()
  })

  test('the administration pages open for the administrator and show the charts', async ({ page }) => {
    await signInAdmin(page)

    await page.goto('/admin/coloring/stats')
    await expect(page.getByRole('heading', { name: 'Раскраска: статистика' })).toBeVisible()
    await expect(page.getByRole('img', { name: /Открытия, начатые и законченные/ })).toBeVisible()
    await expect(page.getByText('Воронка')).toBeVisible()

    await page.goto('/admin/coloring')
    await expect(page.getByRole('heading', { name: 'Раскраска: рисунки' })).toBeVisible()
    await expect(page.getByText('Загрузить SVG')).toBeVisible()

    await page.goto('/admin/coloring/settings')
    await expect(page.getByLabel(/Сколько процентов области/)).toBeVisible()

    await page.goto('/admin/coloring/players')
    await expect(page.getByLabel('Имя игрока')).toBeVisible()
  })

  test('the administrator uploads an SVG in the page, publishes it, and replays what a player drew', async ({ page, browser }) => {
    await signInAdmin(page)
    await page.goto('/admin/coloring')
    await page.locator('input[type=file]').setInputFiles({ name: 'ui-upload.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SQUARE) })

    await expect(page).toHaveURL(/\/admin\/coloring\/art\//)
    await expect(page.getByRole('heading', { name: /Статус: Черновик/ })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Как выглядит рисунок' }).locator('svg')).toBeVisible()
    await page.getByRole('button', { name: 'Опубликовать' }).click()
    await expect(page.getByRole('heading', { name: /Статус: Опубликован/ })).toBeVisible()
    const id = /\/art\/([\w-]+)/.exec(page.url())![1]!

    const art = await (await page.request.get(`/api/admin/coloring/arts/${id}`)).json()
    const region = (art.art.items as { type: string, id: number, kind: string }[]).find(item => item.type === 'region' && item.kind === 'area')!.id
    const playerContext = await browser.newContext()
    const player = await playerContext.newPage()
    const username = await signInPlayer(player, 'RU')
    await player.request.put(`/api/coloring/arts/${id}/history`, { data: { attempt: 0, rev: 0, keep: 0, steps: [[{ type: 'fill', region, color: '#e53935' }]], cursor: 1, percent: 100 } })
    const found = await (await page.request.get(`/api/admin/coloring/players?query=${username}`)).json()

    await page.goto(`/admin/coloring/player-art/${found[0].id}/${id}?attempt=1`)
    await expect(page.getByText('Шаг 1 из 1')).toBeVisible()
    await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      let painted = 0
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) painted++
      return painted
    })).toBeGreaterThan(1000)

    await page.request.delete(`/api/admin/coloring/arts/${id}`)
    await playerContext.close()
  })

  test('a player is sent away from the administration pages', async ({ page }) => {
    await signInPlayer(page)

    await page.goto('/admin/coloring')

    await expect(page).not.toHaveURL(/\/admin\/coloring$/)
  })
})
