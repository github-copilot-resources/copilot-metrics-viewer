import { test, expect } from '@playwright/test';

const tag = { tag: ['@ent', '@org', '@team'] }

test('metrics visible', tag, async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Acceptance Rate (by count)')).toBeVisible();
    await expect(page.getByText('Total count of Suggestions (Prompts)')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Total Lines Suggested | Total' })).toBeVisible();
});

test('data returned', tag, async ({ page }) => {
    await page.goto('/');

    // find card
    const acceptanceCard = page.locator('.v-card-item').filter({ has: page.getByText('Total Lines of code Suggested') });
    const linesAccepted = await acceptanceCard.locator('.text-h4').textContent();
    expect(linesAccepted).toBeDefined();
    expect(parseInt(linesAccepted as string)).toBeGreaterThan(0);

    await expect(page.getByText('Acceptance Rate (by count)')).toBeVisible();
    await expect(page.getByText('Total count of Suggestions (Prompts)')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Total Lines Suggested | Total' })).toBeVisible();
});

test('languages visible', tag, async ({ page }) => {
    await page.goto('/');

    await page.getByRole('tab', { name: 'languages' }).click();
    await expect(page.getByText('Top 5 Languages by accepted suggestions (prompts)')).toBeVisible();
});


test('editors visible', tag, async ({ page }) => {
    await page.goto('/');

    await page.getByRole('tab', { name: 'editors' }).click();
    await expect(page.getByText('Number of Editors')).toBeVisible();
});

test('seat analysis visible', tag, async ({ page }) => {
    await page.goto('/');

    await page.getByRole('tab', { name: 'seat analysis' }).click();
    await expect(page.getByText('Total Assigned')).toBeVisible();
});