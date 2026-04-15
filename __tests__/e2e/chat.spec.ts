import { test, expect } from '@playwright/test'

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat')
  })

  test('should display chat interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible()
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
    await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible()
  })

  test('should show welcome message initially', async ({ page }) => {
    await expect(page.getByText(/start a conversation/i)).toBeVisible()
  })

  test('should toggle chat history sidebar', async ({ page }) => {
    const toggle = page.getByTestId('chat-history-toggle')

    if (await toggle.isVisible()) {
      await toggle.click()
      await page.waitForTimeout(300)
    }
  })

  test('should toggle theme', async ({ page }) => {
    const themeToggle = page.getByTestId('theme-toggle')
    await expect(themeToggle).toBeVisible()

    const html = page.locator('html')
    const initialHasDark = await html.evaluate((el) => el.classList.contains('dark'))

    await themeToggle.click()
    await page.waitForTimeout(100)

    const finalHasDark = await html.evaluate((el) => el.classList.contains('dark'))

    expect(finalHasDark).not.toBe(initialHasDark)
  })

  test('should create new chat on button click', async ({ page }) => {
    const newChatButton = page.getByRole('button', { name: /new chat/i })
    await expect(newChatButton).toBeVisible()
    await newChatButton.click()
  })

  test('should validate empty message', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: /send/i })
    await expect(sendButton).toBeDisabled()
  })

  test('should enable send button when message is typed', async ({ page }) => {
    const input = page.getByPlaceholder('Type your message...')
    const sendButton = page.getByRole('button', { name: /send/i })

    await input.fill('Test message')
    await expect(sendButton).toBeEnabled()

    await input.clear()
    await expect(sendButton).toBeDisabled()
  })

  test.skip('should send message and receive response', async ({ page }) => {
    test.setTimeout(60000)

    const input = page.getByPlaceholder('Type your message...')
    const sendButton = page.getByRole('button', { name: /send/i })

    await input.fill('Say hello')
    await sendButton.click()

    await expect(page.getByText('Say hello')).toBeVisible()

    await expect(sendButton).toBeDisabled()
    await page.waitForTimeout(5000)

    const assistantMessages = page.locator('text=Assistant')
    await expect(assistantMessages.first()).toBeVisible({ timeout: 30000 })
  })

  test('should persist theme preference', async ({ page, context }) => {
    const themeToggle = page.getByTestId('theme-toggle')

    await themeToggle.click()
    await page.waitForTimeout(100)

    const theme = await page.evaluate(() => localStorage.getItem('theme'))

    await page.reload()
    await page.waitForTimeout(500)

    const themeAfterReload = await page.evaluate(() => localStorage.getItem('theme'))
    expect(themeAfterReload).toBe(theme)
  })
})
