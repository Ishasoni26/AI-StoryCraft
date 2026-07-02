/**
 * Unit tests for Segment Assembler
 * Feature: long-video-export
 * Validates: Requirements 5.1, 5.2
 */

import { describe, it, expect } from 'vitest';
import { segmentScenes } from './segment-assembler';
import { ExtendedScene } from './types';

/** Helper to create a mock scene array of a given length */
function createScenes(count: number): ExtendedScene[] {
  return Array.from({ length: count }, (_, i) => ({
    imagePrompt: `Scene ${i + 1} prompt`,
    dialogue: `Scene ${i + 1} dialogue`,
  }));
}

describe('segmentScenes', () => {
  describe('scenes ≤ 30 (single segment, no subdivision)', () => {
    it('returns a single segment for an empty scene list', () => {
      const result = segmentScenes([]);
      expect(result).toEqual([[]]);
    });

    it('returns a single segment for 1 scene', () => {
      const scenes = createScenes(1);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0]).toEqual(scenes);
    });

    it('returns a single segment for 15 scenes', () => {
      const scenes = createScenes(15);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(15);
    });

    it('returns a single segment for exactly 30 scenes', () => {
      const scenes = createScenes(30);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(30);
      expect(result[0]).toEqual(scenes);
    });

    it('returns a single segment for 25 scenes', () => {
      const scenes = createScenes(25);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(25);
    });
  });

  describe('scenes > 30 (multiple segments of 15)', () => {
    it('divides 31 scenes into 3 segments: [15, 15, 1]', () => {
      const scenes = createScenes(31);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(15);
      expect(result[1]).toHaveLength(15);
      expect(result[2]).toHaveLength(1);
    });

    it('divides 45 scenes into 3 segments: [15, 15, 15]', () => {
      const scenes = createScenes(45);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(15);
      expect(result[1]).toHaveLength(15);
      expect(result[2]).toHaveLength(15);
    });

    it('divides 50 scenes into 4 segments: [15, 15, 15, 5]', () => {
      const scenes = createScenes(50);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(4);
      expect(result[0]).toHaveLength(15);
      expect(result[1]).toHaveLength(15);
      expect(result[2]).toHaveLength(15);
      expect(result[3]).toHaveLength(5);
    });

    it('divides 60 scenes into 4 segments: [15, 15, 15, 15]', () => {
      const scenes = createScenes(60);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(4);
      result.forEach((segment) => {
        expect(segment).toHaveLength(15);
      });
    });

    it('divides 100 scenes into 7 segments: 6×15 + 1×10', () => {
      const scenes = createScenes(100);
      const result = segmentScenes(scenes);
      expect(result).toHaveLength(7);
      for (let i = 0; i < 6; i++) {
        expect(result[i]).toHaveLength(15);
      }
      expect(result[6]).toHaveLength(10);
    });
  });

  describe('preserves scene data and order', () => {
    it('all scenes are present in the segments (no data loss)', () => {
      const scenes = createScenes(50);
      const result = segmentScenes(scenes);
      const flattened = result.flat();
      expect(flattened).toHaveLength(50);
      expect(flattened).toEqual(scenes);
    });

    it('maintains scene order across segments', () => {
      const scenes = createScenes(45);
      const result = segmentScenes(scenes);
      const flattened = result.flat();
      flattened.forEach((scene, index) => {
        expect(scene.imagePrompt).toBe(`Scene ${index + 1} prompt`);
      });
    });

    it('preserves scene references (same objects)', () => {
      const scenes = createScenes(31);
      const result = segmentScenes(scenes);
      expect(result[0][0]).toBe(scenes[0]);
      expect(result[2][0]).toBe(scenes[30]);
    });
  });
});
