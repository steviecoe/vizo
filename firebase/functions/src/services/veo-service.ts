import { getSecret, buildTenantGeminiSecretName } from './secret-manager';

// ─── Types ─────────────────────────────────────────────────

export interface VeoVideoRequest {
  imageBase64: string;
  imageMimeType: string;
  tenantId: string;
}

export interface VeoVideoResponse {
  videoBase64: string;
  mimeType: string;
  durationSeconds: number;
}

interface VeoApiResponse {
  name?: string;
  done?: boolean;
  response?: {
    generatedSamples?: Array<{
      video?: { uri: string };
    }>;
  };
  error?: { message: string; code: number };
}

// ─── Constants ─────────────────────────────────────────────

const VEO_MODEL = 'veo-3.1-generate-001';
const VEO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const VIDEO_DURATION_SECONDS = 4;
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 2000;

// ─── Public API ────────────────────────────────────────────

/**
 * Generates a short video clip from an approved image using Google's Veo 3.1 model.
 * Creates a "small movement" clip (several seconds) as specified in the SOW.
 *
 * Subject to model limitations (e.g. famous faces, copyrighted content).
 * Uses the same tenant API key as Gemini (Google AI Studio key).
 */
export async function generateVideo(
  request: VeoVideoRequest,
): Promise<VeoVideoResponse> {
  const apiKey = await getSecret(buildTenantGeminiSecretName(request.tenantId));

  // 1. Submit video generation request
  const submitUrl = `${VEO_BASE_URL}/${VEO_MODEL}:predictLongRunning?key=${apiKey}`;

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [
        {
          image: {
            bytesBase64Encoded: request.imageBase64,
            mimeType: request.imageMimeType,
          },
          prompt: 'Generate subtle, natural movement. Fashion model with slight pose shift, gentle fabric movement, soft breathing motion. Keep it minimal and elegant.',
        },
      ],
      parameters: {
        sampleCount: 1,
        durationSeconds: VIDEO_DURATION_SECONDS,
        fps: 24,
        aspectRatio: '9:16',
        personGeneration: 'allow_adult',
      },
    }),
  });

  if (!submitResponse.ok) {
    const errorBody = await submitResponse.text().catch(() => '');
    throw new Error(
      `Veo API submission error ${submitResponse.status}: ${errorBody.slice(0, 300)}`,
    );
  }

  const submitData = (await submitResponse.json()) as VeoApiResponse;

  if (submitData.error) {
    throw new Error(`Veo API error: ${submitData.error.message}`);
  }

  // If it completed synchronously
  if (submitData.done && submitData.response) {
    return extractVideoFromResponse(submitData, apiKey);
  }

  // 2. Poll for completion (long-running operation)
  const operationName = submitData.name;
  if (!operationName) {
    throw new Error('Veo API did not return an operation name');
  }

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
    const pollResponse = await fetch(pollUrl);

    if (!pollResponse.ok) continue;

    const pollData = (await pollResponse.json()) as VeoApiResponse;

    if (pollData.error) {
      throw new Error(`Veo generation failed: ${pollData.error.message}`);
    }

    if (pollData.done && pollData.response) {
      return extractVideoFromResponse(pollData, apiKey);
    }
  }

  throw new Error('Veo video generation timed out');
}

// ─── Helpers ───────────────────────────────────────────────

async function extractVideoFromResponse(
  data: VeoApiResponse,
  apiKey: string,
): Promise<VeoVideoResponse> {
  const samples = data.response?.generatedSamples;
  if (!samples || samples.length === 0 || !samples[0].video?.uri) {
    throw new Error('Veo response did not contain a video');
  }

  const videoUri = samples[0].video.uri;

  // Download the video from the URI
  const separator = videoUri.includes('?') ? '&' : '?';
  const videoResponse = await fetch(`${videoUri}${separator}key=${apiKey}`);
  if (!videoResponse.ok) {
    throw new Error('Failed to download generated video');
  }

  const buffer = await videoResponse.arrayBuffer();
  const videoBase64 = Buffer.from(buffer).toString('base64');

  return {
    videoBase64,
    mimeType: 'video/mp4',
    durationSeconds: VIDEO_DURATION_SECONDS,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
