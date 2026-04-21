import { test, expect } from '@playwright/test'
import { mockSessionAs } from '../helpers/mockSession'

test.describe('Home (landing page)', () => {
  test('unauthenticated visit shows the Sign in CTA', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /next\.js enterprise boilerplate/i })
    ).toBeVisible()
    const cta = page.getByRole('link', { name: /sign in/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/auth/signin')
  })

  test('authenticated visit shows the Go to dashboard CTA', async ({
    page,
    context,
  }) => {
    await mockSessionAs(context, { role: 'User' })
    await page.goto('/')
    const cta = page.getByRole('link', { name: /go to dashboard/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/dashboard')
  })
})
