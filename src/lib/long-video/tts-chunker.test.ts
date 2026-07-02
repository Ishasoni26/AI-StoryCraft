/**
 * Unit tests for TTS Chunker
 * Feature: long-video-export
 * Validates: Requirements 3.1, 3.2
 */

import { describe, it, expect } from 'vitest';
import { chunkTextForTTS } from './tts-chunker';

describe('chunkTextForTTS', () => {
  it('returns single-element array for text ≤ 200 chars', () => {
    const text = 'यह एक छोटा वाक्य है।';
    expect(text.length).toBeLessThanOrEqual(200);
    const result = chunkTextForTTS(text);
    expect(result).toEqual([text]);
  });

  it('returns text unchanged when exactly 200 chars', () => {
    const text = 'a'.repeat(200);
    const result = chunkTextForTTS(text);
    expect(result).toEqual([text]);
  });

  it('splits text > 200 chars into chunks each ≤ 199 chars', () => {
    const text = 'यह एक लम्बा वाक्य है। '.repeat(20); // well over 200 chars
    const result = chunkTextForTTS(text);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(199);
    }
  });

  it('splits at last sentence boundary (।) within 199 chars', () => {
    // Create text with a purna viram boundary near position 150
    const before = 'क'.repeat(149) + '।';
    const after = 'ख'.repeat(100);
    const text = before + after;
    expect(text.length).toBeGreaterThan(200);

    const result = chunkTextForTTS(text);
    expect(result[0]).toBe(before);
  });

  it('splits at last period (.) boundary within 199 chars', () => {
    const segment1 = 'Hello world this is a test sentence that needs to be split properly. ';
    const padding = 'x'.repeat(200 - segment1.length);
    const text = segment1 + padding + ' more text here.';
    
    const result = chunkTextForTTS(text);
    // First chunk should end at or before 199 chars
    expect(result[0].length).toBeLessThanOrEqual(199);
  });

  it('splits at last comma (,) boundary within 199 chars', () => {
    // Build text with comma as last boundary before 199 chars
    const beforeComma = 'a'.repeat(180) + ',';
    const afterComma = 'b'.repeat(50);
    const text = beforeComma + afterComma;
    expect(text.length).toBeGreaterThan(200);

    const result = chunkTextForTTS(text);
    expect(result[0]).toBe(beforeComma);
  });

  it('falls back to last whitespace when no sentence boundary exists', () => {
    // No ।, ., or comma — just words separated by spaces
    const words = 'abcdefghij '.repeat(25).trim(); // 11 chars × 25 - trailing space = 274 chars
    const result = chunkTextForTTS(words);
    
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(199);
      // Each chunk should consist of complete words only (no partial "abcdefghij")
      const trimmed = chunk.trim();
      if (trimmed.length > 0) {
        const wordsInChunk = trimmed.split(/\s+/);
        for (const word of wordsInChunk) {
          expect(word).toBe('abcdefghij');
        }
      }
    }
  });

  it('hard-splits at 199 chars when no whitespace or boundary exists', () => {
    const text = 'a'.repeat(400); // 400 continuous characters, no spaces or boundaries
    const result = chunkTextForTTS(text);
    
    expect(result[0].length).toBe(199);
    expect(result[1].length).toBe(199);
    expect(result[2].length).toBe(2);
  });

  it('processes all remaining text until fully consumed', () => {
    const text = 'यह एक लम्बा पैराग्राफ है। इसमें कई वाक्य हैं। ' .repeat(10);
    const result = chunkTextForTTS(text);
    
    // Verify all text is accounted for (joining chunks should reconstruct content)
    const reconstructed = result.join(' ');
    // Since trimming happens, verify no content is lost beyond whitespace
    expect(reconstructed.replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''));
  });

  it('handles empty string', () => {
    const result = chunkTextForTTS('');
    expect(result).toEqual(['']);
  });

  it('all chunks are non-empty for non-empty input', () => {
    const text = 'Hello, this is a long text. ' .repeat(15);
    const result = chunkTextForTTS(text);
    for (const chunk of result) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});
