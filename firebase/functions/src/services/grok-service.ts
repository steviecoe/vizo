import { getSecret, buildTenantGeminiSecretName } from './secret-manager';

// ─── Types ─────────────────────────────────────────────────

export interface GrokImageRequest {
  textPrompt: string;
  imageUrls: string[];
  tenantId: string;
}

export interface GrokImageResponse {
  imageBase64: string;
  mimeType: string;
  promptTokens: number;
  finishReason: string;
}

interface GrokContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface GrokApiResponse {
  choices?: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: { message: string; code: string };
}

// ─── Constants ─────────────────────────────────────────────

const GROK_MODEL = 'grok-2-vision-1212';
const GROK_BASE_URL = 'https://api.x.ai/v1/chat/completions';

// ─── Public API ────────────────────────────────────────────

/**
 * Sends a multimodal image generation request to the Grok API as a fallback.
 * Uses the same prompt format as Gemini — no model-specific prompting per SOW.
 * The tenant's Grok API key is stored in Secret Manager alongside the Gemini key.
 */
export async function generateImageWithGrok(
  request: GrokImageRequest,
): Promise<GrokImageResponse> {
  const apiKey = await getSecret(buildTenantGrokSecretName(request.tenantId));

  const messages = await buildGrokMessages(
    request.textPrompt,
    request.imageUrls,
  );

  const response = await fetch(GROK_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Grok API error ${response.status}: ${errorBody.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as GrokApiResponse;

  if (data.error) {
    throw new Error(`Grok API error: ${data.error.message}`);
  }

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Grok returned no choices — content may have been blocked');
  }

  const choice = data.choices[0];
  const content = choice.message.content;

  // Grok returns base64 image in markdown format: ![](data:image/png;base64,...)
  const base64Match = content.match(/data:(image\/[^;]+);base64,([A-Za-z0-9+/=]+)/);
  if (!base64Match) {
    throw new Error('Grok response did not contain an image');
  }

  return {
    imageBase64: base64Match[2],
    mimeType: base64Match[1],
    promptTokens: data.usage?.prompt_tokens ?? 0,
    finishReason: choice.finish_reason,
  };
}

// ─── Helpers ───────────────────────────────────────────────

async function buildGrokMessages(
  textPrompt: string,
  imageUrls: string[],
): Promise<Array<{ role: string; content: GrokContentPart[] }>> {
  const contentParts: GrokContentPart[] = [
    { type: 'text', text: textPrompt },
  ];

  const urls = imageUrls.slice(0, 5);
  for (const url of urls) {
    contentParts.push({
      type: 'image_url',
      image_url: { url },
    });
  }

  return [{ role: 'user', content: contentParts }];
}

export function buildTenantGrokSecretName(tenantId: string): string {
  return `tenant-${tenantId}-grok-api-key`;
}
