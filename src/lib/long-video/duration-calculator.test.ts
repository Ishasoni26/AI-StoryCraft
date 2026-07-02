/**
 * Unit tests for Video Duration Calculator
 * Feature: long-video-export
 * Validates: Requirements 5.9, 6.3
 */

import { describe, it, expect } from 'vitest';
import { calculateTotalDuration, formatDuration } from './duration-calculator';

describe('calculateTotalDuration', () => {
  it('returns correct total for a typical scene array', () => {
    const sceneDurations = [5000, 8000, 6000, 7000, 4000];
    const result = calculateTotalDuration(sceneDurations);

    // Sum of scenes (30000) + thumbnail (3000) + outro (5000) = 38000
    expect(result.totalDurationMs).toBe(38000);
    expect(result.thumbnailDurationMs).toBe(3000);
    expect(result.outroDurationMs).toBe(5000);
    expect(result.sceneDurations).toEqual(sceneDurations);
    expect(result.formattedDuration).toBe('00:38');
  });

  it('handles empty scene array (only thumbnail + outro)', () => {
    const result = calculateTotalDuration([]);

    // 0 + 3000 + 5000 = 8000
    expect(result.totalDurationMs).toBe(8000);
    expect(result.formattedDuration).toBe('00:08');
    expect(result.sceneDurations).toEqual([]);
  });

  it('handles a single scene', () => {
    const result = calculateTotalDuration([10000]);

    // 10000 + 3000 + 5000 = 18000
    expect(result.totalDurationMs).toBe(18000);
    expect(result.formattedDuration).toBe('00:18');
  });

  it('calculates correctly for long-form video (10+ minutes)', () => {
    // 50 scenes averaging 12 seconds each = 600000ms
    const sceneDurations = Array(50).fill(12000);
    const result = calculateTotalDuration(sceneDurations);

    // 600000 + 3000 + 5000 = 608000ms = 10:08
    expect(result.totalDurationMs).toBe(608000);
    expect(result.formattedDuration).toBe('10:08');
  });

  it('preserves original scene durations array', () => {
    const sceneDurations = [1000, 2000, 3000];
    const result = calculateTotalDuration(sceneDurations);
    expect(result.sceneDurations).toEqual([1000, 2000, 3000]);
  });
});

describe('formatDuration', () => {
  it('formats zero milliseconds', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formats seconds only (under 1 minute)', () => {
    expect(formatDuration(45000)).toBe('00:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('02:05');
  });

  it('formats exactly 10 minutes', () => {
    expect(formatDuration(600000)).toBe('10:00');
  });

  it('formats large durations (over 60 minutes)', () => {
    expect(formatDuration(3661000)).toBe('61:01');
  });

  it('truncates sub-second values (floors to nearest second)', () => {
    expect(formatDuration(1999)).toBe('00:01');
    expect(formatDuration(1001)).toBe('00:01');
  });

  it('pads single-digit minutes and seconds with zeros', () => {
    expect(formatDuration(61000)).toBe('01:01');
  });
});
