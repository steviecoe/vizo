/**
 * Cost calculation helpers for mapping image generation volumes
 * to estimated real Gemini API costs.
 *
 * Based on Gemini Imagen 3 pricing (approximate):
 *   - 1k (1024×1024): ~$0.04 per image
 *   - 2k (2048×2048): ~$0.08 per image
 */

export const GEMINI_COST_PER_IMAGE_1K = 0.04;
export const GEMINI_COST_PER_IMAGE_2K = 0.08;

/**
 * Estimates the real Gemini API cost for a batch of generated images.
 */
export function estimateAiCost(
  images1k: number,
  images2k: number,
): number {
  return (images1k * GEMINI_COST_PER_IMAGE_1K) + (images2k * GEMINI_COST_PER_IMAGE_2K);
}

/**
 * Computes the credits revenue for the platform.
 * Revenue = totalCreditsSpent × averagePricePerCredit
 */
export function computeCreditsRevenue(
  totalCreditsSpent: number,
  averagePricePerCredit: number,
): number {
  return totalCreditsSpent * averagePricePerCredit;
}

/**
 * Computes profit margin: (revenue - aiCost) / revenue × 100
 */
export function computeProfitMargin(
  revenue: number,
  aiCost: number,
): number {
  if (revenue === 0) return 0;
  return Math.round(((revenue - aiCost) / revenue) * 100);
}
