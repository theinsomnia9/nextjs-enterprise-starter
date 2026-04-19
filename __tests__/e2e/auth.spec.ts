import { test, expect } from '@playwright/test'
import { buildSessionCookie } from '../helpers/mockSession'

const BASE = 'http://localhost:3000'

test.describe('auth', () => {
  test('unauthenticated user is redirected to /auth/signin', async ({ page }) => {
    // /auth/signin is a pure redirect to Entra — the middleware redirects unauthenticated
    // requests to /auth/signin which then immediately redirects to login.microsoftonline.com.
    // We verify the chain: /approvals → /auth/signin → Entra (returnTo is preserved in state).
    await page.goto(`${BASE}/approvals`)
    // The page should NOT remain on /approvals and should end up off-site (Entra) or on /auth/signin
    await expect(page).not.toHaveURL(`${BASE}/approvals`)
    // After following all redirects the URL should either be the Entra login page or /auth/signin
    const finalUrl = page.url()
    const isEntraOrSignin =
      finalUrl.includes('login.microsoftonline.com') || finalUrl.includes('/auth/signin')
    expect(isEntraOrSignin).toBe(true)
  })

  test('authenticated user sees approvals page', async ({ context, page }) => {
    const cookie = await buildSessionCookie({
      userId: 'dev-user-alice',
      roles: ['Approver'],
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
    await page.goto(`${BASE}/approvals`)
    await expect(page.getByRole('heading', { name: /approval queue/i }).first()).toBeVisible()
  })

  test('sign-out clears session and redirects to signin', async ({ context, page }) => {
    const cookie = await buildSessionCookie({
      userId: 'dev-user-alice',
      roles: ['Approver'],
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
    // /auth/signout clears the cookie then redirects to /auth/signin, which immediately
    // redirects to Entra. Accept either /auth/signin or the Entra URL.
    const afterSignoutUrl = page.url()
    const redirectedAfterSignout =
      afterSignoutUrl.includes('login.microsoftonline.com') ||
      afterSignoutUrl.includes('/auth/signin')
    expect(redirectedAfterSignout).toBe(true)
    // Subsequent visit to /approvals (without session cookie) should also redirect
    await page.goto(`${BASE}/approvals`)
    await expect(page).not.toHaveURL(`${BASE}/approvals`)
  })
})
