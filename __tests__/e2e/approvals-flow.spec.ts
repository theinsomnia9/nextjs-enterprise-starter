import { test, expect } from '@playwright/test'

test.describe('Approvals flow detail', () => {
  test('approval queue page does NOT show ReactFlow canvas', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="react-flow"]')).not.toBeVisible()
  })

  test('approval queue page shows status summary cards', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="approval-pipeline"]')).toBeVisible()
    await expect(page.getByText('PENDING')).toBeVisible()
    await expect(page.getByText('REVIEWING')).toBeVisible()
    await expect(page.getByText('APPROVED')).toBeVisible()
    await expect(page.getByText('REJECTED')).toBeVisible()
  })

  test('clicking a queue item navigates to approval detail page', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    const firstItem = page.locator('[data-testid^="queue-item-"]').first()
    const itemId = await firstItem.getAttribute('data-testid')
    const requestId = itemId?.replace('queue-item-', '')

    if (!requestId) {
      test.skip()
      return
    }

    await firstItem.click()
    await page.waitForURL(`/approvals/${requestId}`)
    await expect(page).toHaveURL(`/approvals/${requestId}`)
  })

  test('approval detail page shows ReactFlow diagram', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    const firstItem = page.locator('[data-testid^="queue-item-"]').first()
    if ((await firstItem.count()) === 0) {
      test.skip()
      return
    }

    await firstItem.click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="approval-flow-diagram"]')).toBeVisible()
  })

  test('approval detail page back button returns to queue', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    const firstItem = page.locator('[data-testid^="queue-item-"]').first()
    if ((await firstItem.count()) === 0) {
      test.skip()
      return
    }

    await firstItem.click()
    await page.waitForLoadState('networkidle')
    await page.locator('[data-testid="back-to-queue"]').click()
    await expect(page).toHaveURL('/approvals')
  })
})
