/**
 * Unit tests for Adaptive Bitrate Calculator
 * Feature: long-video-export
 * Validates: Requirements 7.6, 7.7
 */

import { describe, it, expect } from 'vitest';
import { adjustBitrateForFileSize } from './bitrate-calculator';

const DEFAULT_BITRATE = 5_000_000; // 5 Mbps
const MAX_FILE_SIZE = 2_147_483_648; // 2 GB

describe('adjustBitrateForFileSize', () => {
  it('returns initial bitrate unchanged when file is under limit', () => {
    // 60 seconds at 5 Mbps = 37.5 MB, well under 2 GB
    const result = adjustBitrateForFileSize(60, DEFAULT_BITRATE, MAX_FILE_SIZE);
    expect(result.bitrate).toBe(DEFAULT_BITRATE);
    expect(result.adjusted).toBe(false);
  });

  it('returns initial bitrate unchanged at exact boundary', () => {
    // Calculate duration where estimated size exactly equals maxFileSize
    // maxFileSize = (bitrate * duration) / 8
    // duration = (maxFileSize * 8) / bitrate
    const exactDuration = (MAX_FILE_SIZE * 8) / DEFAULT_BITRATE;
    const result = adjustBitrateForFileSize(exactDuration, DEFAULT_BITRATE, MAX_FILE_SIZE);
    expect(result.bitrate).toBe(DEFAULT_BITRATE);
    expect(result.adjusted).toBe(false);
  });

  it('reduces bitrate when estimated file exceeds limit', () => {
    // 15 minutes at 5 Mbps = 900s * 5_000_000 / 8 = 562_500_000 bytes (under 2GB)
    // Use a much longer duration to exceed: 60 minutes
    const durationSeconds = 3600; // 60 minutes
    // Estimated: 5_000_000 * 3600 / 8 = 2_250_000_000 bytes (exceeds 2GB)
    const result = adjustBitrateForFileSize(durationSeconds, DEFAULT_BITRATE, MAX_FILE_SIZE);
    expect(result.adjusted).toBe(true);
    expect(result.bitrate).toBeLessThan(DEFAULT_BITRATE);
  });

  it('adjusted bitrate produces file within size limit', () => {
    const durationSeconds = 3600; // 60 minutes
    const result = adjustBitrateForFileSize(durationSeconds, DEFAULT_BITRATE, MAX_FILE_SIZE);
    const estimatedSize = (result.bitrate * durationSeconds) / 8;
    expect(estimatedSize).toBeLessThanOrEqual(MAX_FILE_SIZE);
  });

  it('adjusted bitrate exactly fits the max file size', () => {
    const durationSeconds = 3600;
    const result = adjustBitrateForFileSize(durationSeconds, DEFAULT_BITRATE, MAX_FILE_SIZE);
    // adjustedBitrate = Math.floor((maxFileSize * 8) / durationSeconds)
    const expectedBitrate = Math.floor((MAX_FILE_SIZE * 8) / durationSeconds);
    expect(result.bitrate).toBe(expectedBitrate);
  });

  it('does not adjust for short video durations', () => {
    // 10 minutes at 5 Mbps = 600 * 5_000_000 / 8 = 375_000_000 bytes (under 2GB)
    const result = adjustBitrateForFileSize(600, DEFAULT_BITRATE, MAX_FILE_SIZE);
    expect(result.bitrate).toBe(DEFAULT_BITRATE);
    expect(result.adjusted).toBe(false);
  });

  it('handles very long durations gracefully', () => {
    const durationSeconds = 7200; // 2 hours
    const result = adjustBitrateForFileSize(durationSeconds, DEFAULT_BITRATE, MAX_FILE_SIZE);
    expect(result.adjusted).toBe(true);
    const estimatedSize = (result.bitrate * durationSeconds) / 8;
    expect(estimatedSize).toBeLessThanOrEqual(MAX_FILE_SIZE);
  });

  it('handles very small duration (1 second)', () => {
    const result = adjustBitrateForFileSize(1, DEFAULT_BITRATE, MAX_FILE_SIZE);
    // 5_000_000 * 1 / 8 = 625_000 bytes, well under 2GB
    expect(result.bitrate).toBe(DEFAULT_BITRATE);
    expect(result.adjusted).toBe(false);
  });

  it('works with custom maxFileSize', () => {
    const smallMax = 1_000_000; // 1 MB
    const durationSeconds = 60;
    // 5_000_000 * 60 / 8 = 37_500_000 bytes, exceeds 1 MB
    const result = adjustBitrateForFileSize(durationSeconds, DEFAULT_BITRATE, smallMax);
    expect(result.adjusted).toBe(true);
    const estimatedSize = (result.bitrate * durationSeconds) / 8;
    expect(estimatedSize).toBeLessThanOrEqual(smallMax);
  });

  it('works with custom initial bitrate', () => {
    const highBitrate = 50_000_000; // 50 Mbps
    const durationSeconds = 900; // 15 minutes
    // 50_000_000 * 900 / 8 = 5_625_000_000 bytes, exceeds 2GB
    const result = adjustBitrateForFileSize(durationSeconds, highBitrate, MAX_FILE_SIZE);
    expect(result.adjusted).toBe(true);
    const estimatedSize = (result.bitrate * durationSeconds) / 8;
    expect(estimatedSize).toBeLessThanOrEqual(MAX_FILE_SIZE);
  });
});
