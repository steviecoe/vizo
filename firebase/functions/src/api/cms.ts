import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../services/firebase-admin';
import { requireAdmin, requireAuth, resolveEffectiveTenantId } from '../middleware/auth';
import { cmsArticleSchema } from '@vizo/shared';

// ─── Admin: Create Article ─────────────────────────────────

export async function createArticleHandler(request: CallableRequest) {
  requireAdmin(request);
  const uid = request.auth!.uid;

  const parsed = cmsArticleSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const articleRef = db.collection('cms/articles/items').doc();

  const article = {
    ...parsed.data,
    publishedAt: parsed.data.status === 'published' ? now : null,
    createdAt: now,
    createdBy: uid,
    updatedAt: now,
    updatedBy: uid,
  };

  await articleRef.set(article);

  return { id: articleRef.id, ...article };
}

export const createArticle = onCall(createArticleHandler);

// ─── Admin: Update Article ─────────────────────────────────

export async function updateArticleHandler(request: CallableRequest) {
  requireAdmin(request);
  const uid = request.auth!.uid;

  const { articleId, ...updateData } = request.data as { articleId: string; [key: string]: unknown };

  if (!articleId) {
    throw new HttpsError('invalid-argument', 'articleId is required');
  }

  const parsed = cmsArticleSchema.safeParse(updateData);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const docRef = db.doc(`cms/articles/items/${articleId}`);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new HttpsError('not-found', 'Article not found');
  }

  const existingData = doc.data()!;
  const now = new Date().toISOString();

  const updated = {
    ...parsed.data,
    publishedAt:
      parsed.data.status === 'published' && !existingData.publishedAt
        ? now
        : existingData.publishedAt,
    updatedAt: now,
    updatedBy: uid,
  };

  await docRef.update(updated);

  return { id: articleId, ...updated };
}

export const updateArticle = onCall(updateArticleHandler);

// ─── Admin: Delete Article ─────────────────────────────────

export async function deleteArticleHandler(request: CallableRequest) {
  requireAdmin(request);

  const { articleId } = request.data as { articleId: string };
  if (!articleId) {
    throw new HttpsError('invalid-argument', 'articleId is required');
  }

  const db = getDb();
  const docRef = db.doc(`cms/articles/items/${articleId}`);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new HttpsError('not-found', 'Article not found');
  }

  await docRef.delete();
  return { success: true };
}

export const deleteArticle = onCall(deleteArticleHandler);

// ─── Admin: List All Articles ──────────────────────────────

export async function listArticlesAdminHandler(request: CallableRequest) {
  requireAdmin(request);

  const db = getDb();
  const snapshot = await db
    .collection('cms/articles/items')
    .orderBy('createdAt', 'desc')
    .get();

  const articles = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { articles };
}

export const listArticlesAdmin = onCall(listArticlesAdminHandler);

// ─── Tenant: List Published Articles ───────────────────────

export async function listPublishedArticlesHandler(request: CallableRequest) {
  requireAuth(request);

  const { category } = (request.data || {}) as { category?: string };

  const db = getDb();
  // Single-field query avoids composite index requirement
  const snapshot = await db
    .collection('cms/articles/items')
    .where('status', '==', 'published')
    .get();

  let articles = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<{ id: string; category?: string; publishedAt?: string; [key: string]: unknown }>;

  if (category) {
    articles = articles.filter((a) => a.category === category);
  }

  // Sort by publishedAt descending in memory
  articles.sort((a, b) => {
    const dateA = a.publishedAt || '';
    const dateB = b.publishedAt || '';
    return dateB.localeCompare(dateA);
  });

  return { articles };
}

export const listPublishedArticles = onCall(listPublishedArticlesHandler);

// ─── Tenant: Get Single Article ────────────────────────────

export async function getArticleHandler(request: CallableRequest) {
  requireAuth(request);

  const { articleId } = request.data as { articleId: string };
  if (!articleId) {
    throw new HttpsError('invalid-argument', 'articleId is required');
  }

  const db = getDb();
  const doc = await db.doc(`cms/articles/items/${articleId}`).get();

  if (!doc.exists) {
    throw new HttpsError('not-found', 'Article not found');
  }

  const data = doc.data()!;
  if (data.status !== 'published') {
    throw new HttpsError('not-found', 'Article not found');
  }

  return { id: doc.id, ...data };
}

export const getArticle = onCall(getArticleHandler);
