/**
 * Script Chunker for long-form video export.
 *
 * Splits long story scripts into manageable chunks for scene generation API calls.
 * Scripts > 1000 words are split into chunks of max 500 words at sentence
 * boundaries (purna viram ।, period ., question mark ?, or exclamation mark !)
 * to preserve narrative coherence.
 *
 * If no sentence boundary is found within the word limit, falls back to
 * splitting at the last word boundary within the limit.
 *
 * Concatenation of all chunks (joined with a single space) reconstructs
 * the original text (with possible whitespace normalization).
 *
 * Feature: long-video-export
 * Validates: Requirements 2.2
 */

/** Default maximum words allowed per chunk. */
const DEFAULT_MAX_WORDS_PER_CHUNK = 500;

/** Word count threshold above which chunking is applied. */
const CHUNKING_THRESHOLD = 1000;

/** Sentence boundary characters: purna viram (।), period (.), question mark (?), exclamation mark (!) */
const SENTENCE_BOUNDARIES = ['।', '.', '?', '!'];

/**
 * Splits a script into chunks of at most `maxWordsPerChunk` words,
 * splitting at sentence boundaries when possible.
 *
 * Rules:
 * 1. If the script has ≤ 1000 words, returns [script] unchanged (no splitting).
 * 2. If the script has > 1000 words, splits into chunks of at most
 *    `maxWordsPerChunk` words (default 500).
 * 3. Prefers splitting at the last sentence boundary (।, ., ?, !) within
 *    the word limit.
 * 4. If no sentence boundary exists within the limit, splits at the
 *    word boundary (after maxWordsPerChunk words).
 * 5. Concatenation of all chunks with a single space separator
 *    reconstructs the original text (after whitespace normalization).
 *
 * @param script - The script text to chunk
 * @param maxWordsPerChunk - Maximum words per chunk (default: 500)
 * @returns Array of text chunks
 */
export function chunkScript(
  script: string,
  maxWordsPerChunk: number = DEFAULT_MAX_WORDS_PER_CHUNK
): string[] {
  // Handle edge cases: empty or whitespace-only strings
  if (script.trim().length === 0) {
    return [script];
  }

  const words = script.split(/\s+/).filter((w) => w.length > 0);

  // If script is ≤ 1000 words, return as single-element array (no splitting)
  if (words.length <= CHUNKING_THRESHOLD) {
    return [script];
  }

  const chunks: string[] = [];
  let remainingWords = words;

  while (remainingWords.length > 0) {
    if (remainingWords.length <= maxWordsPerChunk) {
      // Last chunk: take all remaining words
      chunks.push(remainingWords.join(' '));
      break;
    }

    // Take the candidate region (maxWordsPerChunk words)
    const candidateWords = remainingWords.slice(0, maxWordsPerChunk);
    const splitIndex = findSentenceBoundarySplit(candidateWords, maxWordsPerChunk);

    // Create chunk from words up to the split index
    const chunkWords = remainingWords.slice(0, splitIndex);
    chunks.push(chunkWords.join(' '));

    // Move past the chunk
    remainingWords = remainingWords.slice(splitIndex);
  }

  return chunks;
}

/**
 * Finds the best word index at which to split, preferring sentence boundaries.
 *
 * Scans backwards from the end of the candidate words looking for the last
 * word that ends with a sentence boundary character. If none found, falls
 * back to splitting at the maxWordsPerChunk boundary.
 *
 * @param candidateWords - The words within the word limit
 * @param maxWords - The maximum number of words
 * @returns The number of words to include in this chunk
 */
function findSentenceBoundarySplit(
  candidateWords: string[],
  maxWords: number
): number {
  // Scan backwards from the last word in the candidate to find a sentence boundary
  for (let i = candidateWords.length - 1; i >= 0; i--) {
    const word = candidateWords[i];
    if (endsWithSentenceBoundary(word)) {
      // Split after this word (include it in the current chunk)
      return i + 1;
    }
  }

  // No sentence boundary found — split at the word limit
  return maxWords;
}

/**
 * Checks if a word ends with a sentence boundary character.
 *
 * @param word - The word to check
 * @returns true if the word's last character is a sentence boundary
 */
function endsWithSentenceBoundary(word: string): boolean {
  if (word.length === 0) return false;
  const lastChar = word[word.length - 1];
  return SENTENCE_BOUNDARIES.includes(lastChar);
}
