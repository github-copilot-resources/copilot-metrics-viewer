import { test, expect } from '@playwright/test';

const tag = { tag: ['@ent'] }


test('has title', tag, async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/copilot-metrics-viewer/);
  await expect(page.locator(".toolbar-title")).toHaveText(/Copilot Metrics Viewer \| Enterprise : octodemo/);
});

test('enterprise tab', tag, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'enterprise' })).toBeVisible();
});