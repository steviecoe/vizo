import { describe, it, expect, vi } from 'vitest';

vi.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: vi.fn(),
}));

import {
  computeScheduleTime,
  computePhotoshootImageCount,
} from '../cloud-tasks';

describe('computeScheduleTime', () => {
  it('returns null for non-overnight', () => {
    expect(computeScheduleTime(false)).toBeNull();
  });

  it('returns future ISO date for overnight', () => {
    const result = computeScheduleTime(true);
    expect(result).not.toBeNull();
    const date = new Date(result!);
    expect(date.getUTCHours()).toBe(2);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getTime()).toBeGreaterThan(Date.now());
  });

  it('schedules for next day if already past 2 AM UTC', () => {
    const result = computeScheduleTime(true);
    const scheduled = new Date(result!);
    const now = new Date();

    expect(scheduled.getTime()).toBeGreaterThan(now.getTime());
    expect(scheduled.getUTCHours()).toBe(2);
  });
});

describe('computePhotoshootImageCount', () => {
  it('computes basic combination: 2 models × 3 backgrounds × 1 product × 2 variants = 12', () => {
    expect(computePhotoshootImageCount(2, 3, 1, 2)).toBe(12);
  });

  it('treats 0 models as 1 (flat lay)', () => {
    expect(computePhotoshootImageCount(0, 2, 1, 3)).toBe(6);
  });

  it('treats 0 backgrounds as 1 (default)', () => {
    expect(computePhotoshootImageCount(3, 0, 1, 1)).toBe(3);
  });

  it('treats 0 products as 1', () => {
    expect(computePhotoshootImageCount(2, 2, 0, 1)).toBe(4);
  });

  it('handles all zeros as 1×1×1 = variants', () => {
    expect(computePhotoshootImageCount(0, 0, 0, 5)).toBe(5);
  });

  it('handles large combination: 3 models × 4 backgrounds × 5 products × 3 variants = 180', () => {
    expect(computePhotoshootImageCount(3, 4, 5, 3)).toBe(180);
  });

  it('single model × single background × single product × 1 variant = 1', () => {
    expect(computePhotoshootImageCount(1, 1, 1, 1)).toBe(1);
  });

  it('scales linearly with variant count', () => {
    expect(computePhotoshootImageCount(2, 2, 1, 1)).toBe(4);
    expect(computePhotoshootImageCount(2, 2, 1, 5)).toBe(20);
    expect(computePhotoshootImageCount(2, 2, 1, 10)).toBe(40);
  });
});
