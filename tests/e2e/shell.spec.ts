import { expect, test } from '@playwright/test'

test.describe('app shell', () => {
  test('behaves like a game, not a web page', async ({ page }) => {
    await page.goto('/')

    const shell = await page.evaluate(() => {
      const body = getComputedStyle(document.body)
      const root = document.documentElement

      return {
        userSelect: body.userSelect || body.webkitUserSelect,
        // No pinch-zoom or double-tap zoom of the page.
        touchAction: getComputedStyle(root).touchAction,
        // Engines without overscroll-behavior support report an empty value.
        overscroll: CSS.supports('overscroll-behavior', 'none') ? body.getPropertyValue('overscroll-behavior-y') : 'none',
        scrollable: root.scrollHeight > root.clientHeight || root.scrollWidth > root.clientWidth,
      }
    })

    expect(shell).toEqual({ userSelect: 'none', touchAction: 'pan-x pan-y', overscroll: 'none', scrollable: false })
  })
})
