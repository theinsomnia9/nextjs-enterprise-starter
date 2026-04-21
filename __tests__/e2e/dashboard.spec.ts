import { test, expect } from '@playwright/test'
import { mockSessionAs } from '../helpers/mockSession'

test.describe('Dashboard', () => {
  test('unauthenticated visit redirects to signin with returnTo', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/signin\?returnTo=%2Fdashboard/)
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
