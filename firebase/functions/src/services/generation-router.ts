import type { GenAIModel } from '@vizo/shared';
import { generateImage, type GeminiImageResponse } from './gemini-service';
import { generateImageWithGrok } from './grok-service';

// ─── Types ─────────────────────────────────────────────────

export interface GenerationRequest {
  textPrompt: string;
  imageUrls: string[];
  tenantId: string;
}

export interface GenerationResult {
  imageBase64: string;
  mimeType: string;
  promptTokens: number;
  finishReason: string;
  modelUsed: GenAIModel;
  usedFallback: boolean;
}

// ─── Public API ────────────────────────────────────────────

/**
 * Routes image generation through the primary model (Gemini), then
 * automatically retries with the fallback model (Grok) if the primary fails.
 *
 * This is transparent to tenants — they don't know which model was used.
 * Both models receive the same prompt (no model-specific prompting per SOW).
 */
export async function generateWithFallback(
  request: GenerationRequest,
): Promise<GenerationResult> {
  // Try primary model (Gemini)
  try {
    const result = await generateImage({
      textPrompt: request.textPrompt,
      imageUrls: request.imageUrls,
      tenantId: request.tenantId,
    });

    return {
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      promptTokens: result.promptTokens,
      finishReason: result.finishReason,
      modelUsed: 'gemini',
      usedFallback: false,
    };
  } catch (primaryError) {
    // Primary failed — try fallback model (Grok)
    try {
      const fallbackResult = await generateImageWithGrok({
        textPrompt: request.textPrompt,
        imageUrls: request.imageUrls,
        tenantId: request.tenantId,
      });

      return {
        imageBase64: fallbackResult.imageBase64,
        mimeType: fallbackResult.mimeType,
        promptTokens: fallbackResult.promptTokens,
        finishReason: fallbackResult.finishReason,
        modelUsed: 'grok',
        usedFallback: true,
      };
    } catch {
      // Both models failed — throw the primary error for better diagnostics
      throw primaryError;
    }
  }
}
