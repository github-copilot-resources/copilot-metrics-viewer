import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },
  webServer: {
    command: '/api/docker-entrypoint.api/entrypoint.sh',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    cwd: '/api',
    stderr: 'pipe',
    stdout: 'pipe'
  },
});