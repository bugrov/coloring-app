import { expect, test, type Page } from '@playwright/test'

/** Pixel position at a share of the paint canvas. */
async function at(page: Page, rx: number, ry: number): Promise<[number, number]> {
  const box = (await page.locator('.coloring-stage canvas').boundingBox())!

  return [box.x + box.width * rx, box.y + box.height * ry]
}

async function paintedPixels(page: Page): Promise<number> {
  return page.locator('.coloring-stage canvas').evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
    let count = 0

    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count++

    return count
  })
}

test.describe('drawing engine (sandbox)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/coloring/sandbox')
    await expect(page.locator('.coloring-stage canvas')).toBeVisible()
  })

  test('a stroke records one op and paints inside the region only', async ({ page }) => {
    const [x, y] = await at(page, 0.3, 0.35)

    await page.mouse.move(x, y)
    await page.mouse.down()

    for (let i = 1; i <= 15; i++) await page.mouse.move(x + i * 20, y)
    await page.mouse.up()

    await expect(page.getByText('операций: 1')).toBeVisible()
    expect(await paintedPixels(page)).toBeGreaterThan(0)
  })

  test('holding still fills the region and the eraser hold clears it', async ({ page }) => {
    const [x, y] = await at(page, 0.5, 0.4)
    const hold = async () => {
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.waitForTimeout(700)
      await page.mouse.up()
    }

    await hold()
    await expect(page.getByText(/^[1-9]\d*%/)).toBeVisible()
    const filled = await paintedPixels(page)

    await page.getByRole('button', { name: 'Резинка', exact: true }).click()
    await hold()

    await expect(page.getByText('операций: 2')).toBeVisible()
    expect(await paintedPixels(page)).toBeLessThan(filled / 10)
  })

  test('an action that changes nothing is not recorded', async ({ page }) => {
    const [x, y] = await at(page, 0.5, 0.4)
    const hold = async () => {
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.waitForTimeout(700)
      await page.mouse.up()
    }
    const stroke = async () => {
      await page.mouse.move(x - 20, y)
      await page.mouse.down()

      for (let i = 1; i <= 10; i++) await page.mouse.move(x - 20 + i * 4, y)
      await page.mouse.up()
    }

    // The eraser on a clear region: nothing to erase.
    await page.getByRole('button', { name: 'Резинка', exact: true }).click()
    await hold()
    await stroke()
    await expect(page.getByText('операций: 0')).toBeVisible()

    // The same colour over a region already filled with it.
    // (The brush: a pencil's grain makes every pass over the same colour look a little different.)
    await page.getByRole('button', { name: 'Кисть', exact: true }).click()
    await hold()
    await expect(page.getByText('операций: 1')).toBeVisible()
    await hold()
    await stroke()
    await expect(page.getByText('операций: 1')).toBeVisible()
  })

  test('pressing the empty band around the art does nothing', async ({ page }) => {
    const stage = (await page.locator('.coloring-stage').boundingBox())!
    const canvas = (await page.locator('.coloring-stage canvas').boundingBox())!

    test.skip(canvas.x - stage.x < 10, 'No empty band at this aspect ratio')

    await page.mouse.move(stage.x + 4, stage.y + stage.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()

    await expect(page.getByText('операций: 0')).toBeVisible()
    expect(await paintedPixels(page)).toBe(0)
  })

  test('a finger stroke is kept (touch capture moves to the stage)', async ({ page, browserName, hasTouch }) => {
    test.skip(browserName !== 'chromium' || !hasTouch, 'Real touch input is sent through the Chromium DevTools protocol')
    const [x, y] = await at(page, 0.3, 0.35)
    const client = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number) => client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }],
    })

    await touch('touchStart', x)

    for (let i = 1; i <= 10; i++) await touch('touchMove', x + i * 15)
    await touch('touchEnd', x)

    await expect(page.getByText('операций: 1')).toBeVisible()
    expect(await paintedPixels(page)).toBeGreaterThan(0)
  })

  test('replaying the ops rebuilds the picture', async ({ page }) => {
    const [x, y] = await at(page, 0.5, 0.4)

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()
    const before = await paintedPixels(page)

    await page.getByRole('button', { name: 'Перерисовать из операций' }).click()

    expect(await paintedPixels(page)).toBe(before)
  })
})
