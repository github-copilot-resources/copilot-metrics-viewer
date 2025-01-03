import { test, expect } from '@playwright/test';

const tag = { tag: ['@ent'] }


test('has title', tag, async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/copilot-metrics-viewer/);
  await expect(page.locator(".toolbar-title")).toHaveText(/Copilot Metrics Viewer \| Enterprise : octodemo/);
});

test('metrics visible', tag, async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Acceptance Rate Average')).toBeVisible();
  await expect(page.getByText('Cumulative Number of Suggestions')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Total Lines Suggested | Total' })).toBeVisible();
  await page.getByRole('tab', { name: 'languages' }).click();
  await expect(page.getByText('Top 5 Languages by acceptance')).toBeVisible();
  await page.getByRole('tab', { name: 'editors' }).click();
  await expect(page.getByText('Number of Editors')).toBeVisible();
  await page.getByRole('tab', { name: 'seat analysis' }).click();
  await expect(page.getByText('Total Assigned')).toBeVisible();
});

test('enterprise tab', tag, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'enterprise' })).toBeVisible();
});