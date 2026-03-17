import { test, expect } from '@playwright/test';

test.describe('Art Direction - Models', () => {
  test('model library page renders', async ({ page }) => {
    await page.goto('/tenant/art-direction/models');
    await expect(page.getByRole('heading', { name: /model library/i })).toBeVisible();
  });

  test('has Add Model button', async ({ page }) => {
    await page.goto('/tenant/art-direction/models');
    await expect(page.getByRole('button', { name: /add model/i })).toBeVisible();
  });
});

test.describe('Art Direction - Backgrounds', () => {
  test('background library page renders', async ({ page }) => {
    await page.goto('/tenant/art-direction/backgrounds');
    await expect(page.getByRole('heading', { name: /background library/i })).toBeVisible();
  });

  test('has Add Background button', async ({ page }) => {
    await page.goto('/tenant/art-direction/backgrounds');
    await expect(page.getByRole('button', { name: /add background/i })).toBeVisible();
  });
});

test.describe('Quick Generation', () => {
  test('quick gen page renders with wizard', async ({ page }) => {
    await page.goto('/tenant/generate/quick');
    await expect(page.getByRole('heading', { name: /quick generation/i })).toBeVisible();
  });

  test('shows step indicator', async ({ page }) => {
    await page.goto('/tenant/generate/quick');
    await expect(page.getByText('Select')).toBeVisible();
    await expect(page.getByText('Configure')).toBeVisible();
    await expect(page.getByText('Review')).toBeVisible();
  });
});
