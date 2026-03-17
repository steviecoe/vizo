import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { requireAdmin } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';
import {
  estimateAiCost,
  computeCreditsRevenue,
  computeProfitMargin,
} from '../services/cost-calculator';

// ─── Types ─────────────────────────────────────────────────

interface TenantSummary {
  id: string;
  name: string;
  creditBalance: number;
  totalGenerated: number;
  totalApproved: number;
}

interface ReportingData {
  totalTenants: number;
  totalCreditsInSystem: number;
  totalCreditsSpent: number;
  totalImagesGenerated: number;
  totalImagesApproved: number;
  totalImagesRejected: number;
  totalJobs: number;
  images1k: number;
  images2k: number;
  estimatedAiCost: number;
  creditsRevenue: number;
  profitMargin: number;
  recentLedgerEntries: Array<{
    tenantId: string;
    tenantName: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
  topTenants: TenantSummary[];
}

// ─── Handler ───────────────────────────────────────────────

export async function getReportingDataHandler(request: CallableRequest) {
  requireAdmin(request);

  const db = getDb();

  // 1. Load all tenants
  const tenantsSnapshot = await db.collection('tenants').get();
  const tenants = tenantsSnapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as { name: string; creditBalance: number }),
  }));

  const totalTenants = tenants.length;
  const totalCreditsInSystem = tenants.reduce(
    (sum, t) => sum + (t.creditBalance || 0),
    0,
  );

  // 2. Aggregate image stats and job counts across all tenants
  let totalImagesGenerated = 0;
  let totalImagesApproved = 0;
  let totalImagesRejected = 0;
  let totalJobs = 0;
  let totalCreditsSpent = 0;
  let images1k = 0;
  let images2k = 0;

  const tenantSummaries: TenantSummary[] = [];
  const allLedgerEntries: Array<{
    tenantId: string;
    tenantName: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }> = [];

  for (const tenant of tenants) {
    // Image stats
    const imagesSnapshot = await db
      .collection(`tenants/${tenant.id}/generatedImages`)
      .get();

    let tenantGenerated = 0;
    let tenantApproved = 0;

    for (const doc of imagesSnapshot.docs) {
      const data = doc.data();
      tenantGenerated++;
      if (data.status === 'approved') tenantApproved++;
      if (data.status === 'rejected') totalImagesRejected++;
      if (data.resolution === '2k') images2k++;
      else images1k++;
    }

    totalImagesGenerated += tenantGenerated;
    totalImagesApproved += tenantApproved;

    // Job count
    const jobsSnapshot = await db
      .collection(`tenants/${tenant.id}/generationJobs`)
      .get();
    totalJobs += jobsSnapshot.size;

    // Credit spend from ledger
    const ledgerSnapshot = await db
      .collection(`tenants/${tenant.id}/creditLedger`)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    for (const doc of ledgerSnapshot.docs) {
      const data = doc.data();
      if (data.amount < 0) {
        totalCreditsSpent += Math.abs(data.amount);
      }
      allLedgerEntries.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        type: data.type,
        amount: data.amount,
        description: data.description,
        createdAt: data.createdAt,
      });
    }

    tenantSummaries.push({
      id: tenant.id,
      name: tenant.name,
      creditBalance: tenant.creditBalance || 0,
      totalGenerated: tenantGenerated,
      totalApproved: tenantApproved,
    });
  }

  // 3. Sort recent entries by date, top tenants by generation count
  allLedgerEntries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  tenantSummaries.sort((a, b) => b.totalGenerated - a.totalGenerated);

  // 4. Calculate AI cost vs revenue
  const aiCost = estimateAiCost(images1k, images2k);

  // Derive average price per credit from platform config or tenant averages
  const configDoc = await db.doc('platform/config/global/settings').get();
  const avgPricePerCredit = configDoc.exists
    ? (configDoc.data()?.defaultPricePerCredit as number) || 0.5
    : 0.5;

  const revenue = computeCreditsRevenue(totalCreditsSpent, avgPricePerCredit);
  const profitMargin = computeProfitMargin(revenue, aiCost);

  const report: ReportingData = {
    totalTenants,
    totalCreditsInSystem,
    totalCreditsSpent,
    totalImagesGenerated,
    totalImagesApproved,
    totalImagesRejected,
    totalJobs,
    images1k,
    images2k,
    estimatedAiCost: Math.round(aiCost * 100) / 100,
    creditsRevenue: Math.round(revenue * 100) / 100,
    profitMargin,
    recentLedgerEntries: allLedgerEntries.slice(0, 20),
    topTenants: tenantSummaries.slice(0, 10),
  };

  return report;
}

// ─── Exports ───────────────────────────────────────────────

export const getReportingData = onCall(getReportingDataHandler);
