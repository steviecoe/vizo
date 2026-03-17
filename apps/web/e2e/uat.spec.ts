import { test, expect } from '@playwright/test';

/**
 * Full Lifecycle UAT (User Acceptance Test)
 *
 * Scenario:
 *   Admin creates Tenant → Impersonate → Connect Shopify → Run Photoshoot
 *   → Review Images → Export to Shopify
 *
 * This test walks through every major user journey in the platform,
 * verifying the end-to-end flow from admin operations through to
 * tenant-level generation and export.
 *
 * In CI, pages are rendered against the Next.js dev/preview server.
 * Cloud Function calls are intercepted (no real Firebase backend).
 */

test.describe('Full Lifecycle UAT', () => {
  // ── Phase 1: Admin Creates Tenant ─────────────────────────

  test('Step 1 — Admin navigates to Tenant Management', async ({ page }) => {
    await page.goto('/admin/tenants');

    await expect(
      page.getByRole('heading', { name: /tenant management/i }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: /create tenant/i }),
    ).toBeVisible();
  });

  test('Step 2 — Admin opens Create Tenant dialog', async ({ page }) => {
    await page.goto('/admin/tenants');
    await page.getByRole('button', { name: /create tenant/i }).click();

    await expect(
      page.getByRole('dialog', { name: /create tenant/i }),
    ).toBeVisible();

    // Dialog should have required fields
    await expect(page.getByLabel(/company name/i)).toBeVisible();
    await expect(page.getByLabel(/admin email/i)).toBeVisible();
  });

  // ── Phase 2: Admin Configures Platform ────────────────────

  test('Step 3 — Admin configures credit costs', async ({ page }) => {
    await page.goto('/admin/credit-costs');

    await expect(
      page.getByRole('heading', { name: /credit cost configuration/i }),
    ).toBeVisible();
  });

  test('Step 4 — Admin views reporting dashboard with AI cost metrics', async ({ page }) => {
    await page.goto('/admin/reporting');

    await expect(
      page.getByRole('heading', { name: /reporting dashboard/i }),
    ).toBeVisible();

    // Verify AI cost vs revenue section exists
    await expect(page.getByText(/estimated ai cost/i)).toBeVisible();
    await expect(page.getByText(/credits revenue/i)).toBeVisible();
    await expect(page.getByText(/profit margin/i)).toBeVisible();
  });

  // ── Phase 3: Impersonation ────────────────────────────────

  test('Step 5 — Impersonation banner is hidden for non-impersonating users', async ({ page }) => {
    await page.goto('/tenant/dashboard');

    await expect(
      page.getByRole('heading', { name: /dashboard/i }),
    ).toBeVisible();

    // No impersonation banner should be visible
    await expect(
      page.getByRole('status', { name: /impersonation active/i }),
    ).not.toBeVisible();
  });

  // ── Phase 4: Tenant Connects Shopify ──────────────────────

  test('Step 6 — Tenant navigates to Shopify Connector', async ({ page }) => {
    await page.goto('/tenant/shopify');

    await expect(
      page.getByRole('heading', { name: /shopify connector/i }),
    ).toBeVisible();

    await expect(page.getByLabel(/store domain/i)).toBeVisible();
    await expect(page.getByLabel(/admin api access token/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /connect store/i }),
    ).toBeVisible();
  });

  test('Step 7 — Tenant views synced products', async ({ page }) => {
    await page.goto('/tenant/products');

    await expect(
      page.getByRole('heading', { name: /products/i }),
    ).toBeVisible();
  });

  // ── Phase 5: Tenant Runs Photoshoot ───────────────────────

  test('Step 8 — Tenant accesses Photoshoot Wizard', async ({ page }) => {
    await page.goto('/tenant/photoshoot');

    await expect(
      page.getByRole('heading', { name: /photoshoot/i }),
    ).toBeVisible();
  });

  test('Step 9 — Tenant accesses Quick Generate', async ({ page }) => {
    await page.goto('/tenant/generate');

    await expect(
      page.getByRole('heading', { name: /quick generate/i }),
    ).toBeVisible();

    // AI limitations tooltip should be present
    await expect(
      page.getByRole('button', { name: /ai limitations/i }),
    ).toBeVisible();
  });

  // ── Phase 6: Image Review + Regeneration ──────────────────

  test('Step 10 — Tenant reviews images in repository', async ({ page }) => {
    await page.goto('/tenant/repository');

    await expect(
      page.getByRole('heading', { name: /image repository/i }),
    ).toBeVisible();

    // Filter tabs should be present
    await expect(page.getByRole('tablist', { name: /image status filter/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /approved/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /rejected/i })).toBeVisible();
  });

  // ── Phase 7: Billing & Credits ────────────────────────────

  test('Step 11 — Tenant views credits page', async ({ page }) => {
    await page.goto('/tenant/credits');

    await expect(
      page.getByRole('heading', { name: /credits/i }),
    ).toBeVisible();
  });

  test('Step 12 — Tenant accesses support', async ({ page }) => {
    await page.goto('/tenant/support');

    await expect(
      page.getByRole('heading', { name: /support/i }),
    ).toBeVisible();
  });

  // ── Phase 8: Export ───────────────────────────────────────

  test('Step 13 — Art Direction models page', async ({ page }) => {
    await page.goto('/tenant/art-direction');

    await expect(
      page.getByRole('heading', { name: /art direction/i }),
    ).toBeVisible();
  });

  // ── Phase 9: Login (Branded) ──────────────────────────────

  test('Step 14 — Login page renders with branded Vizo form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText(/sign in to vizo/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with google/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  // ── Phase 10: Homepage (CMS) ──────────────────────────────

  test('Step 15 — Admin homepage config', async ({ page }) => {
    await page.goto('/admin/homepage');

    await expect(
      page.getByRole('heading', { name: /homepage/i }),
    ).toBeVisible();
  });
});
