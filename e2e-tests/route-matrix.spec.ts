import { expect, test } from '@playwright/test'
import { mockRouteScenarios } from './scenarios/mock-routes'

for (const scenario of mockRouteScenarios) {
  test(`mock route: ${scenario.id}`, async ({ page }, testInfo) => {
    const enterprise = scenario.scope.startsWith('enterprise')
    const team = 'team' in scenario ? scenario.team : undefined
    const parentPath = `/${enterprise ? 'enterprises' : 'orgs'}/${scenario.owner}`
    const routePath = `${parentPath}${team ? `/teams/${team}` : ''}?mock=true`
    const title = `Copilot Metrics Viewer | ${enterprise ? 'Enterprise' : 'Organization'} : ${scenario.owner}${team ? ` | Team : ${team}` : ''}`
    const origin = new URL(testInfo.project.use.baseURL!).origin
    const pageErrors: string[] = []
    const serverErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('response', response => {
      if (new URL(response.url()).origin === origin && response.status() >= 400) {
        serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`)
      }
    })

    // Only the owned mock server is needed; do not make browser-side provider requests.
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      return url.origin === origin
        ? route.continue()
        : route.abort()
    })

    const response = await page.goto(routePath)
    expect(response?.ok(), 'document navigation succeeds').toBe(true)
    await expect(page).toHaveURL(new URL(routePath, testInfo.project.use.baseURL).href)
    await expect(page).toHaveTitle(title)
    await expect(page.locator('.toolbar-title')).toHaveText(title)
    await expect(page.getByRole('tab', {
      name: team ? 'team' : enterprise ? 'enterprise' : 'organization',
      exact: true,
    })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Using mock data - see README if unintended', { exact: true })).toBeVisible()

    const completions = page.locator('.v-card-item').filter({
      has: page.getByText('Total IDE Code Completions', { exact: true }),
    }).locator('.kpi-value-sm')
    await expect(completions).toBeVisible()
    await expect(completions).toContainText(/\d/)
    expect(Number((await completions.innerText()).replaceAll(',', ''))).toBeGreaterThan(0)
    await expect(page.locator('canvas').first()).toBeVisible()

    if (team) {
      await expect(page.getByText(`👥 Team Dashboard: ${team}`, { exact: true })).toBeVisible()
      const scopeBanner = page.getByRole('alert').filter({ hasText: 'All metrics are scoped to team' })
      await expect(scopeBanner.locator('strong')).toHaveText(team)
      await expect(scopeBanner.getByRole('link', { name: `Return to ${scenario.owner} organization view` }))
        .toHaveAttribute('href', parentPath)
    } else {
      await expect(page.getByText('All metrics are scoped to team', { exact: false })).toHaveCount(0)
    }

    await page.waitForLoadState('networkidle')
    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(serverErrors, 'no failed local API or asset responses').toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`${scenario.id}.png`), fullPage: true })
  })
}
