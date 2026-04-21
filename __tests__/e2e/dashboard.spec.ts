import { test, expect } from '@playwright/test'
import { mockSessionAs } from '../helpers/mockSession'

test.describe('Dashboard', () => {
  test('unauthenticated visit is redirected off /dashboard to signin', async ({
    page,
  }) => {
    // /auth/signin is a pure redirect to Entra, so the browser never
    // rests on /auth/signin — it lands on login.microsoftonline.com.
    // The returnTo we care about is passed through via state.
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/\/dashboard$/)
    const finalUrl = page.url()
    const redirected =
      finalUrl.includes('login.microsoftonline.com') ||
      finalUrl.includes('/auth/signin')
    expect(redirected).toBe(true)
  })

  test('authenticated User can reach /dashboard and sees welcome banner', async ({
    page,
    context,
  }) => {
    await mockSessionAs(context, {
      role: 'User',
      name: 'Jane Tester',
      email: 'jane@example.com',
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /welcome, jane tester/i
    )
  })
})
