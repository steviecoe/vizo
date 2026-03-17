import { describe, it, expect } from 'vitest';
import {
  GEMINI_COST_PER_IMAGE_1K,
  GEMINI_COST_PER_IMAGE_2K,
  estimateAiCost,
  computeCreditsRevenue,
  computeProfitMargin,
} from '../cost-calculator';

describe('cost-calculator', () => {
  describe('constants', () => {
    it('has correct pricing for 1k images', () => {
      expect(GEMINI_COST_PER_IMAGE_1K).toBe(0.04);
    });

    it('has correct pricing for 2k images', () => {
      expect(GEMINI_COST_PER_IMAGE_2K).toBe(0.08);
    });
  });

  describe('estimateAiCost', () => {
    it('calculates cost for 1k images only', () => {
      expect(estimateAiCost(100, 0)).toBe(4.0); // 100 * 0.04
    });

    it('calculates cost for 2k images only', () => {
      expect(estimateAiCost(0, 50)).toBe(4.0); // 50 * 0.08
    });

    it('calculates combined cost', () => {
      expect(estimateAiCost(100, 50)).toBe(8.0); // (100 * 0.04) + (50 * 0.08)
    });

    it('returns 0 for no images', () => {
      expect(estimateAiCost(0, 0)).toBe(0);
    });
  });

  describe('computeCreditsRevenue', () => {
    it('calculates revenue correctly', () => {
      expect(computeCreditsRevenue(1000, 0.5)).toBe(500);
    });

    it('returns 0 for zero credits', () => {
      expect(computeCreditsRevenue(0, 0.5)).toBe(0);
    });

    it('handles different price points', () => {
      expect(computeCreditsRevenue(200, 0.25)).toBe(50);
    });
  });

  describe('computeProfitMargin', () => {
    it('computes profit margin percentage', () => {
      expect(computeProfitMargin(500, 100)).toBe(80); // (500 - 100) / 500 * 100
    });

    it('returns 0 when revenue is 0', () => {
      expect(computeProfitMargin(0, 100)).toBe(0);
    });

    it('returns 0 when cost equals revenue', () => {
      expect(computeProfitMargin(100, 100)).toBe(0);
    });

    it('returns negative for cost exceeding revenue', () => {
      expect(computeProfitMargin(100, 200)).toBe(-100);
    });

    it('rounds to nearest integer', () => {
      // (300 - 100) / 300 * 100 = 66.666...
      expect(computeProfitMargin(300, 100)).toBe(67);
    });
  });
});
