/**
 * Generation Time Estimator for long-form video.
 *
 * Estimates total asset generation time based on scene count
 * (image generation) and word count (TTS processing).
 *
 * Feature: long-video-export
 */

/**
 * Estimates the total generation time in seconds for long-form video assets.
 *
 * The estimate accounts for:
 * - Image generation: ~7 seconds per scene (includes API call + 4s rate-limit delay)
 * - TTS processing: ~0.5 seconds per word of script dialogue
 *
 * @param sceneCount - Number of scenes to generate images for (must be positive)
 * @param wordCount - Total word count of the script for TTS (must be positive)
 * @returns Estimated generation time in seconds
 */
export function estimateGenerationTime(sceneCount: number, wordCount: number): number {
  return (sceneCount * 7) + (wordCount * 0.5);
}

/**
 * Formats a generation time in seconds to a "MM:SS" display string.
 *
 * @param seconds - Total seconds to format (non-negative)
 * @returns Formatted string in "MM:SS" format
 */
export function formatGenerationTime(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
