import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { HomepageConfig } from '@vizo/shared';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getDb } from '../services/firebase-admin';

// ─── Validation Schemas ────────────────────────────────────

const heroSchema = z.object({
  imageUrl: z.string().min(1).max(500),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).default(''),
  ctaText: z.string().max(100).default(''),
  ctaLink: z.string().max(500).default(''),
});

const contentCardSchema = z.object({
  imageUrl: z.string().min(1).max(500),
  title: z.string().min(1).max(200),
  description: z.string().max(500).default(''),
  link: z.string().max(500).default(''),
  order: z.number().int().min(0),
});

const trendingCardSchema = z.object({
  imageUrl: z.string().min(1).max(500),
  title: z.string().min(1).max(200),
  tenantId: z.string().optional(),
  order: z.number().int().min(0),
});

const updateHomepageSchema = z.object({
  hero: heroSchema,
  whatsNew: z.array(contentCardSchema).max(20),
  trending: z.array(trendingCardSchema).max(20),
});

// ─── Handlers ──────────────────────────────────────────────

const HOMEPAGE_DOC = 'platform/config/homepage/content';

export async function getHomepageConfigHandler(request: CallableRequest) {
  requireAuth(request);

  const db = getDb();
  const doc = await db.doc(HOMEPAGE_DOC).get();

  if (!doc.exists) {
    const defaultConfig: HomepageConfig = {
      hero: { imageUrl: '', title: 'Welcome to Vizo', subtitle: 'AI-powered fashion photography', ctaText: 'Get Started', ctaLink: '/login' },
      whatsNew: [],
      trending: [],
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
    return defaultConfig;
  }

  return doc.data() as HomepageConfig;
}

export async function updateHomepageConfigHandler(request: CallableRequest) {
  const claims = requireAdmin(request);
  const uid = request.auth!.uid;

  const parsed = updateHomepageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const now = new Date().toISOString();

  const config: HomepageConfig = {
    ...parsed.data,
    updatedAt: now,
    updatedBy: uid,
  };

  await db.doc(HOMEPAGE_DOC).set(config);

  return { success: true };
}

// ─── Exports ───────────────────────────────────────────────

export const getHomepageConfig = onCall(getHomepageConfigHandler);
export const updateHomepageConfig = onCall(updateHomepageConfigHandler);
