import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

export default defineConfig<ConfigOptions>({
  ...baseConfig,
  timeout: 30 * 1000, // Increase timeout to 30 seconds
  expect: {
    timeout: 10 * 1000, // 10 seconds for expect assertions
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '/test-results/html' }],
    ['github'],
    ['junit', { outputFile: '/test-results/junit/results.xml' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ]
        }
      }
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ]
        }
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari']
      },
    },
  ],
  webServer: {
    command: 'node /app/server/index.mjs',
    url: 'http://127.0.0.1:3000',
    cwd: '/app',
    reuseExistingServer: false,
    stderr: 'pipe',
    stdout: 'pipe'
  },
});