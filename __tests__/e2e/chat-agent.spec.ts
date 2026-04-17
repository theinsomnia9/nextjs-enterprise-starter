import { test, expect } from '@playwright/test'

test.describe('Chat Agent Mode', () => {
  test('should render agent mode toggle in header', async ({ page }) => {
    await page.goto('/chat')

    // Agent toggle button should be visible
    const agentToggle = page.getByTestId('agent-mode-toggle')
    await expect(agentToggle).toBeVisible()
  })

  test('should toggle agent mode on click', async ({ page }) => {
    await page.goto('/chat')

    const agentToggle = page.getByTestId('agent-mode-toggle')

    // Initially agent mode is off (Bot icon)
    await expect(agentToggle).toHaveAttribute('aria-pressed', 'false')

    // Click to enable agent mode
    await agentToggle.click()

    // Should now be pressed (Bot icon showing active state)
    await expect(agentToggle).toHaveAttribute('aria-pressed', 'true')

    // Click again to disable
    await agentToggle.click()
    await expect(agentToggle).toHaveAttribute('aria-pressed', 'false')
  })

  test('should show agent badge when agent mode is active', async ({ page }) => {
    await page.goto('/chat')

    const agentToggle = page.getByTestId('agent-mode-toggle')
    const agentBadge = page.getByTestId('agent-mode-badge')

    // Badge should not be visible initially
    await expect(agentBadge).not.toBeVisible()

    // Enable agent mode
    await agentToggle.click()

    // Badge should now be visible
    await expect(agentBadge).toBeVisible()
    await expect(agentBadge).toContainText('Agent')
  })
})
