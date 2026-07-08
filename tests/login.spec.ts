import { test, expect } from '@playwright/test';

test('login page renders and shows error on invalid credentials', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Check that the form exists
  await expect(page.locator('h1')).toHaveText('Welcome back');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();

  // Try logging in with dummy credentials
  await page.locator('input[type="email"]').fill('test@example.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.locator('button[type="submit"]').click();

  // Wait for and check the error message
  // The error message should appear in a div with text containing "Invalid" or similar
  await expect(page.locator('text=Invalid email or password')).toBeVisible();
});
