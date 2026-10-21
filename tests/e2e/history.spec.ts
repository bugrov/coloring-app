import { expect, test, type Page } from '@playwright/test'

// The history is saved to the database (migrated and seeded: `pnpm db:migrate && pnpm db:seed`).
// Off by default: without E2E_WITH_DB the test server never loads .env, so nothing touches a real database.
const withDb = process.env.E2E_WITH_DB === '1'

function freshAddress(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1
  return `10.${octet()}.${octet()}.${octet()}`
}

async function signIn(page: Page, suffix: string) {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshAddress() })
  const login = await page.request.post('/api/auth/login', { data: { username: `e2h${Date.now().toString(36)}${suffix}`, country: 'RU' } })
  expect(login.status()).toBe(200)
}

async function openOctopus(page: Page) {
  await page.goto('/coloring')
  await page.getByRole('link', { name: 'Осьминог' }).click()
  await expect(page.locator('.save-status')).toBeVisible()
}

const artIdOf = (page: Page) => /\/art\/([\w-]+)/.exec(page.url())![1]!

/** Drags across the art's head, which is one region in the built-in octopus. */
async function scribble(page: Page, offset = 0) {
  const box = (await page.locator('canvas').boundingBox())!
  const x = box.x + box.width * 0.5
  const y = box.y + box.height * (0.3 + offset)
  await page.mouse.move(x - 40, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 10, { steps: 6 })
  await page.mouse.move(x + 40, y, { steps: 6 })
  await page.mouse.up()
}

const saved = (page: Page) => expect(page.locator('.save-status')).toContainText('Сохранено', { timeout: 15_000 })

/** How many pixels of the paint canvas are not transparent. */
const paintedPixels = (page: Page) => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  let count = 0
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count++
  return count
})

test.describe('history without a session', () => {
  test('both history requests answer 401', async ({ request }) => {
    const id = '00000000-0000-4000-8000-000000000000'
    expect((await request.get(`/api/coloring/arts/${id}/history`)).status()).toBe(401)
    expect((await request.put(`/api/coloring/arts/${id}/history`, { data: {} })).status()).toBe(401)
  })
})

test.describe('history with the database', () => {
  test.skip(!withDb, 'Set E2E_WITH_DB=1 with a migrated and seeded DATABASE_URL in .env')

  test('the picture and the undo history come back after a reload', async ({ page }) => {
    await signIn(page, 'a')
    await openOctopus(page)
    await scribble(page)
    await scribble(page, 0.1)
    await saved(page)
    const before = await paintedPixels(page)
    expect(before).toBeGreaterThan(1000)

    await page.reload()
    await expect(page.locator('.save-status')).toBeVisible()

    expect(await paintedPixels(page)).toBe(before)
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeEnabled()
    await page.getByRole('button', { name: 'Отменить' }).click()
    await page.getByRole('button', { name: 'Отменить' }).click()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled()
    expect(await paintedPixels(page)).toBe(0)
    await page.getByRole('button', { name: 'Вернуть' }).click()
    await page.getByRole('button', { name: 'Вернуть' }).click()
    expect(await paintedPixels(page)).toBe(before)
  })

  test('the undo position is saved too: an undone step stays undone after a reload and can be redone', async ({ page }) => {
    await signIn(page, 'b')
    await openOctopus(page)
    await scribble(page)
    await page.getByRole('button', { name: 'Отменить' }).click()
    await saved(page)

    await page.reload()
    await expect(page.locator('.save-status')).toBeVisible()

    expect(await paintedPixels(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'Вернуть' })).toBeEnabled()
  })

  test('work done offline is kept, shown as not saved, and saved when the connection is back', async ({ page, context }) => {
    await signIn(page, 'c')
    await openOctopus(page)
    await saved(page)

    await context.setOffline(true)
    await scribble(page)
    await expect(page.locator('.save-status')).toContainText('Нет связи', { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeEnabled()

    await context.setOffline(false)
    await saved(page)
    await page.reload()
    await expect(page.locator('.save-status')).toBeVisible()
    expect(await paintedPixels(page)).toBeGreaterThan(1000)
  })

  test('steps not yet sent survive closing the tab: they wait in the browser and are saved on the next visit', async ({ page }) => {
    await signIn(page, 'd')
    await openOctopus(page)
    await saved(page)
    // Nothing can reach the server, so the work stays unsent; the outbox keeps it.
    await page.context().setOffline(true)
    await scribble(page)
    await page.waitForTimeout(800)

    await page.context().setOffline(false)
    await page.reload()
    await expect(page.locator('.save-status')).toBeVisible()

    expect(await paintedPixels(page)).toBeGreaterThan(1000)
    await saved(page)
    const history = await page.request.get(`/api/coloring/arts/${artIdOf(page)}/history`)
    expect((await history.json()).steps).toHaveLength(1)
  })

  test('two windows on one picture: the later save is put on top of the earlier one, nothing is lost', async ({ page, context }) => {
    await signIn(page, 'e')
    await openOctopus(page)
    await saved(page)
    const second = await context.newPage()
    await second.goto(page.url())
    await expect(second.locator('.save-status')).toBeVisible()

    await scribble(page)
    await saved(page)
    await scribble(second, 0.1)

    await expect(second.getByRole('alert')).toContainText('Рисунок изменили на другом устройстве', { timeout: 15_000 })
    await saved(second)
    const history = await page.request.get(`/api/coloring/arts/${artIdOf(page)}/history`)
    expect((await history.json()).steps).toHaveLength(2)
    // The second window now shows both strokes.
    expect(await paintedPixels(second)).toBeGreaterThan(await paintedPixels(page))
  })

  test('starting over saves what is unsent, clears the picture and gives an empty history', async ({ page }) => {
    await signIn(page, 'f')
    await openOctopus(page)
    await scribble(page)

    await page.getByRole('button', { name: 'Начать заново', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Начать заново' }).click()

    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled()
    expect(await paintedPixels(page)).toBe(0)
    const history = await (await page.request.get(`/api/coloring/arts/${artIdOf(page)}/history`)).json()
    expect(history).toMatchObject({ attempt: 2, steps: [] })
    await page.reload()
    await expect(page.locator('.save-status')).toBeVisible()
    expect(await paintedPixels(page)).toBe(0)
  })

  test('the history API rejects a wrong body, a stale revision and someone else\'s art', async ({ page, browser }) => {
    await signIn(page, 'g')
    await openOctopus(page)
    const id = artIdOf(page)
    const url = `/api/coloring/arts/${id}/history`
    const step = [{ type: 'fill', region: 1, color: '#e53935' }]

    expect((await page.request.put(url, { data: { attempt: 0 } })).status()).toBe(422)
    expect((await page.request.put(url, { data: { attempt: 0, rev: 0, keep: 0, steps: [step], cursor: 5, percent: 0 } })).status()).toBe(422)
    expect((await page.request.put(url, { data: { attempt: 0, rev: 0, keep: 0, steps: [[{ type: 'fill', region: 99999, color: '#e53935' }]], cursor: 1, percent: 0 } })).status()).toBe(422)
    const ok = await page.request.put(url, { data: { attempt: 0, rev: 0, keep: 0, steps: [step], cursor: 1, percent: 0 } })
    expect(ok.status()).toBe(200)
    const stale = await page.request.put(url, { data: { attempt: 1, rev: 0, keep: 1, steps: [step], cursor: 2, percent: 0 } })
    expect(stale.status()).toBe(409)
    expect((await stale.json()).data.code).toBe('history_conflict')

    // Someone else's own import is not visible to this player: 404 for both requests.
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    await signIn(otherPage, 'h')
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/></svg>'
    const imported = await otherPage.request.post('/api/coloring/imports?name=mine.svg', { data: svg, headers: { 'content-type': 'image/svg+xml' } })
    expect(imported.status()).toBe(200)
    const foreign = `/api/coloring/arts/${(await imported.json()).id}/history`
    expect((await page.request.get(foreign)).status()).toBe(404)
    expect((await page.request.put(foreign, { data: { attempt: 0, rev: 0, keep: 0, steps: [step], cursor: 1, percent: 0 } })).status()).toBe(404)
    await other.close()
  })
})
