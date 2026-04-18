import { test, expect } from '@playwright/test'

test.describe('Workflow Builder', () => {
  test('should load the builder page', async ({ page }) => {
    await page.goto('/builder')

    await expect(page.getByRole('button', { name: /Add Node/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Delete Selected/i })).toBeVisible()
  })

  test('should have initial nodes', async ({ page }) => {
    await page.goto('/builder')

    await expect(page.getByText('Start Node')).toBeVisible()
    await expect(page.getByText('Process Node')).toBeVisible()
    await expect(page.getByText('End Node')).toBeVisible()
  })

  test('should add a new node when clicking Add Node button', async ({ page }) => {
    await page.goto('/builder')

    const addButton = page.getByRole('button', { name: /Add Node/i }).first()
    await addButton.click()

    await expect(page.getByText(/Node 4/i)).toBeVisible()
  })

  test('should navigate from home page to builder', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('nav-card-builder').getByRole('link').click()

    await expect(page).toHaveURL('/builder')
    await expect(page.getByText('Start Node')).toBeVisible()
  })
})
