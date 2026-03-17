import type { AspectRatio, Resolution, GenAIModel } from '../types/generation';
import type { SupportedLocale } from '../types/tenant';

export const RESOLUTIONS: Resolution[] = ['1k', '2k'];

export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '4:5', '16:9'];

export const MAX_VARIANTS_PER_JOB = 10;

export const CLOTHING_SIZES = [8, 10, 12, 14, 16, 18] as const;
export type ClothingSize = (typeof CLOTHING_SIZES)[number];

export const IMAGE_STATUSES = ['waiting_approval', 'approved', 'rejected'] as const;

export const GENERATION_FLOW_TYPES = ['quick', 'shopify', 'photoshoot'] as const;

export const GENAI_MODELS: GenAIModel[] = ['gemini', 'grok'];
export const PRIMARY_GENAI_MODEL: GenAIModel = 'gemini';
export const FALLBACK_GENAI_MODEL: GenAIModel = 'grok';

export const VIDEO_MAX_DURATION_SECONDS = 4;

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  'en', 'pl', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ja', 'ko', 'zh',
];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  pl: 'Polski',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

export const DEFAULT_LOCALE: SupportedLocale = 'en';
