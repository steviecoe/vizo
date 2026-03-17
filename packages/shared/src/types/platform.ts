import type { CreditCosts } from './credits';

export interface HeroSection {
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

export interface ContentCard {
  imageUrl: string;
  title: string;
  description: string;
  link: string;
  order: number;
}

export interface TrendingCard {
  imageUrl: string;
  title: string;
  tenantId?: string;
  order: number;
}

export interface HomepageConfig {
  hero: HeroSection;
  whatsNew: ContentCard[];
  trending: TrendingCard[];
  updatedAt: string;
  updatedBy: string;
}

export interface PlatformConfig {
  creditCosts: CreditCosts;
  aspectRatios: string[];
  zendeskUrl: string;
  updatedAt: string;
  updatedBy: string;
}

// ─── CMS Types ─────────────────────────────────────────────

export type CmsArticleCategory = 'tutorial' | 'news' | 'update' | 'guide' | 'faq';
export type CmsArticleStatus = 'draft' | 'published' | 'archived';

export interface CmsArticle {
  id: string;
  title: string;
  slug: string;
  body: string;
  category: CmsArticleCategory;
  status: CmsArticleStatus;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
