import { test, expect, type BrowserContext } from '@playwright/test'
import { buildSessionCookie } from '../helpers/mockSession'

const BASE = 'http://localhost:3000'

async function addAuthCookie(context: BrowserContext) {
  const cookie = await buildSessionCookie({
    userId: 'dev-user-alice',
    roles: ['User'],
    name: 'Alice',
    email: 'alice@example.com',
  })
  await context.addCookies([
    {
      name: 'session',
      value: encodeURIComponent(cookie),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

test.describe('UserMenu', () => {
  test('avatar visible on /dashboard and /settings', async ({ context, page }) => {
    await addAuthCookie(context)
    const routes = ['/dashboard', '/settings']
    for (const route of routes) {
      await page.goto(`${BASE}${route}`)
      await expect(
        page.locator('button[aria-label="Open user menu"]'),
        `avatar should be visible on ${route}`
      ).toBeVisible()
    }
  })

  test('dropdown opens and shows name, email, and role badge', async ({ context, page }) => {
    await addAuthCookie(context)
    await page.goto(`${BASE}/`)
    await page.locator('button[aria-label="Open user menu"]').click()
    await expect(page.getByText('Alice', { exact: true })).toBeVisible()
    await expect(page.getByText('alice@example.com')).toBeVisible()
    await expect(page.locator('[aria-label="Role: User"]')).toBeVisible()
  })

  test('sign-out clears session and navigates off /', async ({ context, page }) => {
    await addAuthCookie(context)
    await page.goto(`${BASE}/`)
    await page.locator('button[aria-label="Open user menu"]').click()
    await page.locator('[data-testid="user-menu-signout"]').click()
    // After sign-out expect to land on /auth/signin or Entra
    const finalUrl = page.url()
    const isSignedOut =
      finalUrl.includes('login.microsoftonline.com') || finalUrl.includes('/auth/signin')
    expect(isSignedOut).toBe(true)
    // Subsequent visit to /dashboard (cookie cleared) should also redirect
    await page.goto(`${BASE}/dashboard`)
    await expect(page).not.toHaveURL(`${BASE}/dashboard`)
  })

  test('theme toggle changes the html dark class without closing the menu', async ({
    context,
    page,
  }) => {
    await addAuthCookie(context)
    await page.goto(`${BASE}/`)
    await page.locator('button[aria-label="Open user menu"]').click()
    const html = page.locator('html')
    const isDarkBefore = await html.evaluate((el) => el.classList.contains('dark'))
    await page.locator('[data-testid="user-menu-theme"]').click()
    const isDarkAfter = await html.evaluate((el) => el.classList.contains('dark'))
    expect(isDarkAfter).toBe(!isDarkBefore)
    // Menu item should still be visible (menu stayed open)
    await expect(page.locator('[data-testid="user-menu-theme"]')).toBeVisible()
  })
})
