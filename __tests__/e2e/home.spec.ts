import { test, expect } from '@playwright/test'

test.describe('Home Page — Dev Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display Dev Navigation heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dev Navigation' })).toBeVisible()
  })

  test('should display subtitle text', async ({ page }) => {
    await expect(page.getByText(/navigate across features/i)).toBeVisible()
  })

  test('should have a working link to the Chat page', async ({ page }) => {
    const link = page.getByRole('link', { name: /chat/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/chat')
  })

  test('should have a working link to the Workflow Builder page', async ({ page }) => {
    const link = page.getByRole('link', { name: /workflow builder/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/builder')
  })

  test('should have a working link to the Approvals page', async ({ page }) => {
    const link = page.getByRole('link', { name: /approvals/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/approvals')
  })

  test('should navigate to chat page on link click', async ({ page }) => {
    await page.getByTestId('nav-card-chat').getByRole('link').click()
    await expect(page).toHaveURL('/chat')
  })

  test('should navigate to builder page on link click', async ({ page }) => {
    await page.getByTestId('nav-card-builder').getByRole('link').click()
    await expect(page).toHaveURL('/builder')
  })

  test('should navigate to approvals page on link click', async ({ page }) => {
    await page.getByTestId('nav-card-approvals').getByRole('link').click()
    await expect(page).toHaveURL('/approvals')
  })
})
