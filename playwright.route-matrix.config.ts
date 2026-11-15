import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Keep browser/runtime scratch files inside this checkout, not a shared temp directory.
process.env.TMPDIR = resolve('.cache/route-matrix-runtime')
mkdirSync(process.env.TMPDIR, { recursive: true })

/**
 * Mock-only #331 slice; Chrome, Edge and credentialed/live runs are not covered.
 * Run from the repository root (no dotenv or inherited credentials):
 * env -i PATH="$PATH" HOME="$HOME" node node_modules/@playwright/test/cli.js test --config playwright.route-matrix.config.ts
 * Extend e2e-tests/scenarios/mock-routes.ts to add synthetic cases.
 */
export default defineConfig({
  testDir: './e2e-tests',
  testMatch: 'route-matrix.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  outputDir: 'test-results/route-matrix',
  use: {
    baseURL: 'http://127.0.0.1:3220',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
  }],
  webServer: {
    // No DB sentinel, OAuth settings, tokens, or user localhost:3000 service.
    command: [
      // Relative server scratch path avoids Unix-domain socket path-length limits.
      'env -i PATH="$PATH" HOME="$HOME" TMPDIR=.cache/route-matrix-runtime',
      // Also override the build-time config: auth-utils otherwise writes .env in dev.
      'NUXT_SESSION_PASSWORD=synthetic-mock-route-matrix-only-session-value',
      'NUXT_PUBLIC_IS_DATA_MOCKED=true',
      'NUXT_PUBLIC_USING_GITHUB_AUTH=false NUXT_PUBLIC_REQUIRE_AUTH=false',
      'NUXT_PUBLIC_SCOPE=organization',
      'NUXT_PUBLIC_GITHUB_ORG=matrix-default-org NUXT_PUBLIC_GITHUB_ENT=matrix-default-ent',
      `node -e '
        import("@nuxt/cli").then(({ runCommand }) => runCommand("dev",
          ["--no-fork", "--host", "127.0.0.1", "--port", "3220", "--dotenv", "/dev/null"],
          { overrides: {
            runtimeConfig: { session: { password: process.env.NUXT_SESSION_PASSWORD } },
            vite: { server: { fs: { allow: [process.cwd(), require("node:fs").realpathSync("node_modules")] } } }
          } }
        ));
      '`,
    ].join(' '),
    url: 'http://127.0.0.1:3220/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
