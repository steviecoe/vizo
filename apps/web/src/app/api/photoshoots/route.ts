import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, resolveEffectiveTenantId } from '../_lib/auth';
import { getDb } from '../_lib/admin';

async function listPhotoshoots({ claims }: ActionContext) {
  requireAuth(claims);
  const tenantId = resolveEffectiveTenantId(claims);
  const db = getDb();

  const snapshot = await db
    .collection(`tenants/${tenantId}/photoshoots`)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return { photoshoots: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
}

export const POST = createRouteHandler({ listPhotoshoots });
