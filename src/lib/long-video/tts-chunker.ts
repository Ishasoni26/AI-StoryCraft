/**
 * TTS Chunker for long-form video export.
 *
 * Splits dialogue text into chunks that respect the 200-character limit
 * of the Google Translate TTS API. Chunks are split at natural sentence
 * boundaries (purna viram ।, period ., or comma ,) when possible,
 * falling back to whitespace, and finally hard-splitting as a last resort.
 *
 * Feature: long-video-export
 * Validates: Requirements 3.1, 3.2
 */

/** Maximum characters allowed in a single TTS chunk. */
const MAX_CHUNK_LENGTH = 199;

/** Threshold above which text must be chunked. */
const CHUNK_THRESHOLD = 200;

/**
 * Splits text into chunks suitable for TTS processing.
 *
 * Rules:
 * 1. If text ≤ 200 chars, returns [text] unchanged.
 * 2. If text > 200 chars, splits at the last natural sentence boundary
 *    (।, ., or comma) within 199 chars.
 * 3. If no sentence boundary exists within 199 chars, falls back to last
 *    whitespace position to avoid mid-word breaks.
 * 4. If no whitespace exists either, hard splits at 199 chars (last resort).
 * 5. Recursively processes remaining text after each split.
 *
 * @param text - The dialogue text to chunk
 * @returns Array of text chunks, each ≤ 199 characters
 */
export function chunkTextForTTS(text: string): string[] {
  // Base case: text fits within the threshold
  if (text.length <= CHUNK_THRESHOLD) {
    return [text];
  }

  const splitIndex = findSplitIndex(text);
  const chunk = text.slice(0, splitIndex).trimEnd();
  const remaining = text.slice(splitIndex).trimStart();

  // If remaining text is empty after trimming, just return the chunk
  if (remaining.length === 0) {
    return [chunk];
  }

  return [chunk, ...chunkTextForTTS(remaining)];
}

/**
 * Finds the best index at which to split the text.
 *
 * Priority:
 * 1. Last sentence boundary (।, ., or comma) within MAX_CHUNK_LENGTH
 * 2. Last whitespace within MAX_CHUNK_LENGTH
 * 3. Hard split at MAX_CHUNK_LENGTH
 *
 * The split index is placed AFTER the boundary character so that the
 * boundary itself remains in the current chunk.
 */
function findSplitIndex(text: string): number {
  const searchRegion = text.slice(0, MAX_CHUNK_LENGTH);

  // Strategy 1: Find last sentence boundary (।, ., or comma)
  const boundaryIndex = findLastBoundary(searchRegion);
  if (boundaryIndex !== -1) {
    // Split after the boundary character
    return boundaryIndex + 1;
  }

  // Strategy 2: Find last whitespace
  const whitespaceIndex = findLastWhitespace(searchRegion);
  if (whitespaceIndex !== -1) {
    // Split at the whitespace position (whitespace goes to neither chunk after trim)
    return whitespaceIndex + 1;
  }

  // Strategy 3: Hard split at MAX_CHUNK_LENGTH (last resort)
  return MAX_CHUNK_LENGTH;
}

/**
 * Finds the index of the last sentence boundary character in the given text.
 * Sentence boundaries are: purna viram (।), period (.), or comma (,).
 *
 * @returns The index of the last boundary character, or -1 if none found
 */
function findLastBoundary(text: string): number {
  let lastIndex = -1;

  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (char === '।' || char === '.' || char === ',') {
      lastIndex = i;
      break;
    }
  }

  return lastIndex;
}

/**
 * Finds the index of the last whitespace character in the given text.
 *
 * @returns The index of the last whitespace, or -1 if none found
 */
function findLastWhitespace(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (/\s/.test(text[i])) {
      return i;
    }
  }

  return -1;
}
