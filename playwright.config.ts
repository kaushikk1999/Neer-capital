import { defineConfig, devices } from '@playwright/test';

// E2E config for interaction verification against the PRODUCTION build.
// `next build` must have run first; webServer boots `next start` on :3000.
export default defineConfig({
  testDir: './tests',
  testIgnore: /smoke\.spec\.ts/, // smoke runs post-deploy via playwright.preview.config.ts
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    // Production build on a dedicated port to avoid a stray dev server on :3000.
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
