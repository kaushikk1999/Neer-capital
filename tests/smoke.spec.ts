import { test, expect } from '@playwright/test';

// Post-deploy smoke suite. Runs against the local prod build by default, or a
// deployed preview when PREVIEW_URL is set (see playwright.preview.config.ts).
const CORE = ['/', '/about', '/sources', '/contact'];

for (const path of CORE) {
  test(`smoke: ${path} responds 200 with security header`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    // Verifies next.config.js security headers survive the deployment.
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });
}

test('smoke: homepage renders hero heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
