import { expect, test, type Page } from '@playwright/test'
import { E2E_ADMIN } from '../../playwright.config'

// Needs DATABASE_URL (a migrated Neon branch) in .env; off by default so a
// run never touches a real database unasked: E2E_WITH_DB=1 pnpm test:e2e
const withDb = process.env.E2E_WITH_DB === '1'

let ipCounter = 0

function freshAddress(): string {
  const octet = (process.pid % 200) + 1
  ipCounter += 1
  return `10.${octet}.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`
}

/**
 * The rate limiter identifies a client by x-forwarded-for. Each test pretends to
 * come from its own address so tests in parallel do not use up each other's budget.
 */
async function ownAddress(page: Page) {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': freshAddress() })
}

test.describe('route protection', () => {
  test('sends a visitor to the sign-in page', async ({ page }) => {
    for (const path of ['/', '/coloring']) {
      await page.goto(path)
      await expect(page).toHaveURL('/login')
    }
  })

  test('sends a visitor of the admin area to the admin sign-in page', async ({ page }) => {
    await page.goto('/admin')

    await expect(page).toHaveURL('/admin/login')
  })

  test('leaves the developer tools open', async ({ page }) => {
    await page.goto('/coloring/lab')

    await expect(page).toHaveURL('/coloring/lab')
  })
})

test.describe('sign-in form', () => {
  test('explains mistakes in Russian before sending anything', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Имя').fill('a')
    await page.getByRole('button', { name: 'Играть' }).click()

    await expect(page.getByText('Имя должно быть не короче 3 символов')).toBeVisible()
    await expect(page.getByText('Выберите страну из списка')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  test('tells what is stored about the player', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText('Мы сохраняем имя, страну и ваши рисунки')).toBeVisible()
  })
})

test.describe('sign-in API', () => {
  test('answers with the error body of the API, never with internals', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: { username: 'a', country: 'XX' }, headers: { 'x-forwarded-for': freshAddress() } })
    const body = await response.json()

    expect(response.status()).toBe(422)
    expect(body.data).toMatchObject({ code: 'validation', message: 'Проверьте введённые данные' })
    expect(body.data.fields.username).toContain('Имя')
    expect(JSON.stringify(body)).not.toMatch(/stack|node_modules|zod/i)
  })

  test('refuses a body that is not JSON of the expected shape', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: 'just text', headers: { 'x-forwarded-for': freshAddress() } })

    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
  })
})

test.describe('administrator', () => {
  test.beforeEach(async ({ page }) => {
    await ownAddress(page)
  })

  async function signInAsAdmin(page: Page, password = E2E_ADMIN.password) {
    await page.goto('/admin/login')
    await page.getByLabel('Логин').fill(E2E_ADMIN.login)
    await page.getByLabel('Пароль').fill(password)
    await page.getByRole('button', { name: 'Войти' }).click()
  }

  test('a wrong password is refused with a clear message', async ({ page }) => {
    await signInAsAdmin(page, 'wrong-password')

    await expect(page.getByText('Неверный логин или пароль')).toBeVisible()
    await expect(page).toHaveURL('/admin/login')
  })

  test('the right credentials open the admin area, and signing out closes it', async ({ page }) => {
    await signInAsAdmin(page)

    await expect(page).toHaveURL('/admin')
    await expect(page.getByRole('heading', { name: 'Администратор' })).toBeVisible()
    // The session survives a reload.
    await page.reload()
    await expect(page).toHaveURL('/admin')

    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL('/admin/login')
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/login')
  })

  test('the admin is not sent in circles on user pages', async ({ page }) => {
    await signInAsAdmin(page)
    await expect(page).toHaveURL('/admin')

    await page.goto('/')

    await expect(page).toHaveURL('/admin')
  })

  test('admin API routes check the role on the server', async ({ page, request }) => {
    const anonymous = await request.get('/api/admin/session', { headers: { 'x-forwarded-for': freshAddress() } })
    expect(anonymous.status()).toBe(401)
    expect((await anonymous.json()).data.code).toBe('unauthorized')

    await signInAsAdmin(page)
    await expect(page).toHaveURL('/admin')
    const asAdmin = await page.request.get('/api/admin/session')
    expect(asAdmin.status()).toBe(200)
  })

  test('the session cookie is httpOnly, secure-by-default and sameSite=lax', async ({ page }) => {
    await signInAsAdmin(page)
    await expect(page).toHaveURL('/admin')

    const cookie = (await page.context().cookies()).find(item => item.name === 'nuxt-session')

    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
    // The payload is encrypted, so the role is not readable from the cookie.
    expect(cookie?.value).not.toContain('admin')
  })

  test('the admin password is rate limited', async ({ request }) => {
    const headers = { 'x-forwarded-for': freshAddress() }
    const statuses: number[] = []
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await request.post('/api/admin/login', { data: { login: E2E_ADMIN.login, password: 'nope' }, headers })
      statuses.push(response.status())
    }

    // The limiter allows the configured budget (5 per window, the library lets one more through),
    // then answers 429 until the window passes.
    const refused = statuses.filter(status => status === 401).length
    expect(refused).toBeGreaterThanOrEqual(5)
    expect(refused).toBeLessThanOrEqual(6)
    expect(statuses.slice(6).every(status => status === 429)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })
})

test.describe('sign-in with the database', () => {
  test.skip(!withDb, 'Set E2E_WITH_DB=1 with a migrated DATABASE_URL in .env')

  test('a new player signs in, stays signed in after a reload and signs out', async ({ page }) => {
    await ownAddress(page)
    const name = `e2e${Date.now().toString(36)}`
    await page.goto('/login')
    await page.getByLabel('Имя').fill(name)
    await page.getByLabel('Страна').selectOption('RU')
    await page.getByRole('button', { name: 'Играть' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText(name)).toBeVisible()
    await page.reload()
    await expect(page.getByText(name)).toBeVisible()

    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('a name taken from another country is refused', async ({ page }) => {
    await ownAddress(page)
    const name = `e2e${Date.now().toString(36)}b`
    const first = await page.request.post('/api/auth/login', { data: { username: name, country: 'RU' } })
    expect(first.status()).toBe(200)

    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByLabel('Имя').fill(name.toUpperCase())
    await page.getByLabel('Страна').selectOption('US')
    await page.getByRole('button', { name: 'Играть' }).click()

    await expect(page.getByText('Это имя уже занято в другой стране')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })
})
