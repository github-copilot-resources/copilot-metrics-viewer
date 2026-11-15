import { expect, test } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage'

test('named assistant controls open, send, clear and close by keyboard', async ({ page }) => {
  await page.goto('/orgs/octo-demo-org?mock=true')
  await new DashboardPage(page).expectMetricLabelsVisible()
  await page.getByRole('button', { name: 'Open AI metrics assistant', exact: true }).focus()
  await page.keyboard.press('Enter')
  const card = page.locator('.ai-chat-card')
  await expect(card).toBeVisible()
  const send = card.getByRole('button', { name: 'Send message', exact: true })
  await expect(send).toBeDisabled()
  await card.getByRole('textbox').fill('Summarize synthetic mock usage')
  await expect(send).toBeEnabled()
  await send.focus()
  await page.keyboard.press('Space')
  await expect(card.locator('.ai-chat-message-user')).toContainText('Summarize synthetic mock usage')
  await expect(card.locator('.ai-chat-message-assistant')).toBeVisible()
  await card.getByRole('button', { name: 'Clear conversation', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(card.locator('.ai-chat-message-user')).toHaveCount(0)
  await expect(card.locator('.ai-chat-suggestions')).toBeVisible()
  await card.getByRole('button', { name: 'Close AI metrics assistant', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(card).not.toBeVisible()
})

for (const status of [200, 500]) {
  test(`clearing a pending conversation ignores its late ${status} response`, async ({ page }) => {
    let release!: () => void
    let requested!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const received = new Promise<void>(resolve => { requested = resolve })
    await page.route('**/api/ai/chat', async route => {
      requested()
      await gate
      await route.fulfill({
        status,
        json: status === 200
          ? { answer: 'Discarded synthetic answer' }
          : { statusCode: 500, statusMessage: 'Discarded synthetic error' },
      })
    })
    try {
      await page.goto('/orgs/octo-demo-org?mock=true')
      await new DashboardPage(page).expectMetricLabelsVisible()
      await page.getByRole('button', { name: 'Open AI metrics assistant', exact: true }).click()
      const card = page.locator('.ai-chat-card')
      await card.getByRole('textbox').fill('Synthetic pending question')
      await card.getByRole('button', { name: 'Send message', exact: true }).click()
      await received
      await expect(card.locator('.ai-chat-loading')).toBeVisible()
      await card.getByRole('button', { name: 'Clear conversation', exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(card.locator('.ai-chat-message-user')).toHaveCount(0)
      await expect(card.locator('.ai-chat-suggestions')).toBeVisible()
      const response = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/ai/chat' && response.status() === status)
      release()
      await response
      await expect(card.locator('.ai-chat-loading')).toBeHidden()
      await expect(card.getByRole('textbox')).toBeEnabled()
      await expect(card.locator('.ai-chat-message')).toHaveCount(0)
      await expect(card.getByRole('alert')).toBeHidden()
      await expect(card.locator('.ai-chat-suggestions')).toBeVisible()

      await page.route('**/api/ai/chat', route => route.fulfill({ json: { answer: 'Fresh synthetic answer' } }))
      await card.getByRole('textbox').fill('New synthetic question')
      await card.getByRole('button', { name: 'Send message', exact: true }).click()
      await expect(card.locator('.ai-chat-message-assistant .ai-chat-bubble-content')).toHaveText('Fresh synthetic answer')
      await expect(card.locator('.ai-chat-message-user')).toHaveText('New synthetic question')
      await expect(card.locator('.ai-chat-loading')).toBeHidden()
    } finally {
      release()
    }
  })
}

test.describe('AI Chat Panel', () => {
  test.describe.configure({ mode: 'serial' })

  let dashboard: DashboardPage
  let page: import('@playwright/test').Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/orgs/octo-demo-org?mock=true')

    dashboard = new DashboardPage(page)
    await dashboard.expectMetricLabelsVisible()
  })

  test.afterAll(async () => {
    await dashboard?.close()
  })

  test('should show AI chat FAB button', async () => {
    const fab = page.locator('.ai-chat-fab')
    await expect(fab).toBeVisible()
  })

  test('should open chat panel when FAB is clicked', async () => {
    const fab = page.locator('.ai-chat-fab')
    await fab.click()

    // Chat card should appear
    const chatCard = page.locator('.ai-chat-card')
    await expect(chatCard).toBeVisible()

    // Header should show title
    await expect(page.getByText('AI Metrics Assistant')).toBeVisible()
  })

  test('should show suggested questions', async () => {
    // Welcome area should have suggested question chips
    const suggestions = page.locator('.ai-chat-suggestions .v-chip')
    await expect(suggestions.first()).toBeVisible()

    // Should have at least 2 suggestions
    const count = await suggestions.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('should send a message and receive a mock response', async () => {
    // Type a question
    const input = page.locator('.ai-chat-input').getByRole('textbox')
    await input.fill('What is the overall summary?')
    await input.press('Enter')

    // User message should appear
    await expect(page.locator('.ai-chat-message-user').last()).toContainText('What is the overall summary?')

    // Wait for response (mock mode should respond quickly)
    const assistantMessage = page.locator('.ai-chat-message-assistant .ai-chat-bubble-content')
    await expect(assistantMessage.last()).toBeVisible({ timeout: 10000 })

    // Response should contain some metrics text
    const responseText = await assistantMessage.last().textContent()
    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(20)
  })

  test('should handle clicking a suggested question', async () => {
    // Clear conversation first
    const clearButton = page.locator('.ai-chat-card').getByRole('button').filter({ has: page.locator('.mdi-delete-outline') })
    await clearButton.click()

    // Suggested questions should reappear
    const suggestions = page.locator('.ai-chat-suggestions .v-chip')
    await expect(suggestions.first()).toBeVisible()

    // Click the first suggestion
    await suggestions.first().click()

    // Should see a user message
    await expect(page.locator('.ai-chat-message-user').first()).toBeVisible({ timeout: 5000 })

    // Wait for assistant response
    const assistantMessage = page.locator('.ai-chat-message-assistant .ai-chat-bubble-content')
    await expect(assistantMessage.last()).toBeVisible({ timeout: 10000 })
  })

  test('should support multi-turn conversation', async () => {
    // Send a follow-up question
    const input = page.locator('.ai-chat-input').getByRole('textbox')
    await input.fill('Tell me about languages')
    await input.press('Enter')

    // Should now have multiple messages
    const assistantMessages = page.locator('.ai-chat-message-assistant')
    await expect(assistantMessages.last()).toBeVisible({ timeout: 10000 })

    // Should have at least 2 assistant messages (from previous test + this one)
    const count = await assistantMessages.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('should clear conversation', async () => {
    // Wait for any pending responses to finish
    await page.waitForTimeout(1000)

    const clearButton = page.locator('.ai-chat-card').getByRole('button').filter({ has: page.locator('.mdi-delete-outline') })
    await clearButton.click()

    // Welcome / suggestions should reappear (messages cleared)
    await expect(page.locator('.ai-chat-welcome')).toBeVisible({ timeout: 5000 })
  })

  test('should close chat panel', async () => {
    const closeButton = page.locator('.ai-chat-card').getByRole('button').filter({ has: page.locator('.mdi-close') })
    await closeButton.click()

    // Chat card should disappear
    await expect(page.locator('.ai-chat-card')).not.toBeVisible()

    // FAB should reappear
    await expect(page.locator('.ai-chat-fab')).toBeVisible()
  })

  test('should not send empty messages', async () => {
    // Re-open
    await page.locator('.ai-chat-fab').click()
    await expect(page.locator('.ai-chat-card')).toBeVisible()

    // Try to send empty message
    const input = page.locator('.ai-chat-input').getByRole('textbox')
    await input.fill('')
    await input.press('Enter')

    // No message should appear
    const messages = page.locator('.ai-chat-message')
    await expect(messages).toHaveCount(0)
  })
})
