import { expect, test, type Page } from '@playwright/test'

// The gallery needs the database (migrated and seeded: `pnpm db:migrate && pnpm db:seed`).
// Off by default: without E2E_WITH_DB the test server never loads .env, so nothing touches a real database.
const withDb = process.env.E2E_WITH_DB === '1'

const SOME_ID = '00000000-0000-4000-8000-000000000000'

function freshAddress(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1
  return `10.${octet()}.${octet()}.${octet()}`
}

async function ownAddress(page: Page) {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshAddress() })
}

async function signInAs(page: Page, name: string) {
  const response = await page.request.post('/api/auth/login', { data: { username: name, country: 'RU' } })
  expect(response.status()).toBe(200)
}

test.describe('gallery API without a session', () => {
  test('every route answers 401 in the API error shape', async ({ request }) => {
    const calls = [
      request.get('/api/coloring/arts'),
      request.get(`/api/coloring/arts/${SOME_ID}/preview.svg`),
      request.post(`/api/coloring/arts/${SOME_ID}/restart`),
      request.delete(`/api/coloring/arts/${SOME_ID}`),
      request.post('/api/coloring/imports', { data: '<svg/>', headers: { 'Content-Type': 'image/svg+xml' } }),
    ]

    for (const response of await Promise.all(calls)) {
      expect(response.status()).toBe(401)
      expect((await response.json()).data.code).toBe('unauthorized')
    }
  })
})

test.describe('gallery with the database', () => {
  test.skip(!withDb, 'Set E2E_WITH_DB=1 with a migrated and seeded DATABASE_URL in .env')

  test('shows the add card and the three built-in arts, and imports and deletes a drawing', async ({ page }) => {
    await ownAddress(page)
    await signInAs(page, `e2e${Date.now().toString(36)}g`)
    await page.goto('/coloring')

    await expect(page.getByRole('button', { name: 'Импортировать свой SVG-рисунок' })).toBeVisible()
    for (const title of ['Осьминог', 'Кот', 'Дом']) await expect(page.getByRole('link', { name: title })).toBeVisible()

    await page.locator('input[type=file]').setInputFiles('tests/fixtures/svg/figma-shapes.svg')
    const imported = page.getByRole('link', { name: 'figma-shapes' })
    await expect(imported).toBeVisible()

    await page.reload()
    await expect(imported).toBeVisible()

    await page.getByRole('button', { name: 'Действия с рисунком' }).click()
    await page.getByRole('button', { name: 'Удалить', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
    await expect(imported).toBeHidden()
  })

  test('refuses a file that is not an SVG with a clear message', async ({ page }) => {
    await ownAddress(page)
    await signInAs(page, `e2e${Date.now().toString(36)}h`)
    await page.goto('/coloring')

    await page.locator('input[type=file]').setInputFiles({ name: 'note.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('not an svg') })

    await expect(page.getByRole('alert')).toContainText('Файл повреждён или это не SVG')
  })

  test('another player can neither see nor delete someone else\'s import', async ({ page, browser }) => {
    await ownAddress(page)
    await signInAs(page, `e2e${Date.now().toString(36)}i`)
    const file = await (await import('node:fs/promises')).readFile('tests/fixtures/svg/figma-shapes.svg')
    const created = await page.request.post('/api/coloring/imports?name=private', { data: file, headers: { 'Content-Type': 'image/svg+xml' } })
    expect(created.status()).toBe(200)
    const { id } = await created.json()

    const stranger = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': freshAddress() } })
    const other = await stranger.newPage()
    await signInAs(other, `e2e${Date.now().toString(36)}j`)

    expect((await other.request.get(`/api/coloring/arts/${id}/preview.svg`)).status()).toBe(404)
    expect((await other.request.delete(`/api/coloring/arts/${id}`)).status()).toBe(404)
    expect((await other.request.post(`/api/coloring/arts/${id}/restart`)).status()).toBe(404)
    expect((await page.request.get(`/api/coloring/arts/${id}/preview.svg`)).headers()['content-type']).toContain('image/svg+xml')
    await stranger.close()
  })
})
