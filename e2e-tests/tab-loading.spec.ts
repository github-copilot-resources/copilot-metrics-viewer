import { expect, test, type Page } from '@playwright/test';

const scenarios = [
    { tab: 'seat analysis', endpoint: 'seats', label: 'Total Assigned' },
    { tab: 'user metrics', endpoint: 'user-metrics', label: 'Total Users' },
] as const;

const seat = {
    login: 'loading-test-user', id: 1, team: '',
    created_at: '2026-01-01T00:00:00Z', last_activity_at: '2026-01-02T00:00:00Z',
    last_activity_editor: 'vscode', plan_type: 'business',
};
const user = {
    login: 'loading-test-user', user_id: 1, total_active_days: 10,
    code_generation_activity_count: 20, code_acceptance_activity_count: 10,
    user_initiated_interaction_count: 30, loc_added_sum: 20, loc_deleted_sum: 0,
    loc_suggested_to_add_sum: 40, loc_suggested_to_delete_sum: 0,
    totals_by_ide: [], totals_by_language_feature: [], totals_by_feature: [], totals_by_model_feature: [],
};

function payload(endpoint: string, empty: boolean) {
    return endpoint === 'seats'
        ? { seats: empty ? [] : [seat], total_seats: empty ? 0 : 1, page: 1, per_page: 300, total_pages: 1 }
        : empty ? [] : [user];
}

async function holdResponse(page: Page, endpoint: string, body: unknown, status = 200) {
    let release!: () => void;
    let requested!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const received = new Promise<void>(resolve => { requested = resolve; });
    await page.route(`**/api/${endpoint}?*`, async route => {
        requested();
        await gate;
        await route.fulfill({ status, json: body });
    });
    return { release, received };
}

function sharedLoading(page: Page) {
    return page.locator('.v-progress-linear:has(+ .v-window)');
}

for (const scenario of scenarios) {
    for (const empty of [false, true]) {
        test(`${scenario.tab}: pending, tab switch and ${empty ? 'empty' : 'success'}`, async ({ page }, testInfo) => {
            const held = await holdResponse(page, scenario.endpoint, payload(scenario.endpoint, empty));
            try {
                await page.goto('/orgs/octo-demo-org?mock=true', { waitUntil: 'domcontentloaded' });
                await held.received;
                await expect(page.getByText('Total IDE Code Completions', { exact: true })).toBeVisible();
                await expect(sharedLoading(page)).toBeHidden();
                await page.getByRole('tab', { name: scenario.tab, exact: true }).click();
                await expect(sharedLoading(page)).toBeVisible();
                await expect(sharedLoading(page)).toHaveAttribute('role', 'progressbar');
                await expect(page.getByRole('alert').filter({ hasText: 'No data available to display' })).toBeHidden();
                await page.screenshot({ path: testInfo.outputPath('pending.png'), fullPage: true });

                await page.getByRole('tab', { name: 'organization', exact: true }).click();
                await expect(sharedLoading(page)).toBeHidden();
                await expect(page.getByText('Total IDE Code Completions', { exact: true })).toBeVisible();
                await page.getByRole('tab', { name: scenario.tab, exact: true }).click();
                await expect(sharedLoading(page)).toBeVisible();

                held.release();
                await expect(sharedLoading(page)).toBeHidden();
                const tile = page.locator('.v-card-item').filter({
                    has: page.getByText(scenario.label, { exact: true }),
                }).locator('.kpi-value');
                await expect(tile).toHaveText(empty ? '0' : '1');
                const noData = page.getByRole('alert').filter({ hasText: 'No data available to display' });
                if (empty) await expect(noData).toBeVisible();
                else await expect(noData).toBeHidden();
                await page.screenshot({ path: testInfo.outputPath('resolved.png'), fullPage: true });

                await page.getByRole('tab', { name: 'organization', exact: true }).click();
                await expect(page.getByText('Total IDE Code Completions', { exact: true })).toBeVisible();
                await page.getByRole('tab', { name: scenario.tab, exact: true }).click();
                await expect(sharedLoading(page)).toBeHidden();
                await expect(tile).toHaveText(empty ? '0' : '1');
            } finally {
                held.release();
            }
        });
    }

    test(`${scenario.tab}: failed request leaves loading and shows an error`, async ({ page }, testInfo) => {
        const held = await holdResponse(page, scenario.endpoint, {
            statusCode: 500, statusMessage: 'Synthetic loading regression failure',
        }, 500);
        try {
            await page.goto('/orgs/octo-demo-org?mock=true', { waitUntil: 'domcontentloaded' });
            await held.received;
            await page.getByRole('tab', { name: scenario.tab, exact: true }).click();
            await expect(sharedLoading(page)).toBeVisible();
            const failedResponse = page.waitForResponse(response =>
                new URL(response.url()).pathname === `/api/${scenario.endpoint}` && response.status() === 500);
            held.release();
            expect((await failedResponse).status()).toBe(500);
            await expect(page.getByRole('alert').filter({ hasText: '500 Internal Server Error' })).toBeVisible();
            await expect(sharedLoading(page)).toBeHidden();
            await expect(page.getByRole('alert').filter({ hasText: 'No data available to display' })).toBeHidden();
            await page.screenshot({ path: testInfo.outputPath('error.png'), fullPage: true });
            if (scenario.endpoint === 'user-metrics') {
                await expect(page.getByText('Total Users', { exact: true })).toBeHidden();
                await expect(page.getByText('Synthetic loading regression failure', { exact: false })).toBeHidden();
                await page.getByRole('tab', { name: 'organization', exact: true }).click();
                await expect(page.getByRole('alert').filter({ hasText: '500 Internal Server Error' })).toBeHidden();
                await expect(page.getByText('Total IDE Code Completions', { exact: true })).toBeVisible();
                await page.getByRole('tab', { name: scenario.tab, exact: true }).click();
                await expect(page.getByRole('alert').filter({ hasText: '500 Internal Server Error' })).toBeVisible();
                await expect(sharedLoading(page)).toBeHidden();
            }
        } finally {
            held.release();
        }
    });
}

test('user metrics: date reload failure and successful retry clear the error', async ({ page }, testInfo) => {
    await page.route('**/api/user-metrics?*', route => route.fulfill({ json: [user] }));
    await page.goto('/orgs/octo-demo-org?mock=true', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Total IDE Code Completions', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'user metrics', exact: true }).click();
    const tile = page.locator('.v-card-item').filter({
        has: page.getByText('Total Users', { exact: true }),
    }).locator('.kpi-value');
    await expect(tile).toHaveText('1');
    await expect(sharedLoading(page)).toBeHidden();
    await page.getByRole('button', { name: 'Show date range' }).click();

    const failed = await holdResponse(page, 'user-metrics', {
        statusCode: 500, statusMessage: 'Synthetic loading regression failure',
    }, 500);
    try {
        const from = page.getByLabel('From Date');
        const nextDate = new Date(`${await from.inputValue()}T00:00:00Z`);
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        await from.fill(nextDate.toISOString().slice(0, 10));
        await page.getByRole('button', { name: 'Apply', exact: true }).click();
        await failed.received;
        await expect(sharedLoading(page)).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('reload-pending.png'), fullPage: true });
        const response = page.waitForResponse(response =>
            new URL(response.url()).pathname === '/api/user-metrics' && response.status() === 500);
        failed.release();
        expect((await response).status()).toBe(500);
        const error = page.getByRole('alert').filter({ hasText: '500 Internal Server Error' });
        await expect(error).toBeVisible();
        await expect(sharedLoading(page)).toBeHidden();
        await expect(tile).toBeHidden();
        await expect(page.getByRole('alert').filter({ hasText: 'No data available to display' })).toBeHidden();
        await page.screenshot({ path: testInfo.outputPath('reload-error.png'), fullPage: true });

        const retry = await holdResponse(page, 'user-metrics', [user]);
        try {
            await page.getByRole('button', { name: 'Apply', exact: true }).click();
            await retry.received;
            await expect(error).toBeHidden();
            await expect(sharedLoading(page)).toBeVisible();
            retry.release();
            await expect(sharedLoading(page)).toBeHidden();
            await expect(error).toBeHidden();
            await expect(tile).toHaveText('1');
            await page.screenshot({ path: testInfo.outputPath('retry-resolved.png'), fullPage: true });
        } finally {
            retry.release();
        }
    } finally {
        failed.release();
    }
});
