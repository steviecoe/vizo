export type GenerationFlowType = 'quick' | 'shopify' | 'photoshoot';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ImageStatus = 'waiting_approval' | 'approved' | 'rejected';
export type Resolution = '1k' | '2k';
export type AspectRatio = '1:1' | '4:5' | '16:9';
export type ShopifyExportStatus = 'not_exported' | 'exporting' | 'exported';
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type GenAIModel = 'gemini' | 'grok';

export interface GenerationParams {
  resolution: Resolution;
  aspectRatio: AspectRatio;
  variantCount: number;
  brief: string;
  modelIds: string[];
  backgroundIds: string[];
  productIds: string[];
  itemImageUrls: string[];
}

export interface GenerationJob {
  id: string;
  type: GenerationFlowType;
  status: GenerationStatus;
  params: GenerationParams;
  isOvernight: boolean;
  scheduledFor: string | null;
  creditsCost: number;
  creditsRefunded: number;
  totalImages: number;
  completedImages: number;
  failedImages: number;
  createdAt: string;
  createdBy: string;
  completedAt: string | null;
}

export interface GeneratedImage {
  id: string;
  jobId: string;
  status: ImageStatus;
  storageUrl: string;
  thumbnailUrl: string;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  modelId: string | null;
  backgroundId: string | null;
  productId: string | null;
  shopifyExportStatus: ShopifyExportStatus | null;
  shopifyImageId: string | null;
  promptUsed: string;
  creditsCharged: number;
  generatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  aiModelUsed: GenAIModel;
}

export interface GeneratedVideo {
  id: string;
  sourceImageId: string;
  status: VideoStatus;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  creditsCharged: number;
  createdAt: string;
  createdBy: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface Photoshoot {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'processing' | 'completed';
  modelIds: string[];
  backgroundIds: string[];
  productIds: string[];
  itemImageUrls: string[];
  resolution: Resolution;
  aspectRatio: AspectRatio;
  variantCount: number;
  brief: string;
  isOvernight: boolean;
  scheduledFor: string | null;
  jobIds: string[];
  totalCreditsEstimate: number;
  createdAt: string;
  createdBy: string;
}
