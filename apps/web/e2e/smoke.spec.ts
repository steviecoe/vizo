import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads and shows title', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Vizo Image Gen' })).toBeVisible();
  });

  test('homepage shows subtitle', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('AI-powered fashion photography platform')).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });
});
