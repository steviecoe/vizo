// Mock data for local frontend development (NEXT_PUBLIC_MOCK_API=true)

const PLACEHOLDER_IMG = 'https://placehold.co/600x800/e2e8f0/94a3b8?text=Image';
const PLACEHOLDER_THUMB = 'https://placehold.co/300x400/e2e8f0/94a3b8?text=Thumb';

const mockStats = {
  creditBalance: 1250,
  totalGenerated: 84,
  approvedImages: 62,
  pendingImages: 15,
  rejectedImages: 7,
  totalProducts: 23,
  recentLedger: [
    { id: 'l1', type: 'debit_generation', amount: -10, description: 'Quick gen x2', createdAt: '2025-01-20T10:00:00Z' },
    { id: 'l2', type: 'topup_admin', amount: 500, description: 'Free trial top-up', createdAt: '2025-01-19T09:00:00Z' },
    { id: 'l3', type: 'debit_generation', amount: -5, description: 'Quick gen x1', createdAt: '2025-01-18T14:00:00Z' },
  ],
};

const mockHomepage = {
  hero: {
    imageUrl: '/images/hero-bg.png',
    title: 'Mastering High-Fashion AI Generatives',
    subtitle: 'Generate on-brand imagery at scale — no photoshoot needed.',
    ctaText: 'Start Generating',
    ctaLink: '/tenant/generate/quick',
  },
  whatsNew: [
    { imageUrl: '/images/studio-v2-live.png', title: 'Studio V2.0 Live', description: 'Faster generation, better realism.', tag: 'Update', createdAt: '2 days ago' },
    { imageUrl: '/images/photoshoot-mode.png', title: 'Photoshoot Mode', description: 'Schedule overnight bulk shoots.', tag: 'Feature', createdAt: '1 week ago' },
    { imageUrl: '/images/shopify-sync.png', title: 'Shopify Sync', description: 'Push images directly to your store.', tag: 'Integration', createdAt: '2 weeks ago' },
  ],
  trending: [
    { imageUrl: '/images/soft-studio-look.png', title: 'Soft Studio Look', author: '@vizogroup' },
    { imageUrl: '/images/urban-minimal.png', title: 'Urban Minimal', author: '@tomandco' },
    { imageUrl: '/images/bold-editorial.png', title: 'Bold Editorial', author: '@fashionai' },
    { imageUrl: '/images/urban-minimal-2.png', title: 'Urban Minimal II', author: '@vogue_ai' },
    { imageUrl: '/images/bold-editorial-2.png', title: 'Bold Editorial II', author: '@creative_unit' },
    { imageUrl: '/images/soft-studio-look-2.png', title: 'Soft Studio Look II', author: '@atelier_design' },
    { imageUrl: '/images/urban-minimal-3.png', title: 'Urban Minimal III', author: '@future_fit' },
    { imageUrl: '/images/bold-editorial-3.png', title: 'Bold Editorial III', author: '@luxury_watch' },
    { imageUrl: '/images/urban-minimal-4.png', title: 'Urban Minimal IV', author: '@vogue_ai' },
    { imageUrl: '/images/bold-editorial-4.png', title: 'Bold Editorial IV', author: '@creative_unit' },
  ],
  updatedAt: '2025-01-01T00:00:00Z',
  updatedBy: 'admin-uid-1',
};

const IMAGE_CYCLE = [
  '/images/bold-editorial.png', '/images/urban-minimal.png', '/images/soft-studio-look.png',
  '/images/bold-editorial-2.png', '/images/urban-minimal-2.png', '/images/soft-studio-look-2.png',
  '/images/bold-editorial-3.png', '/images/urban-minimal-3.png', '/images/bold-editorial-4.png',
  '/images/urban-minimal-4.png', '/images/studio-v2-live.png', '/images/photoshoot-mode.png',
];
const mockImages = Array.from({ length: 12 }, (_, i) => ({
  id: `image-${i + 1}`,
  jobId: 'job-1',
  status: ['waiting_approval', 'approved', 'approved', 'rejected'][i % 4],
  storageUrl: IMAGE_CYCLE[i % IMAGE_CYCLE.length],
  thumbnailUrl: IMAGE_CYCLE[i % IMAGE_CYCLE.length],
  resolution: i % 2 === 0 ? '1k' : '2k',
  aspectRatio: '4:5',
  modelId: 'model-1',
  backgroundId: 'bg-1',
  productId: null,
  shopifyExportStatus: null,
  shopifyImageId: null,
  promptUsed: 'A fashion model wearing a summer dress in a white studio.',
  creditsCharged: 5,
  generatedAt: '2025-01-20T01:00:00Z',
  reviewedAt: null,
  reviewedBy: null,
  createdAt: '2025-01-20T01:00:00Z',
  aiModelUsed: 'gemini',
}));

const mockModels = [
  { id: 'model-1', name: 'Summer Model', gender: 'female', skinColour: 'medium', hairColour: 'brown', height: '175cm', clothingSize: 12, age: '25-30', referenceImageUrl: '/images/soft-studio-look.png', generatedAt: '2025-01-18T00:00:00Z', createdAt: '2025-01-18T00:00:00Z', createdBy: 'user-1' },
  { id: 'model-2', name: 'Classic Model', gender: 'female', skinColour: 'light', hairColour: 'blonde', height: '170cm', clothingSize: 10, age: '20-25', referenceImageUrl: '/images/urban-minimal.png', generatedAt: null, createdAt: '2025-01-19T00:00:00Z', createdBy: 'user-1' },
  { id: 'model-3', name: 'Urban Model', gender: 'male', skinColour: 'dark', hairColour: 'black', height: '185cm', clothingSize: 38, age: '28-35', referenceImageUrl: '/images/bold-editorial.png', generatedAt: null, createdAt: '2025-01-20T00:00:00Z', createdBy: 'user-1' },
];

const mockBackgrounds = [
  { id: 'bg-1', name: 'White Studio', type: 'studio', description: 'Clean white studio with soft lighting.', referenceImageUrl: '/images/photoshoot-mode.png', generatedAt: '2025-01-18T00:00:00Z', createdAt: '2025-01-18T00:00:00Z', createdBy: 'user-1' },
  { id: 'bg-2', name: 'Outdoor Garden', type: 'outdoor', description: 'Lush garden with natural daylight.', referenceImageUrl: '/images/shopify-sync.png', generatedAt: null, createdAt: '2025-01-19T00:00:00Z', createdBy: 'user-1' },
  { id: 'bg-3', name: 'Urban Street', type: 'outdoor', description: 'City street with editorial feel.', referenceImageUrl: null, generatedAt: null, createdAt: '2025-01-20T00:00:00Z', createdBy: 'user-1' },
];

const mockTenants = [
  { id: 'tenant-1', name: 'Fashion Brand Co', slug: 'fashion-brand-co', pricePerCredit: 0.5, creditBalance: 1250, lowCreditThreshold: 50, allowedFeatures: { shopifyIntegration: true, photoshootMode: true, quickGeneration: true }, artDirection: { defaultBrief: 'High-end fashion photography', quickGenBrief: '', shopifyGenBrief: '', photoshootBrief: '' }, shopify: { storeDomain: null, connectedAt: null, lastSyncAt: null }, language: { defaultLocale: 'en', autoDetect: true }, status: 'active', createdAt: '2025-01-15T00:00:00Z', createdBy: 'admin-1', updatedAt: '2025-01-15T00:00:00Z' },
  { id: 'tenant-2', name: 'Style House Ltd', slug: 'style-house-ltd', pricePerCredit: 0.75, creditBalance: 3000, lowCreditThreshold: 100, allowedFeatures: { shopifyIntegration: false, photoshootMode: true, quickGeneration: true }, artDirection: { defaultBrief: 'Minimal luxury aesthetic', quickGenBrief: '', shopifyGenBrief: '', photoshootBrief: '' }, shopify: { storeDomain: null, connectedAt: null, lastSyncAt: null }, language: { defaultLocale: 'en', autoDetect: false }, status: 'active', createdAt: '2025-01-16T00:00:00Z', createdBy: 'admin-1', updatedAt: '2025-01-16T00:00:00Z' },
  { id: 'tenant-3', name: 'Urban Threads', slug: 'urban-threads', pricePerCredit: 0.4, creditBalance: 80, lowCreditThreshold: 100, allowedFeatures: { shopifyIntegration: true, photoshootMode: false, quickGeneration: true }, artDirection: { defaultBrief: 'Urban streetwear', quickGenBrief: '', shopifyGenBrief: '', photoshootBrief: '' }, shopify: { storeDomain: 'urban-threads.myshopify.com', connectedAt: '2025-01-10T00:00:00Z', lastSyncAt: '2025-01-20T00:00:00Z' }, language: { defaultLocale: 'fr', autoDetect: true }, status: 'active', createdAt: '2025-01-10T00:00:00Z', createdBy: 'admin-1', updatedAt: '2025-01-20T00:00:00Z' },
];

const mockAdmins = [
  { uid: 'admin-1', email: 'admin@vizogroup.com', displayName: 'VG Admin', createdAt: '2025-01-01T00:00:00Z' },
  { uid: 'admin-2', email: 'ops@vizogroup.com', displayName: 'Ops Manager', createdAt: '2025-01-05T00:00:00Z' },
];

const mockCreditCosts = {
  quickGen1k: 5,
  quickGen2k: 10,
  photoshoot1k: 4,
  photoshoot2k: 8,
};

const mockProducts = [
  { id: 'product-1', shopifyProductId: 'gid://shopify/Product/1', title: 'Summer Dress', description: 'A beautiful summer dress', productType: 'Dress', vendor: 'Fashion Brand Co', images: [{ url: '/images/soft-studio-look.png', alt: 'Front', position: 1 }], variants: [{ id: 'v1', title: 'Small', sku: 'SD-S', price: '49.99' }], status: 'active', lastSyncedAt: '2025-01-19T00:00:00Z', createdAt: '2025-01-19T00:00:00Z' },
  { id: 'product-2', shopifyProductId: 'gid://shopify/Product/2', title: 'Winter Coat', description: 'A warm winter coat', productType: 'Coat', vendor: 'Fashion Brand Co', images: [{ url: '/images/urban-minimal.png', alt: 'Front', position: 1 }], variants: [{ id: 'v2', title: 'Medium', sku: 'WC-M', price: '149.99' }], status: 'active', lastSyncedAt: '2025-01-19T00:00:00Z', createdAt: '2025-01-19T00:00:00Z' },
];

const mockPhotoshoots = [
  { id: 'ps-1', name: 'Spring Collection 2025', status: 'draft', modelIds: ['model-1'], backgroundIds: ['bg-1'], productIds: ['product-1'], itemImageUrls: [], resolution: '2k', aspectRatio: '4:5', variantCount: 3, brief: 'Bright spring colors', isOvernight: true, scheduledFor: '2025-02-01T02:00:00Z', jobIds: [], totalCreditsEstimate: 42, createdAt: '2025-01-25T00:00:00Z', createdBy: 'user-1' },
  { id: 'ps-2', name: 'Summer Campaign', status: 'completed', modelIds: ['model-1', 'model-2'], backgroundIds: ['bg-2'], productIds: [], itemImageUrls: ['/images/bold-editorial.png'], resolution: '1k', aspectRatio: '1:1', variantCount: 2, brief: 'Outdoor summer feel', isOvernight: false, scheduledFor: null, jobIds: ['job-1'], totalCreditsEstimate: 24, createdAt: '2025-01-20T00:00:00Z', createdBy: 'user-1' },
];

const mockBillingInfo = {
  creditBalance: 1250,
  pricePerCredit: 0.5,
  lowCreditThreshold: 50,
  recentPayments: [
    { id: 'pay-1', creditsGranted: 500, amount: 25000, status: 'succeeded', createdAt: '2025-01-19T00:00:00Z' },
    { id: 'pay-2', creditsGranted: 200, amount: 10000, status: 'succeeded', createdAt: '2025-01-10T00:00:00Z' },
  ],
};

const mockReportingData = {
  totalTenants: 3,
  totalCreditsInSystem: 4330,
  totalCreditsSpent: 800,
  totalImagesGenerated: 150,
  totalImagesApproved: 120,
  totalImagesRejected: 10,
  totalJobs: 45,
  images1k: 100,
  images2k: 50,
  estimatedAiCost: 8.0,
  creditsRevenue: 400.0,
  profitMargin: 98,
  recentLedgerEntries: [
    { tenantId: 'tenant-1', tenantName: 'Fashion Brand Co', type: 'debit_generation', amount: -10, description: 'Quick gen', createdAt: '2025-01-20T00:00:00Z' },
    { tenantId: 'tenant-2', tenantName: 'Style House Ltd', type: 'topup_admin', amount: 500, description: 'Admin top-up', createdAt: '2025-01-19T00:00:00Z' },
  ],
  topTenants: [
    { id: 'tenant-1', name: 'Fashion Brand Co', creditBalance: 1250, totalGenerated: 84, totalApproved: 62 },
    { id: 'tenant-2', name: 'Style House Ltd', creditBalance: 3000, totalGenerated: 50, totalApproved: 45 },
    { id: 'tenant-3', name: 'Urban Threads', creditBalance: 80, totalGenerated: 16, totalApproved: 13 },
  ],
};

const mockArticles = [
  { id: 'article-1', title: 'Getting Started with Vizo', slug: 'getting-started', content: 'Welcome to Vizo...', excerpt: 'Learn how to use the platform.', coverImageUrl: '/images/studio-v2-live.png', status: 'published', publishedAt: '2025-01-15T00:00:00Z', createdAt: '2025-01-14T00:00:00Z', createdBy: 'admin-1' },
  { id: 'article-2', title: 'Advanced Art Direction Tips', slug: 'art-direction-tips', content: 'Take your images to the next level...', excerpt: 'Pro tips for better results.', coverImageUrl: '/images/photoshoot-mode.png', status: 'published', publishedAt: '2025-01-18T00:00:00Z', createdAt: '2025-01-17T00:00:00Z', createdBy: 'admin-1' },
];

const mockTenantUsers = [
  { uid: 'user-1', email: 'user@fashionbrand.com', displayName: 'Jane Smith', role: 'tenant_admin', tenantId: 'tenant-1', invitedBy: 'admin-1', status: 'active', createdAt: '2025-01-15T00:00:00Z' },
  { uid: 'user-2', email: 'staff@fashionbrand.com', displayName: 'John Doe', role: 'tenant_user', tenantId: 'tenant-1', invitedBy: 'user-1', status: 'active', createdAt: '2025-01-16T00:00:00Z' },
];

const mockPlatformConfig = {
  creditCosts: mockCreditCosts,
  aspectRatios: ['1:1', '4:5', '16:9', '9:16'],
  zendeskUrl: 'https://vizogroup.zendesk.com',
  updatedAt: '2025-01-01T00:00:00Z',
  updatedBy: 'admin-1',
};

const success = { success: true };

export const MOCK_RESPONSES: Record<string, unknown> = {
  // Dashboard
  getTenantDashboard: mockStats,
  // Homepage
  getHomepageConfig: mockHomepage,
  updateHomepageConfig: success,
  // Images
  listImages: { images: mockImages },
  updateImageStatus: { success: true, updated: 1 },
  // Models
  listModels: { models: mockModels },
  createModel: mockModels[0],
  updateModel: mockModels[0],
  deleteModel: success,
  // Backgrounds
  listBackgrounds: { backgrounds: mockBackgrounds },
  createBackground: mockBackgrounds[0],
  updateBackground: mockBackgrounds[0],
  deleteBackground: success,
  // Tenants
  listTenants: { tenants: mockTenants },
  createTenant: mockTenants[0],
  updateTenant: mockTenants[0],
  deleteTenant: success,
  listTenantUsers: { users: mockTenantUsers },
  inviteTenantUser: success,
  removeTenantUser: success,
  // Admin
  listAdmins: { admins: mockAdmins },
  addAdmin: success,
  removeAdmin: success,
  getCreditCosts: { creditCosts: mockCreditCosts, aspectRatios: mockPlatformConfig.aspectRatios },
  updateCreditCosts: success,
  getPlatformPublicConfig: mockPlatformConfig,
  // Auth
  bootstrapSuperadmin: success,
  impersonate: success,
  endImpersonation: success,
  // Credits
  debitCredits: success,
  refundCredits: success,
  adminTopupCredits: success,
  purchaseCredits: { clientSecret: 'pi_mock_secret_123' },
  getBillingInfo: mockBillingInfo,
  // Shopify
  connectShopify: success,
  syncShopifyProducts: { synced: mockProducts.length },
  disconnectShopify: success,
  pushImageToShopify: success,
  listProducts: { products: mockProducts },
  purchaseCreditsViaShopify: success,
  confirmShopifyCreditPurchase: success,
  // Reporting
  getReportingData: mockReportingData,
  // Photoshoots
  listPhotoshoots: { photoshoots: mockPhotoshoots },
  // Settings
  getTenantSettings: { language: { defaultLocale: 'en', autoDetect: true } },
  updateTenantLanguage: success,
  // CMS
  listArticlesAdmin: { articles: mockArticles },
  listPublishedArticles: { articles: mockArticles },
  getArticle: mockArticles[0],
  createArticle: mockArticles[0],
  updateArticle: mockArticles[0],
  deleteArticle: success,
};
