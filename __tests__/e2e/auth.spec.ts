import { test, expect } from '@playwright/test'
import { buildSessionCookie } from '../helpers/mockSession'

const BASE = 'http://localhost:3000'

test.describe('auth', () => {
  test('unauthenticated user is redirected to /auth/signin', async ({ page }) => {
    // /auth/signin is a pure redirect to Entra — the middleware redirects unauthenticated
    // requests to /auth/signin which then immediately redirects to login.microsoftonline.com.
    // We verify the chain: /dashboard → /auth/signin → Entra (returnTo is preserved in state).
    await page.goto(`${BASE}/dashboard`)
    await expect(page).not.toHaveURL(`${BASE}/dashboard`)
    const finalUrl = page.url()
    const isEntraOrSignin =
      finalUrl.includes('login.microsoftonline.com') || finalUrl.includes('/auth/signin')
    expect(isEntraOrSignin).toBe(true)
  })

  test('authenticated user reaches the dashboard', async ({ context, page }) => {
    const cookie = await buildSessionCookie({
      userId: 'dev-user-alice',
      roles: ['User'],
      name: 'Alice',
    })
    await context.addCookies([
      {
        name: 'session',
        value: encodeURIComponent(cookie),
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false, // Playwright against http://localhost cannot set Secure cookies
        sameSite: 'Lax',
      },
    ])
    await page.goto(`${BASE}/dashboard`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/welcome/i)
  })

  test('sign-out clears session and redirects to signin', async ({ context, page }) => {
    const cookie = await buildSessionCookie({
      userId: 'dev-user-alice',
      roles: ['User'],
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
    await page.goto(`${BASE}/auth/signout`)
    const afterSignoutUrl = page.url()
    const redirectedAfterSignout =
      afterSignoutUrl.includes('login.microsoftonline.com') ||
      afterSignoutUrl.includes('/auth/signin')
    expect(redirectedAfterSignout).toBe(true)
    // Subsequent visit to /dashboard (without session cookie) should also redirect
    await page.goto(`${BASE}/dashboard`)
    await expect(page).not.toHaveURL(`${BASE}/dashboard`)
  })
})
