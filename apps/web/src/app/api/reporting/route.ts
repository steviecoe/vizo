import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAdmin } from '../_lib/auth';
import { getDb } from '../_lib/admin';

const GEMINI_COST_PER_IMAGE_1K = 0.04;
const GEMINI_COST_PER_IMAGE_2K = 0.08;

function estimateAiCost(images1k: number, images2k: number): number {
  return (images1k * GEMINI_COST_PER_IMAGE_1K) + (images2k * GEMINI_COST_PER_IMAGE_2K);
}

function computeCreditsRevenue(totalCreditsSpent: number, avgPrice: number): number {
  return totalCreditsSpent * avgPrice;
}

function computeProfitMargin(revenue: number, aiCost: number): number {
  if (revenue === 0) return 0;
  return Math.round(((revenue - aiCost) / revenue) * 100);
}

async function getReportingData({ claims }: ActionContext) {
  requireAdmin(claims);

  const db = getDb();
  const tenantsSnapshot = await db.collection('tenants').get();
  const tenants = tenantsSnapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as { name: string; creditBalance: number }),
  }));

  const totalTenants = tenants.length;
  const totalCreditsInSystem = tenants.reduce((sum, t) => sum + (t.creditBalance || 0), 0);

  let totalImagesGenerated = 0;
  let totalImagesApproved = 0;
  let totalImagesRejected = 0;
  let totalJobs = 0;
  let totalCreditsSpent = 0;
  let images1k = 0;
  let images2k = 0;

  const tenantSummaries: Array<{
    id: string; name: string; creditBalance: number; totalGenerated: number; totalApproved: number;
  }> = [];

  const allLedgerEntries: Array<{
    tenantId: string; tenantName: string; type: string; amount: number; description: string; createdAt: string;
  }> = [];

  for (const tenant of tenants) {
    const imagesSnapshot = await db.collection(`tenants/${tenant.id}/generatedImages`).get();

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

    const jobsSnapshot = await db.collection(`tenants/${tenant.id}/generationJobs`).get();
    totalJobs += jobsSnapshot.size;

    const ledgerSnapshot = await db
      .collection(`tenants/${tenant.id}/creditLedger`)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    for (const doc of ledgerSnapshot.docs) {
      const data = doc.data();
      if (data.amount < 0) totalCreditsSpent += Math.abs(data.amount);
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

  allLedgerEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  tenantSummaries.sort((a, b) => b.totalGenerated - a.totalGenerated);

  const aiCost = estimateAiCost(images1k, images2k);
  const configDoc = await db.doc('platform/config/global/settings').get();
  const avgPricePerCredit = configDoc.exists
    ? (configDoc.data()?.defaultPricePerCredit as number) || 0.5
    : 0.5;

  const revenue = computeCreditsRevenue(totalCreditsSpent, avgPricePerCredit);
  const profitMargin = computeProfitMargin(revenue, aiCost);

  return {
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
}

export const POST = createRouteHandler({ getReportingData });
