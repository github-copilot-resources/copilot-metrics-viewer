import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { isCI } from 'std-env'

// set the runtimeConfig values for the test
process.env.NUXT_PUBLIC_USING_GITHUB_AUTH = 'false'
process.env.NUXT_PUBLIC_IS_DATA_MOCKED = 'true'

export default defineConfig<ConfigOptions>({
    testDir: 'e2e-tests',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!isCI,
    /* Retry on CI only */
    retries: isCI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: isCI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: isCI ?
        [
            ['html', { open: 'never' }],
            ['github'],
            ['junit', { outputFile: 'results.xml' }]
        ] :
        [
            ['list'],
            ['html', { open: 'never' }]
        ],
    use: {
        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
        baseURL: 'http://localhost:3000',
        screenshot: 'on',
        nuxt: {
            rootDir: fileURLToPath(new URL('.', import.meta.url)),
        }
    },
    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },

        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],

    webServer: {
        command: process.env.RUN_COMMAND || 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
      },
})
