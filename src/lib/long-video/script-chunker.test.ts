/**
 * Unit tests for Script Chunker
 * Feature: long-video-export
 * Validates: Requirements 2.2
 */

import { describe, it, expect } from 'vitest';
import { chunkScript } from './script-chunker';

describe('chunkScript', () => {
  // --- Single chunk (no splitting) ---

  it('returns single chunk for script with few words', () => {
    const script = 'This is a short script with only a few words.';
    const result = chunkScript(script);
    expect(result).toEqual([script]);
  });

  it('returns single chunk for script with exactly 1000 words', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const script = words.join(' ');
    const result = chunkScript(script);
    expect(result).toEqual([script]);
  });

  it('returns single chunk for script with 500 words (below threshold)', () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
    const script = words.join(' ');
    const result = chunkScript(script);
    expect(result).toEqual([script]);
  });

  it('returns single chunk for script with 999 words', () => {
    const words = Array.from({ length: 999 }, (_, i) => `word${i}.`);
    const script = words.join(' ');
    const result = chunkScript(script);
    expect(result).toEqual([script]);
  });

  // --- Splitting behavior (> 1000 words) ---

  it('splits script exceeding 1000 words into multiple chunks', () => {
    const sentences = Array.from(
      { length: 150 },
      (_, i) => `This is sentence number ${i} with some extra words to fill up the space adequately.`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script);
    expect(result.length).toBeGreaterThan(1);
  });

  it('each chunk contains at most 500 words (default maxWordsPerChunk)', () => {
    const sentences = Array.from(
      { length: 200 },
      (_, i) => `This is sentence number ${i} in the story with extra padding words.`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script, 500);
    for (const chunk of result) {
      const words = chunk.split(/\s+/).filter((w) => w.length > 0).length;
      expect(words).toBeLessThanOrEqual(500);
    }
  });

  it('concatenation of chunks reconstructs original text (whitespace normalized)', () => {
    const sentences = Array.from(
      { length: 300 },
      (_, i) => `यह वाक्य संख्या ${i} कहानी में है।`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script);
    const reconstructed = result.join(' ');
    // After splitting and joining, whitespace normalization should match
    expect(reconstructed.replace(/\s+/g, ' ').trim()).toBe(
      script.replace(/\s+/g, ' ').trim()
    );
  });

  it('splits at sentence boundaries (period)', () => {
    // Build a script > 1000 words with sentence boundaries
    const part1 = Array.from({ length: 490 }, () => 'word').join(' ') + '.';
    const part2 = Array.from({ length: 490 }, () => 'more').join(' ') + '.';
    const part3 = Array.from({ length: 100 }, () => 'extra').join(' ') + '.';
    const script = part1 + ' ' + part2 + ' ' + part3;
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script, 500);
    // First chunk should end at the period (sentence boundary)
    expect(result[0].trimEnd().slice(-1)).toBe('.');
  });

  it('splits at sentence boundaries (purna viram ।)', () => {
    // Build script > 1000 words with purna viram boundaries
    const sentences = Array.from(
      { length: 250 },
      (_, i) => `यह कहानी का भाग ${i} है।`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script, 500);
    expect(result.length).toBeGreaterThan(1);
    // Each chunk except the last should end at a purna viram
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].trimEnd().slice(-1)).toBe('।');
    }
  });

  it('splits at sentence boundaries (question mark)', () => {
    const sentences = Array.from(
      { length: 250 },
      (_, i) => `Is this question number ${i} in the long script?`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script, 500);
    expect(result.length).toBeGreaterThan(1);
    // Chunks should end at question marks
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].trimEnd().slice(-1)).toBe('?');
    }
  });

  it('splits at sentence boundaries (exclamation mark)', () => {
    const sentences = Array.from(
      { length: 250 },
      (_, i) => `Wow this is amazing scene number ${i} in the story!`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script, 500);
    expect(result.length).toBeGreaterThan(1);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].trimEnd().slice(-1)).toBe('!');
    }
  });

  it('falls back to word boundary when no sentence boundary exists', () => {
    // Create > 1000 words with no sentence-ending punctuation
    const words = Array.from({ length: 1500 }, (_, i) => `word${i}`);
    const script = words.join(' ');

    const result = chunkScript(script, 500);
    expect(result.length).toBeGreaterThan(1);
    // Each chunk should contain complete words (no mid-word breaks)
    for (const chunk of result) {
      const tokens = chunk.split(/\s+/).filter((w) => w.length > 0);
      for (const token of tokens) {
        expect(token).toMatch(/^word\d+$/);
      }
      expect(tokens.length).toBeLessThanOrEqual(500);
    }
  });

  // --- Edge cases ---

  it('handles empty string', () => {
    const result = chunkScript('');
    expect(result).toEqual(['']);
  });

  it('handles whitespace-only string', () => {
    const result = chunkScript('   ');
    expect(result).toEqual(['   ']);
  });

  it('respects custom maxWordsPerChunk parameter', () => {
    // Create > 1000 words with sentence boundaries
    const sentences = Array.from(
      { length: 250 },
      (_, i) => `This is sentence ${i} with some padding words added.`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script, 200);
    for (const chunk of result) {
      const words = chunk.split(/\s+/).filter((w) => w.length > 0).length;
      expect(words).toBeLessThanOrEqual(200);
    }
  });

  it('handles Hindi text with purna viram as sentence boundary', () => {
    const sentences = Array.from(
      { length: 300 },
      (_, i) => `यह कहानी का भाग ${i} है।`
    );
    const script = sentences.join(' ');
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script, 500);
    expect(result.length).toBeGreaterThan(1);
    // Each chunk except last should end at a purna viram
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].trimEnd().slice(-1)).toBe('।');
    }
  });

  it('handles mixed punctuation in Hindi text', () => {
    const script =
      'राम ने कहा। क्या तुम आ रहे हो? हाँ! मैं आ रहा हूँ। '.repeat(200);
    const wordCount = script.trim().split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);

    const result = chunkScript(script.trim(), 500);
    for (const chunk of result) {
      const words = chunk.split(/\s+/).filter((w) => w.length > 0).length;
      expect(words).toBeLessThanOrEqual(500);
    }
  });

  it('does not split a 1001-word script into chunks larger than maxWordsPerChunk', () => {
    // Exactly 1001 words — just over the threshold
    const words = Array.from({ length: 1001 }, (_, i) => `word${i}.`);
    const script = words.join(' ');

    const result = chunkScript(script, 500);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      const chunkWords = chunk.split(/\s+/).filter((w) => w.length > 0).length;
      expect(chunkWords).toBeLessThanOrEqual(500);
    }
  });

  it('concatenation works for scripts without sentence boundaries', () => {
    const words = Array.from({ length: 1500 }, (_, i) => `word${i}`);
    const script = words.join(' ');

    const result = chunkScript(script, 500);
    const reconstructed = result.join(' ');
    expect(reconstructed).toBe(script);
  });
});
