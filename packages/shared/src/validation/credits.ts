import { z } from 'zod';

export const creditTopupSchema = z.object({
  creditAmount: z.number().int().positive().min(10).max(100000),
});

export const adminCreditTopupSchema = z.object({
  tenantId: z.string().min(1),
  creditAmount: z.number().int().positive().min(1).max(1000000),
  description: z.string().min(1).max(500),
});

export const creditCostsSchema = z.object({
  quickGen1k: z.number().int().positive(),
  quickGen2k: z.number().int().positive(),
  shopifyGen1k: z.number().int().positive(),
  shopifyGen2k: z.number().int().positive(),
  photoshoot1k: z.number().int().positive(),
  photoshoot2k: z.number().int().positive(),
  modelGeneration: z.number().int().positive(),
  backgroundGeneration: z.number().int().positive(),
  videoGeneration: z.number().int().positive(),
});
