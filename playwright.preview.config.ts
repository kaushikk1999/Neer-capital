import { defineConfig, devices } from '@playwright/test';

// Config for running the SMOKE suite against a deployed preview/production URL.
// Usage: PREVIEW_URL=https://<deployment> npx playwright test --config=playwright.preview.config.ts
// No webServer — targets a remote deployment. Enforces HTTPS for non-localhost.
const baseURL = process.env.PREVIEW_URL || 'http://localhost:3100';
if (!/^https:/.test(baseURL) && !baseURL.includes('localhost')) {
  throw new Error(`PREVIEW_URL must use HTTPS for remote deployments, got: ${baseURL}`);
}

export default defineConfig({
  testDir: './tests',
  testMatch: /smoke\.spec\.ts/,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
