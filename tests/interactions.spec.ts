import { test, expect, Page } from '@playwright/test';

// Fail any test whose page emits a console error or an uncaught page error.
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const ROUTES = ['/', '/about', '/sources', '/contact', '/embed'];

test.describe('routes', () => {
  for (const path of ROUTES) {
    test(`GET ${path} returns 200 with no console errors`, async ({ page }) => {
      const errors = trackErrors(page);
      const res = await page.goto(path, { waitUntil: 'networkidle' });
      expect(res?.status(), `status for ${path}`).toBe(200);
      expect(errors, `console/page errors on ${path}`).toEqual([]);
    });
  }
});

test('unknown route renders branded 404 (status 404, no console errors)', async ({ page }) => {
  const errors = trackErrors(page);
  const res = await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /could not be found/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  // A 404 route legitimately logs its own navigation 404 as a resource error
  // (Chromium/WebKit do, Firefox doesn't) — ignore that expected notice, catch anything else.
  const unexpected = errors.filter((e) => !/status of 404/.test(e));
  expect(unexpected).toEqual([]);
});

test.describe('desktop-only interactions', () => {
  test.skip(({ isMobile }) => !!isMobile, 'desktop nav is hidden on mobile');

  test('nav: Solutions scrolls to the (newly added) #solutions section', async ({ page }) => {
    await page.goto('/');
    await page.locator('header').getByRole('link', { name: 'Solutions' }).click();
    await expect(page).toHaveURL(/#solutions$/);
    const section = page.locator('#solutions');
    await expect(section).toBeVisible();
    await expect(section.getByText('Investment teams')).toBeVisible();
  });


});

test.describe('footer links (were all href="/")', () => {
  const expected: Record<string, RegExp> = {
    Product: /\/#product$/, Pricing: /\/#pricing$/,
    About: /\/about$/, Contact: /\/contact$/, Sources: /\/sources$/,
  };
  for (const [label, href] of Object.entries(expected)) {
    test(`footer "${label}" points to a real target`, async ({ page }) => {
      await page.goto('/');
      const link = page.locator('footer').getByRole('link', { name: label, exact: true });
      await expect(link).toHaveAttribute('href', href);
    });
  }
});

test('FAQ accordion toggles open/closed', async ({ page }) => {
  await page.goto('/');
  const second = page.getByRole('button', { name: /multilingual research workflows/i });
  await expect(second).toHaveAttribute('aria-expanded', 'false');
  await second.click();
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  await second.click();
  await expect(second).toHaveAttribute('aria-expanded', 'false');
});

test.describe('mobile menu', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile drawer only');

  test('opens, navigates, and closes on link tap', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.click();
    // Scope to the header drawer (footer also has an "About" link).
    const drawerAbout = page.locator('header').getByRole('link', { name: 'About' });
    await expect(drawerAbout).toBeVisible();
    await drawerAbout.tap();
    await expect(page).toHaveURL(/\/about$/);
    // Drawer collapses (display:none) after navigation + setOpen(false).
    await expect(page.locator('header').getByRole('link', { name: 'About' })).toHaveCount(0);
  });
});
