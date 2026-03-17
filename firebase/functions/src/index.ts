import * as admin from 'firebase-admin';

admin.initializeApp();

// ─── Remaining Cloud Functions (europe-west4) ───────────────
// All other functions have been migrated to Next.js API routes.

export { quickGenerate } from './api/generate';
export { regenerateImage } from './api/regenerate';
export { generateVideoFromImage } from './api/video';
export { createPhotoshoot, processPhotoshoot } from './api/photoshoot';
export { handleStripeWebhook } from './api/billing';
export { bulkDownloadImages } from './api/exports';
