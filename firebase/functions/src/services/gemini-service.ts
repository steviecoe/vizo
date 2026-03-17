import { getSecret, buildTenantGeminiSecretName } from './secret-manager';

// ─── Types ─────────────────────────────────────────────────

export interface GeminiImageRequest {
  textPrompt: string;
  imageUrls: string[];
  tenantId: string;
}

export interface GeminiImageResponse {
  imageBase64: string;
  mimeType: string;
  promptTokens: number;
  finishReason: string;
}

interface GeminiContentPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiApiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text?: string;
        inline_data?: { mime_type: string; data: string };
      }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: { message: string; code: number };
}

// ─── Constants ─────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Public API ────────────────────────────────────────────

/**
 * Sends a multimodal image generation request to the Gemini API.
 *
 * Retrieves the tenant-specific API key from Secret Manager,
 * constructs the multimodal payload (text + reference images),
 * and returns the generated image as base64.
 */
export async function generateImage(
  request: GeminiImageRequest,
): Promise<GeminiImageResponse> {
  const apiKey = await getSecret(buildTenantGeminiSecretName(request.tenantId));

  const parts = await buildMultimodalParts(
    request.textPrompt,
    request.imageUrls,
  );

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Gemini API error ${response.status}: ${errorBody.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as GeminiApiResponse;

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini returned no candidates — content may have been blocked by safety filters');
  }

  const candidate = data.candidates[0];

  // Find the image part in the response
  const imagePart = candidate.content.parts.find((p) => p.inline_data);
  if (!imagePart?.inline_data) {
    throw new Error('Gemini response did not contain an image');
  }

  return {
    imageBase64: imagePart.inline_data.data,
    mimeType: imagePart.inline_data.mime_type,
    promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
    finishReason: candidate.finishReason,
  };
}

// ─── Helpers ───────────────────────────────────────────────

/**
 * Builds the multimodal parts array: text prompt + inline reference images.
 * Downloads remote images and inlines them as base64 for the Gemini API.
 */
async function buildMultimodalParts(
  textPrompt: string,
  imageUrls: string[],
): Promise<GeminiContentPart[]> {
  const parts: GeminiContentPart[] = [{ text: textPrompt }];

  // Download and inline reference images (max 5 to stay within limits)
  const urls = imageUrls.slice(0, 5);

  for (const url of urls) {
    try {
      const imgResponse = await fetch(url);
      if (!imgResponse.ok) continue;

      const buffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';

      parts.push({
        inline_data: {
          mime_type: contentType,
          data: base64,
        },
      });
    } catch {
      // Skip images that fail to download — don't block generation
      continue;
    }
  }

  return parts;
}
