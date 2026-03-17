import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { getDb, getStorage } from '../services/firebase-admin';
import { getSecret, buildTenantShopifySecretName } from '../services/secret-manager';
import { uploadImageToShopify } from '../services/shopify-export-service';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

// ─── Schemas ───────────────────────────────────────────────

const pushImageSchema = z.object({
  imageId: z.string().min(1),
});

const bulkDownloadSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(1).max(100),
});

// ─── Push Image to Shopify Handler ─────────────────────────

export async function pushImageToShopifyHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);
  const uid = request.auth!.uid;

  const parsed = pushImageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const { imageId } = parsed.data;
  const db = getDb();

  // 1. Load image document
  const imageDoc = await db
    .doc(`tenants/${tenantId}/generatedImages/${imageId}`)
    .get();
  if (!imageDoc.exists) {
    throw new HttpsError('not-found', 'Image not found');
  }

  const image = imageDoc.data()!;

  if (image.status !== 'approved') {
    throw new HttpsError(
      'failed-precondition',
      'Only approved images can be exported to Shopify',
    );
  }

  if (!image.productId) {
    throw new HttpsError(
      'failed-precondition',
      'Image is not linked to a product',
    );
  }

  // 2. Load the product to get Shopify product ID
  const productDoc = await db
    .doc(`tenants/${tenantId}/products/${image.productId}`)
    .get();
  if (!productDoc.exists) {
    throw new HttpsError('not-found', 'Linked product not found');
  }

  const product = productDoc.data()!;

  // 3. Load tenant Shopify config
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  const tenant = tenantDoc.data()!;

  if (!tenant.shopify?.storeDomain) {
    throw new HttpsError(
      'failed-precondition',
      'Shopify is not connected for this tenant',
    );
  }

  // 4. Get Shopify API key from Secret Manager
  const accessToken = await getSecret(buildTenantShopifySecretName(tenantId));

  // 5. Download image from Storage
  const bucket = getStorage().bucket();
  const file = bucket.file(image.storageUrl);
  const [buffer] = await file.download();
  const imageBase64 = buffer.toString('base64');

  // 6. Mark as exporting
  await imageDoc.ref.update({ shopifyExportStatus: 'exporting' });

  // 7. Upload to Shopify
  try {
    const result = await uploadImageToShopify(
      tenant.shopify.storeDomain,
      accessToken,
      product.shopifyProductId,
      imageBase64,
      `vizo-${imageId}.png`,
      `AI generated image for ${product.title}`,
    );

    // 8. Update image doc with Shopify reference
    await imageDoc.ref.update({
      shopifyExportStatus: 'exported',
      shopifyImageId: result.shopifyImageId,
      exportedAt: new Date().toISOString(),
      exportedBy: uid,
    });

    return {
      success: true,
      shopifyImageId: result.shopifyImageId,
      shopifyImageUrl: result.src,
    };
  } catch (error) {
    await imageDoc.ref.update({ shopifyExportStatus: 'not_exported' });
    const message = error instanceof Error ? error.message : 'Export failed';
    throw new HttpsError('internal', message);
  }
}

// ─── Bulk Download Images Handler ──────────────────────────

export async function bulkDownloadImagesHandler(request: CallableRequest) {
  const claims = requireAuth(request);
  const tenantId = resolveEffectiveTenantId(claims);

  const parsed = bulkDownloadSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const { imageIds } = parsed.data;
  const db = getDb();
  const bucket = getStorage().bucket();

  // 1. Load and validate all images
  const images: Array<{ id: string; storageUrl: string; productTitle: string }> = [];

  for (const id of imageIds) {
    const doc = await db.doc(`tenants/${tenantId}/generatedImages/${id}`).get();
    if (!doc.exists) continue;

    const data = doc.data()!;
    if (data.status !== 'approved') continue;

    let productTitle = 'unknown';
    if (data.productId) {
      const pDoc = await db.doc(`tenants/${tenantId}/products/${data.productId}`).get();
      if (pDoc.exists) productTitle = pDoc.data()!.title || 'product';
    }

    images.push({ id: doc.id, storageUrl: data.storageUrl, productTitle });
  }

  if (images.length === 0) {
    throw new HttpsError('failed-precondition', 'No approved images found to download');
  }

  // 2. Create ZIP in memory and upload to Storage
  const zipPath = `tenants/${tenantId}/downloads/bulk-${Date.now()}.zip`;
  const zipFile = bucket.file(zipPath);
  const passThrough = new PassThrough();
  const writeStream = zipFile.createWriteStream({
    metadata: { contentType: 'application/zip' },
  });

  const archive = archiver.create('zip', { zlib: { level: 5 } });
  archive.pipe(passThrough);
  passThrough.pipe(writeStream);

  // 3. Add each image to the ZIP
  for (const img of images) {
    const file = bucket.file(img.storageUrl);
    const [buffer] = await file.download();
    const safeName = img.productTitle.replace(/[^a-zA-Z0-9-_ ]/g, '');
    archive.append(buffer, { name: `${safeName}-${img.id}.png` });
  }

  await archive.finalize();

  // Wait for upload to complete
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // 4. Generate signed URL (valid for 1 hour)
  const [signedUrl] = await zipFile.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });

  return {
    downloadUrl: signedUrl,
    imageCount: images.length,
    zipPath,
  };
}

// ─── Exports ───────────────────────────────────────────────

export const bulkDownloadImages = onCall(
  { timeoutSeconds: 120, region: 'europe-west4' },
  bulkDownloadImagesHandler,
);
