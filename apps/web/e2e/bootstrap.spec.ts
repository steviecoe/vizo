import { test, expect } from '@playwright/test';

test.describe('Admin Bootstrap Page', () => {
  test('renders the bootstrap page with sign-in form', async ({ page }) => {
    await page.goto('/admin/bootstrap');

    await expect(
      page.getByRole('heading', { name: /system bootstrap/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/one-time setup/i),
    ).toBeVisible();
  });

  test('shows email and password inputs', async ({ page }) => {
    await page.goto('/admin/bootstrap');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('shows sign-in button', async ({ page }) => {
    await page.goto('/admin/bootstrap');

    await expect(
      page.getByRole('button', { name: /sign in$/i }),
    ).toBeVisible();
  });

  test('shows Google sign-in option', async ({ page }) => {
    await page.goto('/admin/bootstrap');

    await expect(
      page.getByRole('button', { name: /google/i }),
    ).toBeVisible();
  });
});
