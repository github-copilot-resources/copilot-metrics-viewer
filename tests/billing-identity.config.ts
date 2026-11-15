import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../app', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/billing-identity.integration.ts'] },
});
