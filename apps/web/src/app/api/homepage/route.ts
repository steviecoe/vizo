import { z } from 'zod';
import type { HomepageConfig } from '@vizo/shared';
import { createRouteHandler, type ActionContext } from '../_lib/handler';
import { requireAuth, requireAdmin } from '../_lib/auth';
import { ApiError } from '../_lib/errors';
import { getDb } from '../_lib/admin';

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

const HOMEPAGE_DOC = 'platform/config/homepage/content';

async function getHomepageConfig({ claims }: ActionContext) {
  requireAuth(claims);

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

async function updateHomepageConfig({ uid, claims, data }: ActionContext) {
  requireAdmin(claims);

  const parsed = updateHomepageSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('invalid-argument', parsed.error.issues[0].message);
  }

  const db = getDb();
  const config: HomepageConfig = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  };

  await db.doc(HOMEPAGE_DOC).set(config);
  return { success: true };
}

export const POST = createRouteHandler({ getHomepageConfig, updateHomepageConfig });
