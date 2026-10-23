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
  const login = await page.request.post('/api/auth/login', { data: { username: `e2h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${suffix}`, country: 'RU' } })

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
    expect((await request.get(`/api/coloring/arts/${id}/thumbnail`)).status()).toBe(401)
    expect((await request.put(`/api/coloring/arts/${id}/thumbnail`, { data: 'x' })).status()).toBe(401)
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

    await page.locator('.editor__actions').getByRole('button', { name: 'Начать заново' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Начать заново' }).click()

    // The buttons are disabled while the picture is rebuilt, so wait for the canvas itself.
    await expect.poll(() => paintedPixels(page), { timeout: 30_000 }).toBe(0)
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled()
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
    const foreignArt = `/api/coloring/arts/${(await imported.json()).id}`
    const foreign = `${foreignArt}/history`
    // The owner saves first, which puts the regions of that art into the server's memory: the other player
    // must be refused all the same (the check of who may see the art comes before it).
    const regions = (await (await otherPage.request.get(foreignArt)).json()).art.items.filter((item: { type: string }) => item.type === 'region')

    expect((await otherPage.request.put(foreign, { data: { attempt: 0, rev: 0, keep: 0, steps: [[{ type: 'fill', region: regions[0].id, color: '#e53935' }]], cursor: 1, percent: 0 } })).status()).toBe(200)

    expect((await page.request.get(foreign)).status()).toBe(404)
    expect((await page.request.put(foreign, { data: { attempt: 0, rev: 0, keep: 0, steps: [step], cursor: 1, percent: 0 } })).status()).toBe(404)
    // The other writing routes are closed to this player as well.
    expect((await page.request.put(`${foreignArt}/thumbnail`, { data: Buffer.from('RIFF'), headers: { 'content-type': 'image/webp' } })).status()).toBe(404)
    expect((await page.request.post(`${foreignArt}/restart`)).status()).toBe(404)
    expect((await page.request.delete(foreignArt)).status()).toBe(404)
    await other.close()
  })

  test('undo and redo give back exactly the pixels of every step: strokes of each tool and a long-press fill', async ({ page }) => {
    await signIn(page, 'q')
    await openOctopus(page)
    const keep = (index: number) => page.locator('canvas').evaluate((canvas: HTMLCanvasElement, at) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      const store = ((window as unknown as { states?: Uint8ClampedArray[] }).states ??= [])

      store[at] = new Uint8ClampedArray(data)
    }, index)
    const sameAsKept = (index: number) => page.locator('canvas').evaluate((canvas: HTMLCanvasElement, at) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      const kept = (window as unknown as { states: Uint8ClampedArray[] }).states[at]!

      for (let i = 0; i < data.length; i++) if (data[i] !== kept[i]) return false

      return true
    }, index)

    await keep(0)
    await scribble(page)
    await keep(1)
    await page.getByRole('button', { name: 'Карандаш' }).click()
    await scribble(page, 0.08)
    await keep(2)
    await page.getByRole('button', { name: /^Прозрачность краски/ }).click()
    await page.getByRole('button', { name: 'Кисть' }).click()
    const box = (await page.locator('canvas').boundingBox())!

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeEnabled()
    await keep(3)

    for (const target of [2, 1, 0]) {
      await page.getByRole('button', { name: 'Отменить' }).click()
      expect(await sameAsKept(target)).toBe(true)
    }

    for (const target of [1, 2, 3]) {
      await page.getByRole('button', { name: 'Вернуть' }).click()
      expect(await sameAsKept(target)).toBe(true)
    }
  })

  test('the picture and its progress agree after an undo: the percent follows the canvas', async ({ page }) => {
    await signIn(page, 'r')
    await openOctopus(page)
    await expect(page.locator('.frame__percent')).toContainText('Закрашено 0%')
    const box = (await page.locator('canvas').boundingBox())!

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()
    await expect(page.locator('.frame__percent')).not.toContainText('Закрашено 0%')

    await page.getByRole('button', { name: 'Отменить' }).click()
    await expect(page.locator('.frame__percent')).toContainText('Закрашено 0%')
    await page.getByRole('button', { name: 'Вернуть' }).click()
    await expect(page.locator('.frame__percent')).not.toContainText('Закрашено 0%')
  })

  test('a history of 1000 steps opens, and undo and redo stay within the frame budget', async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page, 'p')
    await openOctopus(page)
    const id = artIdOf(page)
    const url = `/api/coloring/arts/${id}/history`
    const art = await (await page.request.get(`/api/coloring/arts/${id}`)).json()
    const regions = (art.art.items as { type: string, id: number, kind: string }[]).filter(item => item.type === 'region' && item.kind === 'area').map(item => item.id)
    const stroke = (region: number, n: number) => [{
      type: 'stroke',
      region,
      tool: 'brush',
      color: '#43a047',
      width: 120,
      points: Array.from({ length: 40 }, (_, i) => [600 + ((n * 37 + i * 29) % 2400), 600 + ((n * 53 + i * 41) % 2400)]).flat(),
    }]

    // Built through the API: 10 saves of 100 steps each.
    let rev = 0

    for (let batch = 0; batch < 10; batch++) {
      const steps = Array.from({ length: 100 }, (_, i) => stroke(regions[(batch * 100 + i) % regions.length]!, batch * 100 + i))
      const response = await page.request.put(url, { data: { attempt: batch === 0 ? 0 : 1, rev, keep: batch * 100, steps, cursor: batch * 100 + 100, percent: 50 } })

      expect(response.status()).toBe(200)
      rev = (await response.json()).rev
    }

    const opened = Date.now()

    await page.reload()
    await expect(page.locator('.save-status')).toBeVisible({ timeout: 60_000 })
    const openMs = Date.now() - opened

    expect(await paintedPixels(page)).toBeGreaterThan(1000)

    // The click handler does the whole undo synchronously: restore a snapshot, replay a few steps.
    const clicks = (count: number) => page.evaluate((times) => {
      const click = (label: string) => {
        const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
        const started = performance.now()

        button.click()

        return performance.now() - started
      }

      return { undo: Array.from({ length: times }, () => click('Отменить')), redo: Array.from({ length: times }, () => click('Вернуть')) }
    }, count)
    const mean = (timings: { undo: number[], redo: number[] }) => [...timings.undo, ...timings.redo].reduce((sum, value) => sum + value, 0) / (timings.undo.length * 2)
    const worstOf = (timings: { undo: number[], redo: number[] }) => Math.max(...timings.undo, ...timings.redo)

    const loaded = await clicks(100)

    // Steps drawn in this session also carry their own pixels: undo is a swap, not a replay.
    const box = (await page.locator('canvas').boundingBox())!

    for (let i = 0; i < 30; i++) {
      await page.mouse.move(box.x + box.width * (0.3 + (i % 7) * 0.05), box.y + box.height * (0.25 + (i % 5) * 0.04))
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * (0.35 + (i % 6) * 0.05), box.y + box.height * (0.3 + (i % 4) * 0.04), { steps: 4 })
      await page.mouse.up()
    }
    const live = await clicks(30)

    test.info().annotations.push({
      type: 'perf',
      description: `open ${openMs} ms; loaded steps: undo/redo average ${mean(loaded).toFixed(1)} ms, worst ${worstOf(loaded).toFixed(1)} ms; live steps: average ${mean(live).toFixed(1)} ms, worst ${worstOf(live).toFixed(1)} ms`,
    })
    // The budget is 16 ms on a mid-range phone with a GPU; this runs in software-rendered Chromium on a CI
    // machine, so only a gross regression fails here. The numbers are in the report annotations.
    expect(mean(loaded)).toBeLessThan(120)
    expect(mean(live)).toBeLessThan(40)
  })

  test('a painted thumbnail appears on the gallery card, and goes when the art is deleted', async ({ page }) => {
    test.setTimeout(150_000)
    await signIn(page, 's')
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/></svg>'
    const imported = await page.request.post('/api/coloring/imports?name=thumb.svg', { data: svg, headers: { 'content-type': 'image/svg+xml' } })
    const id = (await imported.json()).id

    await page.goto('/coloring')
    await page.getByRole('link', { name: 'thumb' }).click()
    await expect(page.locator('.save-status')).toBeVisible()
    const box = (await page.locator('canvas').boundingBox())!

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 6 })
    await page.mouse.up()
    await saved(page)

    // The editor sends the picture a few seconds after the save; leaving the editor sends it at once.
    await page.getByRole('link', { name: 'К галерее' }).click()
    await page.waitForURL(/\/coloring$/, { timeout: 15_000 })
    // On a slow machine the picture can arrive after the gallery was read: the next visit shows it.
    await expect(async () => {
      await page.reload()
      await expect(page.getByRole('link', { name: /^thumb/ }).locator('img')).toHaveAttribute('src', /\/thumbnail\?v=\d+/, { timeout: 10_000 })
    }).toPass({ timeout: 90_000 })
    const image = await page.request.get(`/api/coloring/arts/${id}/thumbnail`)

    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toMatch(/^image\/(webp|png)$/)
    expect((await image.body()).length).toBeGreaterThan(100)

    expect((await page.request.put(`/api/coloring/arts/${id}/thumbnail`, { data: '<svg onload="alert(1)"/>' })).status()).toBe(422)
    expect((await page.request.delete(`/api/coloring/arts/${id}`)).status()).toBe(200)
    expect((await page.request.get(`/api/coloring/arts/${id}/thumbnail`)).status()).toBe(404)
  })

  test('a picture that was already finished opens without the victory animation', async ({ page }) => {
    await signIn(page, 'v')
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#fff"/></svg>'
    const imported = await page.request.post('/api/coloring/imports?name=done.svg', { data: svg, headers: { 'content-type': 'image/svg+xml' } })
    const id = (await imported.json()).id
    const art = await (await page.request.get(`/api/coloring/arts/${id}`)).json()
    const areas = (art.art.items as { type: string, id: number, kind: string }[]).filter(item => item.type === 'region' && item.kind === 'area')
    const fills = areas.map(area => [{ type: 'fill', region: area.id, color: '#e53935' }])
    const saved = await page.request.put(`/api/coloring/arts/${id}/history`, { data: { attempt: 0, rev: 0, keep: 0, steps: fills, cursor: fills.length, percent: 100 } })

    expect(saved.status()).toBe(200)

    await page.goto(`/coloring/art/${id}`)
    await expect(page.locator('.save-status')).toBeVisible()

    await expect(page.locator('.frame__percent')).toContainText('Закрашено 100%')
    // Neither the shaking frame nor the congratulation card, now or a moment later.
    await page.waitForTimeout(800)
    await expect(page.locator('.frame--celebrating')).toHaveCount(0)
    await expect(page.locator('.congrats__card')).toHaveCount(0)

    // Finishing it again after an undo is news again.
    await page.getByRole('button', { name: 'Отменить' }).click()
    await page.getByRole('button', { name: 'Вернуть' }).click()
    await expect(page.locator('.congrats__card')).toBeVisible()
  })
})
