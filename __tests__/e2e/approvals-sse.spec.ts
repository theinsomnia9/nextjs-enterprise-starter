import { test, expect, type Page } from '@playwright/test'

test.describe('SSE – approval queue real-time updates', () => {
  // ─── Endpoint health ──────────────────────────────────────────────

  test('SSE endpoint returns correct streaming headers', async ({ request }) => {
    // Abort the stream after receiving headers – we only care about the response meta
    const response = await request.get('/api/sse/approvals', {
      headers: { Accept: 'text/event-stream' },
      timeout: 5000,
    })

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/event-stream')
    expect(response.headers()['cache-control']).toContain('no-cache')
  })

  test('SSE endpoint sends initial "connected" event', async ({ page }) => {
    const sseMessages: string[] = []

    await page.route('/api/sse/approvals', async (route) => {
      const response = await route.fetch()
      const body = await response.text()
      sseMessages.push(body)
      await route.fulfill({ response })
    })

    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    // Check that at least one intercepted SSE message contains the connected event
    const hasConnectedEvent = sseMessages.some((msg) => msg.includes('event: connected'))
    expect(hasConnectedEvent).toBe(true)
  })

  // ─── Single-browser action → counter update ───────────────────────

  test('PENDING counter decrements after locking an item', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    const pendingBefore = await getPipelineCount(page, 'PENDING')
    const reviewingBefore = await getPipelineCount(page, 'REVIEWING')

    const lockButton = page.locator('button', { hasText: 'Lock' }).first()
    if ((await lockButton.count()) === 0) {
      test.skip()
      return
    }

    await lockButton.click()

    // After locking, the page should re-fetch and counters should update
    await page.waitForFunction(
      ([before]) => {
        const el = document.querySelector('[data-testid="approval-pipeline"]')
        if (!el) return false
        const labels = Array.from(el.querySelectorAll('span'))
        const pendingLabel = labels.find((s) => s.textContent === 'PENDING')
        const count = pendingLabel?.nextElementSibling?.textContent
        return count !== null && Number(count) !== before
      },
      [pendingBefore],
      { timeout: 5000 }
    )

    const pendingAfter = await getPipelineCount(page, 'PENDING')
    const reviewingAfter = await getPipelineCount(page, 'REVIEWING')

    expect(pendingAfter).toBe(pendingBefore - 1)
    expect(reviewingAfter).toBe(reviewingBefore + 1)
  })

  test('REVIEWING counter decrements after approving a locked item', async ({ page }) => {
    await page.goto('/approvals')
    await page.waitForLoadState('networkidle')

    // First lock an item so we can approve it
    const lockButton = page.locator('button', { hasText: 'Lock' }).first()
    if ((await lockButton.count()) === 0) {
      test.skip()
      return
    }
    await lockButton.click()
    await page.waitForLoadState('networkidle')

    const reviewingBefore = await getPipelineCount(page, 'REVIEWING')
    const approvedBefore = await getPipelineCount(page, 'APPROVED')

    const approveButton = page.locator('button.interactive', { hasText: 'Approve' }).first()
    if ((await approveButton.count()) === 0) {
      test.skip()
      return
    }
    await approveButton.click()
    await page.waitForLoadState('networkidle')

    const reviewingAfter = await getPipelineCount(page, 'REVIEWING')
    const approvedAfter = await getPipelineCount(page, 'APPROVED')

    expect(reviewingAfter).toBe(reviewingBefore - 1)
    expect(approvedAfter).toBe(approvedBefore + 1)
  })

  // ─── Cross-browser SSE sync ───────────────────────────────────────

  test('counter in a second browser context updates when first browser locks an item', async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      await page1.goto('/approvals')
      await page1.waitForLoadState('networkidle')
      await page2.goto('/approvals')
      await page2.waitForLoadState('networkidle')

      const lockButton = page1.locator('button', { hasText: 'Lock' }).first()
      if ((await lockButton.count()) === 0) {
        test.skip()
        return
      }

      const pendingBefore = await getPipelineCount(page2, 'PENDING')
      const reviewingBefore = await getPipelineCount(page2, 'REVIEWING')

      // Perform action in page1
      await lockButton.click()

      // page2 should receive the SSE event and auto-refresh
      await page2.waitForFunction(
        ([pb, rb]) => {
          const el = document.querySelector('[data-testid="approval-pipeline"]')
          if (!el) return false
          const labels = Array.from(el.querySelectorAll('span'))

          const pendingLabel = labels.find((s) => s.textContent === 'PENDING')
          const reviewingLabel = labels.find((s) => s.textContent === 'REVIEWING')

          const pending = Number(pendingLabel?.nextElementSibling?.textContent)
          const reviewing = Number(reviewingLabel?.nextElementSibling?.textContent)

          return pending === pb - 1 && reviewing === rb + 1
        },
        [pendingBefore, reviewingBefore],
        { timeout: 8000 }
      )

      expect(await getPipelineCount(page2, 'PENDING')).toBe(pendingBefore - 1)
      expect(await getPipelineCount(page2, 'REVIEWING')).toBe(reviewingBefore + 1)
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})

// ─── Helpers ─────────────────────────────────────────────────────────

async function getPipelineCount(page: Page, status: string): Promise<number> {
  const pipeline = page.locator('[data-testid="approval-pipeline"]')
  const labels = pipeline.locator('span')
  const count = await labels.count()

  for (let i = 0; i < count; i++) {
    const text = await labels.nth(i).textContent()
    if (text?.trim() === status) {
      const sibling = labels.nth(i + 1)
      const value = await sibling.textContent()
      return Number(value?.trim() ?? '0')
    }
  }
  return 0
}
