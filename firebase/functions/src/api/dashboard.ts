import { onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';

export interface DashboardStats {
  creditBalance: number;
  totalGenerated: number;
  approvedImages: number;
  pendingImages: number;
  rejectedImages: number;
  totalProducts: number;
  recentLedger: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

export async function getTenantDashboardHandler(
  request: CallableRequest,
): Promise<DashboardStats> {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();

  if (!tenantDoc.exists) {
    throw new Error('Tenant not found');
  }

  const tenant = tenantDoc.data()!;
  const basePath = `tenants/${tenantId}`;

  // Run parallel queries for dashboard stats
  const [imagesSnap, productsSnap, ledgerSnap] = await Promise.all([
    db.collection(`${basePath}/generatedImages`).get(),
    db.collection(`${basePath}/products`).where('status', '==', 'active').get(),
    db
      .collection(`${basePath}/creditLedger`)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get(),
  ]);

  // Aggregate image statuses
  let approvedImages = 0;
  let pendingImages = 0;
  let rejectedImages = 0;

  for (const doc of imagesSnap.docs) {
    const status = doc.data().status as string;
    if (status === 'approved') approvedImages++;
    else if (status === 'waiting_approval') pendingImages++;
    else if (status === 'rejected') rejectedImages++;
  }

  const recentLedger = ledgerSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type as string,
      amount: data.amount as number,
      description: data.description as string,
      createdAt: data.createdAt as string,
    };
  });

  return {
    creditBalance: (tenant.creditBalance as number) ?? 0,
    totalGenerated: imagesSnap.size,
    approvedImages,
    pendingImages,
    rejectedImages,
    totalProducts: productsSnap.size,
    recentLedger,
  };
}

export const getTenantDashboard = onCall(getTenantDashboardHandler);
