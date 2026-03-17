import { z } from 'zod';

export const generationParamsSchema = z.object({
  resolution: z.enum(['1k', '2k']),
  aspectRatio: z.enum(['1:1', '4:5', '16:9']),
  variantCount: z.number().int().min(1).max(10),
  brief: z.string().max(2000).default(''),
  modelIds: z.array(z.string()).default([]),
  backgroundIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
  itemImageUrls: z.array(z.string().url()).default([]),
});

export const quickGenSchema = z.object({
  params: generationParamsSchema,
}).refine(
  (data) => data.params.itemImageUrls.length > 0 || data.params.productIds.length > 0,
  { message: 'At least one item image or product must be provided' },
);

export const photoshootCreateSchema = z.object({
  name: z.string().min(1).max(200),
  modelIds: z.array(z.string()).min(1),
  backgroundIds: z.array(z.string()).min(1),
  productIds: z.array(z.string()).default([]),
  itemImageUrls: z.array(z.string().url()).default([]),
  resolution: z.enum(['1k', '2k']),
  aspectRatio: z.enum(['1:1', '4:5', '16:9']),
  variantCount: z.number().int().min(1).max(10),
  brief: z.string().max(2000).default(''),
  isOvernight: z.boolean().default(false),
});

export const videoGenerateSchema = z.object({
  imageId: z.string().min(1),
});

export const cmsArticleSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens'),
  body: z.string().min(1).max(50000),
  category: z.enum(['tutorial', 'news', 'update', 'guide', 'faq']),
  status: z.enum(['draft', 'published', 'archived']),
  coverImageUrl: z.string().url().nullable().default(null),
  tags: z.array(z.string().max(50)).max(10).default([]),
});
