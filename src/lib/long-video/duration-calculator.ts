import { DurationEstimate } from './types';

const THUMBNAIL_DURATION_MS = 3000;
const OUTRO_DURATION_MS = 5000;

/**
 * Calculates the total estimated video duration by summing all scene audio
 * durations plus thumbnail (3000ms) and outro (5000ms) durations.
 *
 * @param sceneDurations - Array of per-scene audio durations in milliseconds
 * @returns DurationEstimate with total, formatted string, and breakdown
 */
export function calculateTotalDuration(sceneDurations: number[]): DurationEstimate {
  const sceneDurationsSum = sceneDurations.reduce((sum, d) => sum + d, 0);
  const totalDurationMs = sceneDurationsSum + THUMBNAIL_DURATION_MS + OUTRO_DURATION_MS;

  return {
    totalDurationMs,
    formattedDuration: formatDuration(totalDurationMs),
    thumbnailDurationMs: THUMBNAIL_DURATION_MS,
    outroDurationMs: OUTRO_DURATION_MS,
    sceneDurations,
  };
}

/**
 * Formats a duration in milliseconds to "MM:SS" string format.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string in "MM:SS" format
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${mm}:${ss}`;
}
