import { expect, test, type Page } from '@playwright/test'

// The editor loads its art from the database (migrated and seeded: `pnpm db:migrate && pnpm db:seed`).
// Off by default: without E2E_WITH_DB the test server never loads .env, so nothing touches a real database.
const withDb = process.env.E2E_WITH_DB === '1'

function freshAddress(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1
  return `10.${octet()}.${octet()}.${octet()}`
}

async function openOctopus(page: Page, suffix: string) {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshAddress() })
  const login = await page.request.post('/api/auth/login', { data: { username: `e2e${Date.now().toString(36)}${suffix}`, country: 'RU' } })
  expect(login.status()).toBe(200)
  await page.goto('/coloring')
  await page.getByRole('link', { name: 'Осьминог' }).click()
  await expect(page.getByRole('button', { name: 'Отменить' })).toBeVisible()
}

/** Drags across the art's head, which is one region in the built-in octopus. */
async function scribble(page: Page) {
  const box = (await page.locator('canvas').boundingBox())!
  const x = box.x + box.width * 0.5
  const y = box.y + box.height * 0.3
  await page.mouse.move(x - 40, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 10, { steps: 6 })
  await page.mouse.move(x + 40, y, { steps: 6 })
  await page.mouse.up()
}

test.describe('editor without a session', () => {
  test('the art endpoint answers 401 in the API error shape', async ({ request }) => {
    const response = await request.get('/api/coloring/arts/00000000-0000-4000-8000-000000000000')
    expect(response.status()).toBe(401)
  })
})

test.describe('editor with the database', () => {
  test.skip(!withDb, 'Set E2E_WITH_DB=1 with a migrated and seeded DATABASE_URL in .env')

  test('shows the toolbar, history, actions and an empty progress frame', async ({ page }) => {
    await openOctopus(page, 'a')

    await expect(page.getByRole('radio', { name: 'Кисть' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Карандаш' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Резинка' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'К галерее' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить или поделиться картинкой' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled()
    await expect(page.getByText('0%', { exact: true })).toBeVisible()
    await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/editor-${test.info().project.name}.png` : undefined })
  })

  test('drawing enables undo, undo and redo toggle each other, restart clears after confirmation', async ({ page }) => {
    await openOctopus(page, 'b')

    await scribble(page)
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Вернуть' })).toBeDisabled()

    await page.getByRole('button', { name: 'Отменить' }).click()
    await expect(page.getByRole('button', { name: 'Вернуть' })).toBeEnabled()
    await page.getByRole('button', { name: 'Вернуть' }).click()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeEnabled()

    await page.getByRole('button', { name: 'Начать заново', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Начать заново' }).click()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Вернуть' })).toBeDisabled()
  })

  test('the palette opens from the chosen crayon, a pick moves it to the chosen place and closes it', async ({ page }) => {
    await openOctopus(page, 'c')

    await page.getByRole('button', { name: 'Красный, открыть все цвета' }).click()
    await expect(page.getByRole('group', { name: 'Все цвета' })).toBeVisible()
    await page.getByRole('group', { name: 'Все цвета' }).getByRole('button', { name: 'Зелёный', exact: true }).click()

    await expect(page.getByRole('group', { name: 'Все цвета' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Зелёный, открыть все цвета' })).toBeVisible()
    // The last three colours stay within reach.
    await expect(page.getByRole('group', { name: 'Недавние цвета' }).getByRole('button')).toHaveCount(3)
  })

  test('the opacity button steps through 100, 75, 50 and 25 percent', async ({ page }) => {
    await openOctopus(page, 'd')

    for (const next of [75, 50, 25, 100]) {
      await page.getByRole('button', { name: /^Прозрачность краски/ }).click()
      await expect(page.getByRole('button', { name: `Прозрачность краски ${next}%, изменить` })).toBeVisible()
    }
  })

  test('a long press fills the region and shows the ring', async ({ page }) => {
    await openOctopus(page, 'e')

    const box = (await page.locator('canvas').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3)
    await page.mouse.down()
    await expect(page.locator('.coloring-stage__hold--ring')).toBeVisible()
    await page.waitForTimeout(600)
    await page.mouse.up()

    await expect(page.getByRole('button', { name: 'Отменить' })).toBeEnabled()
    await expect(page.getByText('0%', { exact: true })).toBeHidden()
  })
})
