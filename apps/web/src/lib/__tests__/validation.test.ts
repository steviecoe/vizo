import { describe, it, expect } from 'vitest';
import {
  createTenantSchema,
  artDirectionModelSchema,
  shopifyConnectSchema,
  generationParamsSchema,
  quickGenSchema,
  photoshootCreateSchema,
  creditTopupSchema,
  adminCreditTopupSchema,
  creditCostsSchema,
} from '@vizo/shared';

describe('createTenantSchema', () => {
  const validInput = {
    name: 'Test Brand',
    slug: 'test-brand',
    pricePerCredit: 0.5,
    allowedFeatures: {
      shopifyIntegration: true,
      photoshootMode: true,
      quickGeneration: true,
    },
    adminEmails: ['admin@test.com'],
    geminiApiKey: 'test-key-123',
  };

  it('accepts valid input', () => {
    const result = createTenantSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createTenantSchema.safeParse({ ...validInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid slug (uppercase)', () => {
    const result = createTenantSchema.safeParse({ ...validInput, slug: 'UPPER' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with spaces', () => {
    const result = createTenantSchema.safeParse({ ...validInput, slug: 'has space' });
    expect(result.success).toBe(false);
  });

  it('rejects zero pricePerCredit', () => {
    const result = createTenantSchema.safeParse({ ...validInput, pricePerCredit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects no admin emails', () => {
    const result = createTenantSchema.safeParse({ ...validInput, adminEmails: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createTenantSchema.safeParse({
      ...validInput,
      adminEmails: ['not-an-email'],
    });
    expect(result.success).toBe(false);
  });
});

describe('artDirectionModelSchema', () => {
  const validModel = {
    name: 'Summer Model',
    gender: 'female' as const,
    skinColour: 'medium',
    hairColour: 'brown',
    height: '175cm',
    clothingSize: 12,
    age: '25-30',
  };

  it('accepts valid model', () => {
    const result = artDirectionModelSchema.safeParse(validModel);
    expect(result.success).toBe(true);
  });

  it('rejects clothing size below 8', () => {
    const result = artDirectionModelSchema.safeParse({ ...validModel, clothingSize: 6 });
    expect(result.success).toBe(false);
  });

  it('rejects clothing size above 18', () => {
    const result = artDirectionModelSchema.safeParse({ ...validModel, clothingSize: 20 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid gender', () => {
    const result = artDirectionModelSchema.safeParse({ ...validModel, gender: 'other' });
    expect(result.success).toBe(false);
  });
});

describe('shopifyConnectSchema', () => {
  it('accepts valid domain', () => {
    const result = shopifyConnectSchema.safeParse({
      storeDomain: 'my-store.myshopify.com',
      adminApiKey: 'shpat_123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-myshopify.com domain', () => {
    const result = shopifyConnectSchema.safeParse({
      storeDomain: 'mystore.com',
      adminApiKey: 'key',
    });
    expect(result.success).toBe(false);
  });
});

describe('generationParamsSchema', () => {
  it('accepts valid params', () => {
    const result = generationParamsSchema.safeParse({
      resolution: '1k',
      aspectRatio: '1:1',
      variantCount: 3,
      brief: 'Test brief',
      modelIds: ['m-1'],
      backgroundIds: ['bg-1'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid resolution', () => {
    const result = generationParamsSchema.safeParse({
      resolution: '4k',
      aspectRatio: '1:1',
      variantCount: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects variant count above 10', () => {
    const result = generationParamsSchema.safeParse({
      resolution: '1k',
      aspectRatio: '1:1',
      variantCount: 15,
    });
    expect(result.success).toBe(false);
  });

  it('rejects variant count of 0', () => {
    const result = generationParamsSchema.safeParse({
      resolution: '1k',
      aspectRatio: '1:1',
      variantCount: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('quickGenSchema', () => {
  it('requires at least one item image or product', () => {
    const result = quickGenSchema.safeParse({
      params: {
        resolution: '1k',
        aspectRatio: '1:1',
        variantCount: 1,
        brief: '',
        modelIds: [],
        backgroundIds: [],
        productIds: [],
        itemImageUrls: [],
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts with item image URL', () => {
    const result = quickGenSchema.safeParse({
      params: {
        resolution: '1k',
        aspectRatio: '1:1',
        variantCount: 1,
        brief: '',
        modelIds: [],
        backgroundIds: [],
        productIds: [],
        itemImageUrls: ['https://example.com/item.png'],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('photoshootCreateSchema', () => {
  it('accepts valid photoshoot', () => {
    const result = photoshootCreateSchema.safeParse({
      name: 'Spring 2025',
      modelIds: ['m-1'],
      backgroundIds: ['bg-1'],
      resolution: '2k',
      aspectRatio: '4:5',
      variantCount: 3,
      brief: 'Outdoor spring feel',
      isOvernight: true,
    });
    expect(result.success).toBe(true);
  });

  it('requires at least one model', () => {
    const result = photoshootCreateSchema.safeParse({
      name: 'Spring 2025',
      modelIds: [],
      backgroundIds: ['bg-1'],
      resolution: '2k',
      aspectRatio: '4:5',
      variantCount: 3,
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one background', () => {
    const result = photoshootCreateSchema.safeParse({
      name: 'Spring 2025',
      modelIds: ['m-1'],
      backgroundIds: [],
      resolution: '2k',
      aspectRatio: '4:5',
      variantCount: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe('creditTopupSchema', () => {
  it('accepts valid topup', () => {
    const result = creditTopupSchema.safeParse({ creditAmount: 100 });
    expect(result.success).toBe(true);
  });

  it('rejects amount below 10', () => {
    const result = creditTopupSchema.safeParse({ creditAmount: 5 });
    expect(result.success).toBe(false);
  });
});

describe('adminCreditTopupSchema', () => {
  it('accepts valid admin topup', () => {
    const result = adminCreditTopupSchema.safeParse({
      tenantId: 'tenant-1',
      creditAmount: 500,
      description: 'Free trial',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing tenantId', () => {
    const result = adminCreditTopupSchema.safeParse({
      tenantId: '',
      creditAmount: 500,
      description: 'Free trial',
    });
    expect(result.success).toBe(false);
  });
});

describe('creditCostsSchema', () => {
  it('accepts valid costs', () => {
    const result = creditCostsSchema.safeParse({
      quickGen1k: 5,
      quickGen2k: 10,
      shopifyGen1k: 5,
      shopifyGen2k: 10,
      photoshoot1k: 3,
      photoshoot2k: 7,
      modelGeneration: 2,
      backgroundGeneration: 2,
      videoGeneration: 15,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero cost', () => {
    const result = creditCostsSchema.safeParse({
      quickGen1k: 0,
      quickGen2k: 10,
      shopifyGen1k: 5,
      shopifyGen2k: 10,
      photoshoot1k: 3,
      photoshoot2k: 7,
      modelGeneration: 2,
      backgroundGeneration: 2,
      videoGeneration: 15,
    });
    expect(result.success).toBe(false);
  });
});
