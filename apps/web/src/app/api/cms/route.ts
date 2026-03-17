import { cmsArticleSchema } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, requireAdmin } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb } from '../_lib/admin';

async function createArticle({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const parsed = cmsArticleSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.issues[0].message);
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

async function updateArticle({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const { articleId, ...updateData } = data as { articleId: string; [key: string]: unknown };
  if (!articleId) throw new ApiError('invalid-argument', 'articleId is required');

  const parsed = cmsArticleSchema.safeParse(updateData);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const docRef = db.doc(`cms/articles/items/${articleId}`);
  const doc = await docRef.get();
  if (!doc.exists) throw new ApiError('not-found', 'Article not found');

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

async function deleteArticle({ claims, data }: ActionContext) {
  requireAdmin(claims);

  const { articleId } = data as { articleId: string };
  if (!articleId) throw new ApiError('invalid-argument', 'articleId is required');

  const db = getDb();
  const docRef = db.doc(`cms/articles/items/${articleId}`);
  const doc = await docRef.get();
  if (!doc.exists) throw new ApiError('not-found', 'Article not found');

  await docRef.delete();
  return { success: true };
}

async function listArticlesAdmin({ claims }: ActionContext) {
  requireAdmin(claims);

  const db = getDb();
  const snapshot = await db.collection('cms/articles/items').orderBy('createdAt', 'desc').get();
  return { articles: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
}

async function listPublishedArticles({ claims, data }: ActionContext) {
  requireAuth(claims);

  const { category } = ((data || {}) as { category?: string });
  const db = getDb();

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

  articles.sort((a, b) => {
    const dateA = a.publishedAt || '';
    const dateB = b.publishedAt || '';
    return dateB.localeCompare(dateA);
  });

  return { articles };
}

async function getArticle({ claims, data }: ActionContext) {
  requireAuth(claims);

  const { articleId } = data as { articleId: string };
  if (!articleId) throw new ApiError('invalid-argument', 'articleId is required');

  const db = getDb();
  const doc = await db.doc(`cms/articles/items/${articleId}`).get();
  if (!doc.exists) throw new ApiError('not-found', 'Article not found');

  const docData = doc.data()!;
  if (docData.status !== 'published') throw new ApiError('not-found', 'Article not found');

  return { id: doc.id, ...docData };
}

export const POST = createRouteHandler({
  createArticle,
  updateArticle,
  deleteArticle,
  listArticlesAdmin,
  listPublishedArticles,
  getArticle,
});
