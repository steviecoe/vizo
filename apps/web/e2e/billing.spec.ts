import { test, expect } from '@playwright/test';

test.describe('Billing & Credits', () => {
  test('credits page renders with billing UI', async ({ page }) => {
    await page.goto('/tenant/credits');
    await expect(page.getByRole('heading', { name: /credits/i })).toBeVisible();
  });

  test('login page renders with branded form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to Vizo')).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('login page shows email/password and Google options', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('or sign in with email')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in$/i })).toBeVisible();
  });

  test('support page renders', async ({ page }) => {
    await page.goto('/tenant/support');
    await expect(page.getByRole('heading', { name: /support/i })).toBeVisible();
  });
});
