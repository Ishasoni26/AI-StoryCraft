/**
 * Adaptive Bitrate Calculator for long-form video export.
 *
 * Adjusts video bitrate to ensure the final exported file stays within
 * the maximum file size constraint (default 2 GB for YouTube standard upload).
 *
 * Estimated file size formula: (bitrate × durationSeconds) / 8 bytes
 * If the estimate exceeds maxFileSize, the bitrate is reduced proportionally.
 *
 * Feature: long-video-export
 * Validates: Requirements 7.6, 7.7
 */

/**
 * Adjusts the video bitrate if the estimated file size exceeds the maximum allowed.
 *
 * The estimated file size is calculated as: (bitrate × durationSeconds) / 8 bytes.
 * If this exceeds maxFileSize, the bitrate is reduced to fit within the limit.
 *
 * @param durationSeconds - Total video duration in seconds (must be positive)
 * @param initialBitrate - Initial video bitrate in bits per second (e.g. 5_000_000 for 5 Mbps)
 * @param maxFileSize - Maximum file size in bytes (e.g. 2_147_483_648 for 2 GB)
 * @returns Object with the final bitrate and whether it was adjusted
 */
export function adjustBitrateForFileSize(
  durationSeconds: number,
  initialBitrate: number,
  maxFileSize: number
): { bitrate: number; adjusted: boolean } {
  const estimatedFileSize = (initialBitrate * durationSeconds) / 8;

  if (estimatedFileSize <= maxFileSize) {
    return { bitrate: initialBitrate, adjusted: false };
  }

  // Reduce bitrate to fit within maxFileSize:
  // maxFileSize = (adjustedBitrate × durationSeconds) / 8
  // adjustedBitrate = (maxFileSize × 8) / durationSeconds
  // Use Math.floor to ensure we never exceed the limit due to floating-point rounding
  const adjustedBitrate = Math.floor((maxFileSize * 8) / durationSeconds);

  return { bitrate: adjustedBitrate, adjusted: true };
}
