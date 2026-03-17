import { test, expect } from '@playwright/test';

test.describe('Shopify Connector', () => {
  test('shopify page renders with connection form', async ({ page }) => {
    await page.goto('/tenant/shopify');

    await expect(
      page.getByRole('heading', { name: /shopify connector/i }),
    ).toBeVisible();
  });

  test('store domain and API key fields are present', async ({ page }) => {
    await page.goto('/tenant/shopify');

    await expect(page.getByLabel(/store domain/i)).toBeVisible();
    await expect(page.getByLabel(/admin api access token/i)).toBeVisible();
  });

  test('API key field uses password type', async ({ page }) => {
    await page.goto('/tenant/shopify');

    const apiKeyInput = page.getByLabel(/admin api access token/i);
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('connect store button is present', async ({ page }) => {
    await page.goto('/tenant/shopify');

    await expect(
      page.getByRole('button', { name: /connect store/i }),
    ).toBeVisible();
  });
});

test.describe('Product Grid', () => {
  test('products page renders', async ({ page }) => {
    await page.goto('/tenant/products');

    await expect(
      page.getByRole('heading', { name: /products/i }),
    ).toBeVisible();
  });
});

test.describe('Image Repository', () => {
  test('repository page renders', async ({ page }) => {
    await page.goto('/tenant/repository');

    await expect(
      page.getByRole('heading', { name: /image repository/i }),
    ).toBeVisible();
  });
});

test.describe('Tenant Dashboard', () => {
  test('dashboard page renders', async ({ page }) => {
    await page.goto('/tenant/dashboard');

    await expect(
      page.getByRole('heading', { name: /dashboard/i }),
    ).toBeVisible();
  });
});
