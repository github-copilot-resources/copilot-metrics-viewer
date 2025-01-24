import { expect, test } from '@playwright/test'

const tag = { tag: ['@org'] }

test('has title', tag, async ({ page }) => {
  await page.goto('/orgs/octo-demo-org');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Copilot Metrics Viewer \| Organization : octo-demo-org/);
  await expect(page.locator(".toolbar-title")).toHaveText(/Copilot Metrics Viewer \| Organization : octo-demo-org/);
});

test('organization tab', tag, async ({ page }) => {
  await page.goto('/orgs/octo-demo-org');
  await expect(page.getByRole('tab', { name: 'organization' })).toBeVisible();
});