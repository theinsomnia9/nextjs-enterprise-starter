import { test, expect, Page, BrowserContext } from '@playwright/test'
import { buildSessionCookie } from '../helpers/mockSession'

const BASE = 'http://localhost:3000'

async function signIn(context: BrowserContext) {
  const cookie = await buildSessionCookie({
    userId: 'dev-user-alice',
    roles: ['Approver'],
    name: 'Alice',
  })
  await context.addCookies([
    {
      name: 'session',
      value: encodeURIComponent(cookie),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

async function createTeamAndOpenBuilder(page: Page): Promise<string> {
  await page.goto(`${BASE}/agent-teams`)
  await expect(page.getByTestId('agent-teams-page')).toBeVisible()

  await page.getByTestId('new-team-button').click()
  await page.waitForURL(/\/agent-teams\/[^/]+$/)
  await expect(page.getByTestId('agent-team-builder')).toBeVisible()
  const teamId = page.url().split('/').pop() as string
  return teamId
}

test.describe('Agent Team Builder', () => {
  test('list page shows empty state or existing teams', async ({ context, page }) => {
    await signIn(context)
    await page.goto(`${BASE}/agent-teams`)
    await expect(page.getByTestId('agent-teams-page')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /AI Agent Teams/i }).first()
    ).toBeVisible()
    await expect(page.getByTestId('new-team-button')).toBeVisible()
  })

  test('home page has a nav card that links to /agent-teams', async ({
    context,
    page,
  }) => {
    await signIn(context)
    await page.goto(`${BASE}/`)
    const card = page.getByTestId('nav-card-agent-teams')
    await expect(card).toBeVisible()
    const link = card.getByRole('link').first()
    await expect(link).toHaveAttribute('href', '/agent-teams')
  })

  test('creating a new team lands on the builder with default trigger/output', async ({
    context,
    page,
  }) => {
    await signIn(context)
    const teamId = await createTeamAndOpenBuilder(page)
    expect(teamId).toBeTruthy()

    await expect(page.getByTestId('canvas-wrap')).toBeVisible()
    // ReactFlow renders node content — look for the default trigger and output labels
    await expect(page.getByText('User Input').first()).toBeVisible()
    await expect(page.getByText('Final Answer').first()).toBeVisible()
  })

  test('palette adds an agent node, property panel edits it, save persists', async ({
    context,
    page,
  }) => {
    await signIn(context)
    await createTeamAndOpenBuilder(page)

    await page.getByTestId('palette-add-agent').click()

    // Adding a node auto-selects it and opens the Properties tab by default.
    await expect(page.getByTestId('field-label')).toBeVisible()
    await expect(page.getByTestId('field-role')).toBeVisible()
    await expect(page.getByTestId('field-prompt')).toBeVisible()

    await page.getByTestId('field-label').fill('Researcher')
    await page.getByTestId('field-role').fill('Research Analyst')
    await page
      .getByTestId('field-prompt')
      .fill('You gather up-to-date information and summarize it briefly.')

    await expect(page.getByText('Unsaved changes')).toBeVisible()

    await page.getByTestId('team-save').click()
    await expect(page.getByText(/Saved /)).toBeVisible({ timeout: 5000 })

    // After reload the new node should still be present
    await page.reload()
    await expect(page.getByText('Researcher').first()).toBeVisible()
  })

  test('right panel tabs switch between Properties, AI Designer, and Run', async ({
    context,
    page,
  }) => {
    await signIn(context)
    await createTeamAndOpenBuilder(page)

    await page.getByTestId('tab-run').click()
    await expect(page.getByTestId('run-panel')).toBeVisible()
    await expect(page.getByTestId('run-input')).toBeVisible()

    await page.getByTestId('tab-chat').click()
    // The AI Designer textarea should appear once the tab is active
    await expect(page.getByPlaceholder(/describe/i)).toBeVisible()

    await page.getByTestId('tab-properties').click()
  })

  test('run button is visible on Run tab (execution skipped when OPENAI_API_KEY unset)', async ({
    context,
    page,
  }) => {
    await signIn(context)
    await createTeamAndOpenBuilder(page)

    await page.getByTestId('tab-run').click()
    const runBtn = page.getByTestId('run-start')
    await expect(runBtn).toBeVisible()

    if (!process.env.OPENAI_API_KEY) {
      test.skip(true, 'OPENAI_API_KEY not set — skipping live agent run')
    }

    await runBtn.click()
    // Wait for either the final output to appear, or an error — either way the run completes
    const outcome = page
      .getByTestId('run-final')
      .or(page.locator('[data-testid="run-log"] .text-destructive'))
    await expect(outcome.first()).toBeVisible({ timeout: 60_000 })
  })
})
