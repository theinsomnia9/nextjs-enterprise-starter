import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test('should have theme toggle button visible', async ({ page }) => {
    await page.goto('/')

    const themeToggle = page.getByRole('button', { name: /toggle theme/i })
    await expect(themeToggle).toBeVisible()
  })

  test('should toggle between light and dark mode', async ({ page }) => {
    await page.goto('/')

    const html = page.locator('html')
    const themeToggle = page.getByRole('button', { name: /toggle theme/i })

    await expect(html).not.toHaveClass(/dark/)

    await themeToggle.click()

    await expect(html).toHaveClass(/dark/)

    await themeToggle.click()

    await expect(html).not.toHaveClass(/dark/)
  })

  test('should persist theme preference across page reloads', async ({ page }) => {
    await page.goto('/')

    const html = page.locator('html')
    const themeToggle = page.getByRole('button', { name: /toggle theme/i })

    await themeToggle.click()
    await expect(html).toHaveClass(/dark/)

    await page.reload()

    await expect(html).toHaveClass(/dark/)
  })

  test('should work on all pages', async ({ page }) => {
    await page.goto('/')

    const themeToggle = page.getByRole('button', { name: /toggle theme/i })
    await themeToggle.click()

    await page.goto('/builder')

    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)

    const builderToggle = page.getByRole('button', { name: /toggle theme/i })
    await expect(builderToggle).toBeVisible()
  })
})
