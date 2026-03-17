import { test, expect } from '@playwright/test';

test.describe('Admin Tenant Management', () => {
  test('tenant page renders with Create Tenant button', async ({ page }) => {
    await page.goto('/admin/tenants');

    await expect(
      page.getByRole('heading', { name: /tenant management/i }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: /create tenant/i }),
    ).toBeVisible();
  });

  test('Create Tenant button opens dialog', async ({ page }) => {
    await page.goto('/admin/tenants');

    await page.getByRole('button', { name: /create tenant/i }).click();

    await expect(
      page.getByRole('dialog', { name: /create tenant/i }),
    ).toBeVisible();
  });
});

test.describe('Admin Credit Costs', () => {
  test('credit costs page renders with form fields', async ({ page }) => {
    await page.goto('/admin/credit-costs');

    await expect(
      page.getByRole('heading', { name: /credit cost configuration/i }),
    ).toBeVisible();
  });
});

test.describe('Impersonation Banner', () => {
  test('dashboard layout renders without impersonation banner for normal users', async ({ page }) => {
    await page.goto('/admin/tenants');

    // The banner should NOT be visible (no impersonation claims)
    await expect(
      page.getByRole('status', { name: /impersonation active/i }),
    ).not.toBeVisible();
  });
});
