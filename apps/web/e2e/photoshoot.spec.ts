import { test, expect } from '@playwright/test';

test.describe('Photoshoot Mode', () => {
  test('photoshoot page renders with wizard', async ({ page }) => {
    await page.goto('/tenant/generate/photoshoot');
    await expect(page.getByRole('heading', { name: /photoshoot mode/i })).toBeVisible();
  });

  test('shows 4-step indicator', async ({ page }) => {
    await page.goto('/tenant/generate/photoshoot');
    await expect(page.getByText('Select')).toBeVisible();
    await expect(page.getByText('Configure')).toBeVisible();
    await expect(page.getByText('Schedule')).toBeVisible();
    await expect(page.getByText('Review')).toBeVisible();
  });

  test('shows model and background selection sections', async ({ page }) => {
    await page.goto('/tenant/generate/photoshoot');
    await expect(page.getByText('Models (required)')).toBeVisible();
    await expect(page.getByText('Backgrounds (required)')).toBeVisible();
  });
});

test.describe('Exports', () => {
  test('homepage editor page renders', async ({ page }) => {
    await page.goto('/admin/homepage-editor');
    await expect(page.getByRole('heading', { name: /homepage editor/i })).toBeVisible();
  });

  test('reporting dashboard page renders', async ({ page }) => {
    await page.goto('/admin/reporting');
    await expect(page.getByRole('heading', { name: /reporting dashboard/i })).toBeVisible();
  });
});
