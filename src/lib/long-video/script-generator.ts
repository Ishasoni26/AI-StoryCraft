/**
 * Long-form script generation utilities.
 * Handles target duration validation and word count calculation
 * for Hindi narration content.
 */

/**
 * Validates that the target duration in minutes falls within the
 * acceptable range of [1, 20] inclusive. Rejects negative numbers,
 * zero, values > 20, and non-integer values.
 *
 * @param minutes - The target duration in minutes to validate
 * @returns true if minutes is a valid integer in [1, 20], false otherwise
 */
export function validateTargetDuration(minutes: number): boolean {
  if (!Number.isFinite(minutes)) return false;
  if (!Number.isInteger(minutes)) return false;
  return minutes >= 1 && minutes <= 20;
}

/**
 * Calculates the target word count based on the desired video duration
 * and the average Hindi narration rate of 130 words per minute.
 *
 * @param minutes - The target duration in minutes (should be validated first)
 * @returns The target word count (minutes × 130)
 */
export function calculateTargetWordCount(minutes: number): number {
  return minutes * 130;
}
