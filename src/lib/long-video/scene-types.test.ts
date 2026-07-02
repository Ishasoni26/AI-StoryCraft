import { describe, it, expect } from 'vitest';
import { assignSceneTypes, validateTypeSequence, countSentences } from './scene-types';
import { ExtendedScene } from './types';

function makeScene(dialogue: string = 'Test dialogue.'): ExtendedScene {
  return {
    imagePrompt: 'A test image prompt',
    dialogue,
  };
}

describe('scene-types', () => {
  describe('countSentences', () => {
    it('counts sentences terminated by period', () => {
      expect(countSentences('Hello world. How are you.')).toBe(2);
    });

    it('counts sentences terminated by purna viram', () => {
      expect(countSentences('यह एक कहानी है। एक लड़का था।')).toBe(2);
    });

    it('counts sentences terminated by question mark', () => {
      expect(countSentences('Who are you? What do you want?')).toBe(2);
    });

    it('counts sentences terminated by exclamation mark', () => {
      expect(countSentences('Wow! Amazing!')).toBe(2);
    });

    it('counts mixed sentence terminators', () => {
      expect(countSentences('Hello. How are you? Great!')).toBe(3);
    });

    it('counts Hindi mixed terminators', () => {
      expect(countSentences('यह क्या है? बहुत अच्छा। चलो!')).toBe(3);
    });

    it('returns 0 for empty string', () => {
      expect(countSentences('')).toBe(0);
    });

    it('returns 0 for whitespace only', () => {
      expect(countSentences('   ')).toBe(0);
    });

    it('returns 0 for text without sentence terminators', () => {
      expect(countSentences('Hello world')).toBe(0);
    });
  });

  describe('validateTypeSequence', () => {
    it('returns true for empty array', () => {
      expect(validateTypeSequence([])).toBe(true);
    });

    it('returns true for single element', () => {
      expect(validateTypeSequence(['establishing'])).toBe(true);
    });

    it('returns true for 3 consecutive same types', () => {
      expect(validateTypeSequence(['action', 'action', 'action', 'close-up'])).toBe(true);
    });

    it('returns false for 4 consecutive same types', () => {
      expect(validateTypeSequence(['action', 'action', 'action', 'action'])).toBe(false);
    });

    it('returns true for alternating types', () => {
      expect(validateTypeSequence(['establishing', 'close-up', 'establishing', 'close-up'])).toBe(true);
    });

    it('returns true for varied sequence with max 3 consecutive', () => {
      expect(validateTypeSequence([
        'establishing', 'establishing', 'establishing',
        'close-up', 'close-up', 'close-up',
        'action', 'action', 'action',
      ])).toBe(true);
    });

    it('returns false when 4 consecutive appear mid-sequence', () => {
      expect(validateTypeSequence([
        'establishing', 'close-up',
        'action', 'action', 'action', 'action',
        'emotional',
      ])).toBe(false);
    });
  });

  describe('assignSceneTypes', () => {
    it('returns empty array for empty input', () => {
      expect(assignSceneTypes([])).toEqual([]);
    });

    it('assigns a scene type to each scene', () => {
      const scenes = [makeScene(), makeScene(), makeScene()];
      const result = assignSceneTypes(scenes);

      result.forEach((scene) => {
        expect(scene.sceneType).toBeDefined();
        expect(['establishing', 'close-up', 'action', 'emotional', 'transition']).toContain(scene.sceneType);
      });
    });

    it('preserves original scene data', () => {
      const scenes = [
        { imagePrompt: 'prompt1', dialogue: 'dialogue1.' },
        { imagePrompt: 'prompt2', dialogue: 'dialogue2.' },
      ];
      const result = assignSceneTypes(scenes);

      expect(result[0].imagePrompt).toBe('prompt1');
      expect(result[0].dialogue).toBe('dialogue1.');
      expect(result[1].imagePrompt).toBe('prompt2');
      expect(result[1].dialogue).toBe('dialogue2.');
    });

    it('produces a valid type sequence (no more than 3 consecutive same type)', () => {
      const scenes = Array.from({ length: 50 }, () => makeScene());
      const result = assignSceneTypes(scenes);
      const types = result.map((s) => s.sceneType!);

      expect(validateTypeSequence(types)).toBe(true);
    });

    it('handles large arrays without violating constraint', () => {
      const scenes = Array.from({ length: 100 }, () => makeScene());
      const result = assignSceneTypes(scenes);
      const types = result.map((s) => s.sceneType!);

      expect(validateTypeSequence(types)).toBe(true);
    });
  });
});
