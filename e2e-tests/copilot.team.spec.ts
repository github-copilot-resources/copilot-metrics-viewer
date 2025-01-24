import { expect, test } from '@playwright/test'

const tag = { tag: ['@team'] }

test('has title', tag, async ({ page }) => {
  await page.goto('/orgs/octo-demo-org/team/the-a-team');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Copilot Metrics Viewer \| Organization : octo-demo-org \| Team : the-a-team/);
  await expect(page.locator(".toolbar-title")).toHaveText(/Copilot Metrics Viewer \| Organization : octo-demo-org \| Team : the-a-team/);
});

test('team tab', tag, async ({ page }) => {
  await page.goto('/orgs/octo-demo-org/team/the-a-team');
  await expect(page.getByRole('tab', { name: 'team' })).toBeVisible();
});