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

async function openThemeItem(page: import('@playwright/test').Page) {
  await page.locator('button[aria-label="Open user menu"]').click()
  return page.locator('[data-testid="user-menu-theme"]')
}

test.describe('Theme Toggle', () => {
  test('should have theme toggle item visible in UserMenu', async ({ context, page }) => {
    await addAuthCookie(context)
    await page.goto(`${BASE}/`)
    const themeItem = await openThemeItem(page)
    await expect(themeItem).toBeVisible()
  })

  test('should toggle between light and dark mode', async ({ context, page }) => {
    await addAuthCookie(context)
    await page.goto(`${BASE}/`)

    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)

    let themeItem = await openThemeItem(page)
    await themeItem.click()
    await expect(html).toHaveClass(/dark/)

    // Re-open menu after click (menu closed because onSelect without preventDefault for a normal click)
    themeItem = await openThemeItem(page)
    await themeItem.click()
    await expect(html).not.toHaveClass(/dark/)
  })

  test('should persist theme preference across page reloads', async ({ context, page }) => {
    await addAuthCookie(context)
    await page.goto(`${BASE}/`)

    const html = page.locator('html')
    const themeItem = await openThemeItem(page)
    await themeItem.click()
    await expect(html).toHaveClass(/dark/)

    await page.reload()
    await expect(html).toHaveClass(/dark/)
  })

  test('should work on /builder page', async ({ context, page }) => {
    await addAuthCookie(context)
    await page.goto(`${BASE}/`)

    // Enable dark mode from /
    const themeItem = await openThemeItem(page)
    await themeItem.click()

    // Navigate to /builder and verify dark mode persisted + UserMenu present
    await page.goto(`${BASE}/builder`)
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
    await expect(page.locator('button[aria-label="Open user menu"]')).toBeVisible()
  })
})
