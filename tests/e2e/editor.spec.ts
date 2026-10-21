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
  // The save status shows once the saved history is on the canvas; before that drawing is locked.
  await expect(page.locator('.save-status')).toBeVisible()
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

    await expect(page.getByRole('button', { name: 'Кисть' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Карандаш' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Резинка' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'К галерее' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить или поделиться картинкой' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled()
    await expect(page.locator('.frame__percent')).toContainText('Закрашено 0%')
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

  test('the thickness button steps through medium, thick and thin', async ({ page }) => {
    await openOctopus(page, 'i')
    await expect(page.getByRole('button', { name: 'Толщина линии: средняя, изменить' })).toBeVisible()

    for (const next of ['толстая', 'тонкая', 'средняя']) {
      await page.getByRole('button', { name: /^Толщина линии/ }).click()
      await expect(page.getByRole('button', { name: `Толщина линии: ${next}, изменить` })).toBeVisible()
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
    await expect(page.locator('.frame__percent')).not.toContainText('Закрашено 0%')
  })

  test('the palette works from the keyboard: focus moves in, Escape closes it and focus comes back', async ({ page }) => {
    await openOctopus(page, 'f')

    await page.getByRole('button', { name: 'Красный, открыть все цвета' }).focus()
    await page.keyboard.press('Enter')
    const palette = page.getByRole('group', { name: 'Все цвета' })
    await expect(palette).toBeVisible()
    await expect(palette.getByRole('button', { name: 'Красный', exact: true })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()
    await expect(page.getByRole('button', { name: 'Красный, открыть все цвета' })).toBeFocused()
  })

  test('a tap on the canvas while the palette is open only closes it', async ({ page }) => {
    await openOctopus(page, 'g')

    await page.getByRole('button', { name: 'Красный, открыть все цвета' }).click()
    await expect(page.getByRole('group', { name: 'Все цвета' })).toBeVisible()
    await scribble(page)

    await expect(page.getByRole('group', { name: 'Все цвета' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled()
  })

  test('a 50% brush stroke looks the same after undo and redo rebuild it', async ({ page }) => {
    await openOctopus(page, 'h')
    await page.getByRole('button', { name: /^Прозрачность краски/ }).click()
    await page.getByRole('button', { name: /^Прозрачность краски/ }).click()
    await expect(page.getByRole('button', { name: 'Прозрачность краски 50%, изменить' })).toBeVisible()

    // A long wiggling stroke: many frames, so the live path accumulates over many chunks.
    const box = (await page.locator('canvas').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.2)
    await page.mouse.down()
    for (let i = 0; i < 60; i++) {
      await page.mouse.move(box.x + box.width * (0.4 + 0.2 * Math.abs(Math.sin(i / 7))), box.y + box.height * (0.2 + i * 0.005), { steps: 2 })
    }
    await page.mouse.up()

    // Compared inside the page: the paint canvas is millions of pixels.
    await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      Object.assign(window, { liveAlpha: data.filter((_, i) => i % 4 === 3) })
    })
    await page.getByRole('button', { name: 'Отменить' }).click()
    await page.getByRole('button', { name: 'Вернуть' }).click()
    const { differing, worst, painted } = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      const live = (window as unknown as { liveAlpha: Uint8ClampedArray }).liveAlpha
      let differing = 0
      let worst = 0
      for (let i = 0; i < live.length; i++) {
        const diff = Math.abs(live[i]! - data[i * 4 + 3]!)
        if (diff > 0) differing++
        worst = Math.max(worst, diff)
      }
      return { differing, worst, painted: live.filter(alpha => alpha > 0).length }
    })
    // Edge pixels may differ slightly (anti-aliasing); a doubled mask edge would differ a lot.
    test.info().annotations.push({ type: 'diff', description: `live vs replay: ${differing} pixels differ, worst alpha difference ${worst}` })
    expect(painted).toBeGreaterThan(1000)
    expect(worst).toBeLessThan(40)
  })
})
