import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, resolveEffectiveTenantId } from '../_lib/auth';
import { getDb } from '../_lib/admin';

async function getTenantDashboard({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);

  const db = getDb();
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantDoc.exists) throw new Error('Tenant not found');

  const tenant = tenantDoc.data()!;
  const basePath = `tenants/${tenantId}`;

  const [imagesSnap, productsSnap, ledgerSnap] = await Promise.all([
    db.collection(`${basePath}/generatedImages`).get(),
    db.collection(`${basePath}/products`).where('status', '==', 'active').get(),
    db.collection(`${basePath}/creditLedger`).orderBy('createdAt', 'desc').limit(10).get(),
  ]);

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

export const POST = createRouteHandler({ getTenantDashboard });
