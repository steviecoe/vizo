export interface AllowedFeatures {
  shopifyIntegration: boolean;
  photoshootMode: boolean;
  quickGeneration: boolean;
}

export interface TenantShopifyConfig {
  storeDomain: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
}

export interface TenantArtDirection {
  defaultBrief: string;
  quickGenBrief: string;
  shopifyGenBrief: string;
  photoshootBrief: string;
}

export type SupportedLocale = 'en' | 'pl' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'ja' | 'ko' | 'zh';

export interface TenantLanguageSettings {
  defaultLocale: SupportedLocale;
  autoDetect: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  pricePerCredit: number;
  creditBalance: number;
  lowCreditThreshold: number;
  allowedFeatures: AllowedFeatures;
  artDirection: TenantArtDirection;
  shopify: TenantShopifyConfig;
  language: TenantLanguageSettings;
  status: 'active' | 'suspended';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  pricePerCredit: number;
  allowedFeatures: AllowedFeatures;
  artDirection?: Partial<TenantArtDirection>;
  adminEmails: string[];
  geminiApiKey: string;
}

export interface ArtDirectionModel {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'non-binary';
  skinColour: string;
  hairColour: string;
  height: string;
  clothingSize: number;
  age: string;
  referenceImageUrl: string | null;
  generatedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface ArtDirectionBackground {
  id: string;
  name: string;
  type: 'studio' | 'outdoor' | 'campaign' | 'custom';
  description: string;
  referenceImageUrl: string | null;
  generatedAt: string | null;
  createdAt: string;
  createdBy: string;
}
