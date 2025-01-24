import { expect, test } from '@playwright/test'

const tag = { tag: ['@ent'] }


test('has title', tag, async ({ page }) => {
  await page.goto('/enterprises/octo-demo-ent');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Copilot Metrics Viewer \| Enterprise : octo-demo-ent/);
  await expect(page.locator(".toolbar-title")).toHaveText(/Copilot Metrics Viewer \| Enterprise : octo-demo-ent/);
});

test('enterprise tab', tag, async ({ page }) => {
  await page.goto('/enterprises/octo-demo-ent');
  await expect(page.getByRole('tab', { name: 'enterprise' })).toBeVisible();
});