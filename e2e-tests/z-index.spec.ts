import { expect, test } from '@playwright/test'
import { DashboardPage } from './pages/DashboardPage'

/**
 * Z-index regression tests.
 *
 * Uses document.elementFromPoint() to verify that overlapping UI elements
 * render in the correct stacking order. This catches z-index regressions
 * where Vuetify's dynamic stacking contexts cause elements to render
 * behind other components.
 */
test.describe('Z-index stacking order', () => {
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

  test('chat panel should render above dashboard tiles', async () => {
    // Open chat panel
    const fab = page.locator('.ai-chat-fab')
    await fab.click()
    const chatCard = page.locator('.ai-chat-card')
    await expect(chatCard).toBeVisible()

    // Get chat card bounding box
    const chatBox = await chatCard.boundingBox()
    expect(chatBox).toBeTruthy()

    // Sample multiple points across the chat card surface
    const testPoints = [
      { x: chatBox!.x + chatBox!.width / 2, y: chatBox!.y + 20 },         // header area
      { x: chatBox!.x + chatBox!.width / 2, y: chatBox!.y + chatBox!.height / 2 }, // center
      { x: chatBox!.x + 20, y: chatBox!.y + chatBox!.height - 20 },       // bottom-left
    ]

    for (const point of testPoints) {
      const topElement = await page.evaluate(({ x, y }: { x: number, y: number }) => {
        const el = document.elementFromPoint(x, y)
        if (!el) return null
        // Walk up to find if this element is inside the chat panel
        let current: Element | null = el
        while (current) {
          if (current.classList?.contains('ai-chat-panel') ||
              current.classList?.contains('ai-chat-card')) {
            return 'chat-panel'
          }
          current = current.parentElement
        }
        return el.tagName + '.' + el.className.toString().slice(0, 50)
      }, point)

      expect(topElement, `Point (${point.x}, ${point.y}) should be inside chat panel`).toBe('chat-panel')
    }
  })

  test('chat FAB should render above dashboard content', async () => {
    // Close chat panel first
    const closeButton = page.locator('.ai-chat-card').getByRole('button').filter({
      has: page.locator('.mdi-close'),
    })
    await closeButton.click()
    await expect(page.locator('.ai-chat-card')).not.toBeVisible()

    // FAB should be visible
    const fab = page.locator('.ai-chat-fab')
    await expect(fab).toBeVisible()

    const fabBox = await fab.boundingBox()
    expect(fabBox).toBeTruthy()

    // Check center of FAB
    const centerX = fabBox!.x + fabBox!.width / 2
    const centerY = fabBox!.y + fabBox!.height / 2

    const topElement = await page.evaluate(({ x, y }: { x: number, y: number }) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return null
      let current: Element | null = el
      while (current) {
        if (current.classList?.contains('ai-chat-fab') ||
            current.classList?.contains('ai-chat-panel')) {
          return 'chat-fab'
        }
        current = current.parentElement
      }
      return el.tagName + '.' + el.className.toString().slice(0, 50)
    }, { x: centerX, y: centerY })

    expect(topElement, 'FAB center should be the topmost element').toBe('chat-fab')
  })

  test('user metrics tooltips should have correct z-index value', async () => {
    // Navigate to user metrics tab
    await dashboard.gotoUserMetricsTab()

    // Find a Chat column cell with a non-zero value (has tooltip)
    const chatCell = page.locator('td.text-center .text-indigo.font-weight-medium').first()
    await expect(chatCell).toBeVisible({ timeout: 10000 })

    // Hover to trigger tooltip
    await chatCell.hover()

    // Wait for the Vuetify tooltip overlay to appear
    const tooltip = page.locator('.v-overlay--active.v-tooltip')
    await expect(tooltip).toBeVisible({ timeout: 5000 })

    // Verify the tooltip has maximum z-index to render above all other elements
    const zIndex = await tooltip.evaluate((el: Element) => window.getComputedStyle(el).zIndex)
    expect(Number(zIndex)).toBe(2147483647)

    // Verify tooltip content is visible and contains feature breakdown text
    const content = page.locator('.v-overlay--active.v-tooltip .v-overlay__content')
    await expect(content).toBeVisible()
    const text = await content.textContent()
    expect(text).toContain('Chat')
  })

  test('chat panel should render above user metrics table', async () => {
    // Open chat from user metrics tab (table is full-width, good overlap test)
    const fab = page.locator('.ai-chat-fab')
    await expect(fab).toBeVisible()
    await fab.click()

    const chatCard = page.locator('.ai-chat-card')
    await expect(chatCard).toBeVisible()

    const chatBox = await chatCard.boundingBox()
    expect(chatBox).toBeTruthy()

    // Check that the center of the chat is owned by the chat, not the table
    const topElement = await page.evaluate(({ x, y }: { x: number, y: number }) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return null
      let current: Element | null = el
      while (current) {
        if (current.classList?.contains('ai-chat-panel') ||
            current.classList?.contains('ai-chat-card')) {
          return 'chat-panel'
        }
        current = current.parentElement
      }
      return el.tagName + '.' + el.className.toString().slice(0, 50)
    }, { x: chatBox!.x + chatBox!.width / 2, y: chatBox!.y + chatBox!.height / 2 })

    // Close chat
    const closeButton = page.locator('.ai-chat-card').getByRole('button').filter({
      has: page.locator('.mdi-close'),
    })
    await closeButton.click()
  })
})
