import { defineConfig } from 'vitest/config';

const noEnv = { envFile: false as const };
export default defineConfig({
  ...noEnv,
  test: { environment: 'node', env: {}, include: ['tests/billing-user-page.integration.ts'] },
});
