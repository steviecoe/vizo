import { CloudTasksClient } from '@google-cloud/tasks';

// ─── Types ─────────────────────────────────────────────────

export interface PhotoshootTaskPayload {
  photoshootId: string;
  tenantId: string;
  createdBy: string;
}

// ─── Constants ─────────────────────────────────────────────

const OVERNIGHT_HOUR_UTC = 2; // 2 AM UTC
const QUEUE_NAME = 'photoshoot-worker';

let client: CloudTasksClient | null = null;

function getClient(): CloudTasksClient {
  if (!client) {
    client = new CloudTasksClient();
  }
  return client;
}

// ─── Public API ────────────────────────────────────────────

/**
 * Computes the schedule time for a photoshoot task.
 *
 * - Immediate: returns null (no delay)
 * - Overnight: returns next occurrence of 2 AM UTC as ISO string
 */
export function computeScheduleTime(isOvernight: boolean): string | null {
  if (!isOvernight) return null;

  const now = new Date();
  const target = new Date(now);

  target.setUTCHours(OVERNIGHT_HOUR_UTC, 0, 0, 0);

  // If it's already past 2 AM UTC today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target.toISOString();
}

/**
 * Computes the total number of images a photoshoot will generate.
 *
 * Each combination of (model × background) produces `variantCount` images
 * per product/image-url. At minimum 1 combination even with no models/backgrounds.
 */
export function computePhotoshootImageCount(
  modelCount: number,
  backgroundCount: number,
  productCount: number,
  variantCount: number,
): number {
  const effectiveModels = Math.max(modelCount, 1);
  const effectiveBackgrounds = Math.max(backgroundCount, 1);
  const effectiveProducts = Math.max(productCount, 1);

  return effectiveModels * effectiveBackgrounds * effectiveProducts * variantCount;
}

/**
 * Enqueues a photoshoot task to Google Cloud Tasks.
 *
 * If `scheduledAt` is provided, the task will be delayed until that time
 * (used for overnight scheduling with discounted rates).
 * The task calls the `processPhotoshoot` Cloud Function endpoint.
 */
export async function enqueuePhotoshootTask(
  payload: PhotoshootTaskPayload,
  scheduledAt: string | null,
): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'vizo-image-gen';
  const location = process.env.CLOUD_TASKS_LOCATION || 'europe-west4';

  const parent = getClient().queuePath(projectId, location, QUEUE_NAME);

  const functionUrl =
    process.env.PROCESS_PHOTOSHOOT_URL ||
    `https://${location}-${projectId}.cloudfunctions.net/processPhotoshoot`;

  const body = JSON.stringify(payload);

  const task: {
    httpRequest: {
      httpMethod: 'POST';
      url: string;
      headers: Record<string, string>;
      body: string;
      oidcToken: { serviceAccountEmail: string };
    };
    scheduleTime?: { seconds: number };
  } = {
    httpRequest: {
      httpMethod: 'POST',
      url: functionUrl,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(body).toString('base64'),
      oidcToken: {
        serviceAccountEmail: `${projectId}@appspot.gserviceaccount.com`,
      },
    },
  };

  if (scheduledAt) {
    const scheduleMs = new Date(scheduledAt).getTime();
    task.scheduleTime = { seconds: Math.floor(scheduleMs / 1000) };
  }

  const [response] = await getClient().createTask({ parent, task });
  return response.name || '';
}
