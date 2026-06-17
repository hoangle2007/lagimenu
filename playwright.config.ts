/**
 * Playwright E2E configuration
 *
 * Assumes both backend (port 3001) and frontend (default 3000 — see packages/frontend/vite.config.ts, VITE_DEV_PORT) are running.
 * Run tests with: npx playwright test
 *
 * Tip: Start servers before running tests:
 *   # Terminal 1 — backend
 *   cd packages/backend && npm run dev
 *   # Terminal 2 — frontend
 *   cd packages/frontend && npm run dev
 *   # Terminal 3 — tests
 *   npx playwright test
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  /* Web server config is intentionally omitted — tests expect servers to be
   * running already. Use one of the following to start them:
   *
   *   # Option A — start both manually (recommended for local dev)
   *   cd packages/backend && npm run dev &
   *   cd packages/frontend && npm run dev &
   *
   *   # Option B — use a compound npm script (add to root package.json):
   *   "dev:all": "concurrently \"cd packages/backend && npm run dev\" \"cd packages/frontend && npm run dev\""
   *
   *   # Option C — use webServer config per process (uncomment below):
   *
   *   webServer: {
   *     command: 'cd packages/backend && npm run dev',
   *     port: 3001,
   *     reuseExistingServer: true,
   *   },
   *   webServer2: {
   *     command: 'cd packages/frontend && npm run dev',
   *     port: 3000,
   *     reuseExistingServer: true,
   *   },
   */
})
