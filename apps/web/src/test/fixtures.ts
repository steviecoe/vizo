import type {
  Tenant,
  TenantUser,
  AdminUser,
  CreditLedgerEntry,
  GenerationJob,
  GeneratedImage,
  ArtDirectionModel,
  ArtDirectionBackground,
  ShopifyProduct,
  PlatformConfig,
  HomepageConfig,
  Photoshoot,
  StripePayment,
  CreditCosts,
} from '@vizo/shared';
import { DEFAULT_CREDIT_COSTS } from '@vizo/shared';

export function makeAdminUser(overrides?: Partial<AdminUser>): AdminUser {
  return {
    uid: 'admin-uid-1',
    email: 'admin@vizogroup.com',
    displayName: 'VG Admin',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeTenantUser(overrides?: Partial<TenantUser>): TenantUser {
  return {
    uid: 'user-uid-1',
    email: 'user@fashionbrand.com',
    displayName: 'Jane Smith',
    role: 'tenant_admin',
    tenantId: 'tenant-1',
    invitedBy: 'admin-uid-1',
    status: 'active',
    createdAt: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

export function makeTenant(overrides?: Partial<Tenant>): Tenant {
  return {
    id: 'tenant-1',
    name: 'Fashion Brand Co',
    slug: 'fashion-brand-co',
    pricePerCredit: 0.5,
    creditBalance: 1000,
    lowCreditThreshold: 50,
    allowedFeatures: {
      shopifyIntegration: true,
      photoshootMode: true,
      quickGeneration: true,
    },
    artDirection: {
      defaultBrief: 'High-end fashion photography style',
      quickGenBrief: '',
      shopifyGenBrief: '',
      photoshootBrief: '',
    },
    shopify: {
      storeDomain: null,
      connectedAt: null,
      lastSyncAt: null,
    },
    language: {
      defaultLocale: 'en',
      autoDetect: true,
    },
    status: 'active',
    createdAt: '2025-01-15T00:00:00Z',
    createdBy: 'admin-uid-1',
    updatedAt: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

export function makeCreditLedgerEntry(
  overrides?: Partial<CreditLedgerEntry>,
): CreditLedgerEntry {
  return {
    id: 'ledger-1',
    type: 'topup_admin',
    amount: 100,
    balanceAfter: 1100,
    description: 'Free trial top-up',
    referenceId: null,
    createdAt: '2025-01-16T00:00:00Z',
    createdBy: 'admin-uid-1',
    ...overrides,
  };
}

export function makeGenerationJob(
  overrides?: Partial<GenerationJob>,
): GenerationJob {
  return {
    id: 'job-1',
    type: 'quick',
    status: 'pending',
    params: {
      resolution: '1k',
      aspectRatio: '1:1',
      variantCount: 2,
      brief: 'Studio lighting, white background',
      modelIds: ['model-1'],
      backgroundIds: ['bg-1'],
      productIds: [],
      itemImageUrls: ['https://example.com/item.jpg'],
    },
    isOvernight: false,
    scheduledFor: null,
    creditsCost: 10,
    creditsRefunded: 0,
    totalImages: 2,
    completedImages: 0,
    failedImages: 0,
    createdAt: '2025-01-20T00:00:00Z',
    createdBy: 'user-uid-1',
    completedAt: null,
    ...overrides,
  };
}

export function makeGeneratedImage(
  overrides?: Partial<GeneratedImage>,
): GeneratedImage {
  return {
    id: 'image-1',
    jobId: 'job-1',
    status: 'waiting_approval',
    storageUrl: '/tenants/tenant-1/generated/image-1/full.png',
    thumbnailUrl: '/tenants/tenant-1/generated/image-1/thumbnail.png',
    resolution: '1k',
    aspectRatio: '1:1',
    modelId: 'model-1',
    backgroundId: 'bg-1',
    productId: null,
    shopifyExportStatus: null,
    shopifyImageId: null,
    promptUsed: 'A fashion model wearing...',
    creditsCharged: 5,
    generatedAt: '2025-01-20T01:00:00Z',
    reviewedAt: null,
    reviewedBy: null,
    createdAt: '2025-01-20T01:00:00Z',
    aiModelUsed: 'gemini',
    ...overrides,
  };
}

export function makeArtDirectionModel(
  overrides?: Partial<ArtDirectionModel>,
): ArtDirectionModel {
  return {
    id: 'model-1',
    name: 'Summer Model',
    gender: 'female',
    skinColour: 'medium',
    hairColour: 'brown',
    height: '175cm',
    clothingSize: 12,
    age: '25-30',
    referenceImageUrl: null,
    generatedAt: null,
    createdAt: '2025-01-18T00:00:00Z',
    createdBy: 'user-uid-1',
    ...overrides,
  };
}

export function makeArtDirectionBackground(
  overrides?: Partial<ArtDirectionBackground>,
): ArtDirectionBackground {
  return {
    id: 'bg-1',
    name: 'White Studio',
    type: 'studio',
    description: 'Clean white studio with soft lighting',
    referenceImageUrl: null,
    generatedAt: null,
    createdAt: '2025-01-18T00:00:00Z',
    createdBy: 'user-uid-1',
    ...overrides,
  };
}

export function makeShopifyProduct(
  overrides?: Partial<ShopifyProduct>,
): ShopifyProduct {
  return {
    id: 'product-1',
    shopifyProductId: 'gid://shopify/Product/123',
    title: 'Summer Dress',
    description: 'A beautiful summer dress',
    productType: 'Dress',
    vendor: 'Fashion Brand Co',
    images: [
      { url: 'https://cdn.shopify.com/image1.jpg', alt: 'Front view', position: 1 },
    ],
    variants: [
      { id: 'var-1', title: 'Small', sku: 'SD-S', price: '49.99' },
    ],
    status: 'active',
    lastSyncedAt: '2025-01-19T00:00:00Z',
    createdAt: '2025-01-19T00:00:00Z',
    ...overrides,
  };
}

export function makePhotoshoot(overrides?: Partial<Photoshoot>): Photoshoot {
  return {
    id: 'photoshoot-1',
    name: 'Spring Collection 2025',
    status: 'draft',
    modelIds: ['model-1'],
    backgroundIds: ['bg-1'],
    productIds: ['product-1'],
    itemImageUrls: [],
    resolution: '2k',
    aspectRatio: '4:5',
    variantCount: 3,
    brief: 'Bright spring colors, outdoor feel',
    isOvernight: true,
    scheduledFor: '2025-02-01T02:00:00Z',
    jobIds: [],
    totalCreditsEstimate: 42,
    createdAt: '2025-01-25T00:00:00Z',
    createdBy: 'user-uid-1',
    ...overrides,
  };
}

export function makeStripePayment(
  overrides?: Partial<StripePayment>,
): StripePayment {
  return {
    id: 'payment-1',
    stripePaymentIntentId: 'pi_test_123',
    amount: 50,
    creditsGranted: 100,
    status: 'succeeded',
    createdAt: '2025-01-16T00:00:00Z',
    createdBy: 'user-uid-1',
    ...overrides,
  };
}

export function makePlatformConfig(
  overrides?: Partial<PlatformConfig>,
): PlatformConfig {
  return {
    creditCosts: { ...DEFAULT_CREDIT_COSTS },
    aspectRatios: ['1:1', '4:5', '16:9'],
    zendeskUrl: 'https://vizogroup.zendesk.com',
    updatedAt: '2025-01-01T00:00:00Z',
    updatedBy: 'admin-uid-1',
    ...overrides,
  };
}

export function makeHomepageConfig(
  overrides?: Partial<HomepageConfig>,
): HomepageConfig {
  return {
    hero: {
      imageUrl: '/images/hero.jpg',
      title: 'Welcome to Vizo',
      subtitle: 'AI-powered fashion photography',
      ctaText: 'Get Started',
      ctaLink: '/login',
    },
    whatsNew: [],
    trending: [],
    updatedAt: '2025-01-01T00:00:00Z',
    updatedBy: 'admin-uid-1',
    ...overrides,
  };
}

export function makeCreditCosts(overrides?: Partial<CreditCosts>): CreditCosts {
  return {
    ...DEFAULT_CREDIT_COSTS,
    ...overrides,
  };
}
