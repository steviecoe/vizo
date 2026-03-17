import { z } from 'zod';

export const allowedFeaturesSchema = z.object({
  shopifyIntegration: z.boolean(),
  photoshootMode: z.boolean(),
  quickGeneration: z.boolean(),
});

export const artDirectionSchema = z.object({
  defaultBrief: z.string().max(2000).default(''),
  quickGenBrief: z.string().max(2000).default(''),
  shopifyGenBrief: z.string().max(2000).default(''),
  photoshootBrief: z.string().max(2000).default(''),
});

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  pricePerCredit: z.number().positive().max(1000),
  allowedFeatures: allowedFeaturesSchema,
  artDirection: artDirectionSchema.partial().optional(),
  adminEmails: z.array(z.string().email()).min(1).max(10),
  geminiApiKey: z.string().min(1),
});

export const artDirectionModelSchema = z.object({
  name: z.string().min(1).max(100),
  gender: z.enum(['male', 'female', 'non-binary']),
  skinColour: z.string().min(1).max(50),
  hairColour: z.string().min(1).max(50),
  height: z.string().min(1).max(20),
  clothingSize: z.number().int().min(8).max(18),
  age: z.string().min(1).max(20),
});

export const artDirectionBackgroundSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['studio', 'outdoor', 'campaign', 'custom']),
  description: z.string().min(1).max(500),
});

export const updateTenantSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  pricePerCredit: z.number().positive().max(1000).optional(),
  lowCreditThreshold: z.number().int().min(0).max(100000).optional(),
  allowedFeatures: allowedFeaturesSchema.optional(),
  artDirection: artDirectionSchema.partial().optional(),
  status: z.enum(['active', 'suspended']).optional(),
  geminiApiKey: z.string().min(1).optional(),
});

export const shopifyConnectSchema = z.object({
  storeDomain: z.string().min(1).regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/, 'Must be a valid myshopify.com domain'),
  adminApiKey: z.string().min(1),
});
