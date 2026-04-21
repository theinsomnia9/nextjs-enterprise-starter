import { test, expect } from '@playwright/test'
import { mockSessionAs } from '../helpers/mockSession'

test.describe('Settings', () => {
  test('User sees Profile sub-nav but no Admin link', async ({
    page,
    context,
  }) => {
    await mockSessionAs(context, { role: 'User' })
    await page.goto('/settings')
    const nav = page.getByRole('navigation', { name: /settings/i })
    await expect(nav.getByRole('link', { name: /profile/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /^admin$/i })).toHaveCount(0)
  })

  test('User hitting /settings/admin is redirected to unauthorized', async ({
    page,
    context,
  }) => {
    await mockSessionAs(context, { role: 'User' })
    await page.goto('/settings/admin')
    await expect(page).toHaveURL(/\/auth\/unauthorized/)
  })

  test('Admin sees Admin sub-link and can open the admin page', async ({
    page,
    context,
  }) => {
    await mockSessionAs(context, { role: 'Admin', name: 'Alice Admin' })
    await page.goto('/settings')
    const nav = page.getByRole('navigation', { name: /settings/i })
    const adminLink = nav.getByRole('link', { name: /^admin$/i })
    await expect(adminLink).toBeVisible()
    await adminLink.click()
    await expect(page).toHaveURL(/\/settings\/admin/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/admin/i)
  })
})
