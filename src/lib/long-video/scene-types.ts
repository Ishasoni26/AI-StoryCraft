/**
 * Scene type assignment and validation for long-form video generation.
 * Ensures visual variety by distributing scene types and enforcing
 * a maximum of 3 consecutive scenes with the same type.
 *
 * Feature: long-video-export
 * Requirements: 2.3, 2.4
 */

import { ExtendedScene } from './types';

/** All available scene types for long-form videos. */
export const SCENE_TYPES: ExtendedScene['sceneType'][] = [
  'establishing',
  'close-up',
  'action',
  'emotional',
  'transition',
];

/**
 * Returns a narrative-aware type based on scene position in the story.
 * Early scenes favor establishing shots, middle scenes favor action/close-up,
 * and late scenes favor emotional/transition types.
 */
function getNarrativeType(position: number, total: number): ExtendedScene['sceneType'] {
  const ratio = total > 1 ? position / (total - 1) : 0;

  if (ratio < 0.15) {
    // Opening: establishing shots
    return 'establishing';
  } else if (ratio < 0.4) {
    // Rising action: close-up and action
    return position % 2 === 0 ? 'close-up' : 'action';
  } else if (ratio < 0.6) {
    // Climax: action and emotional
    return position % 2 === 0 ? 'action' : 'emotional';
  } else if (ratio < 0.85) {
    // Falling action: emotional and close-up
    return position % 2 === 0 ? 'emotional' : 'close-up';
  } else {
    // Resolution: transition and establishing
    return position % 2 === 0 ? 'transition' : 'establishing';
  }
}

/**
 * Assigns scene types to an array of scenes using narrative-aware logic
 * while ensuring no more than 3 consecutive scenes have the same type.
 *
 * Algorithm: uses scene position in the narrative to suggest a type,
 * then enforces the max-3-consecutive constraint by cycling to the next
 * available type when the limit would be exceeded.
 */
export function assignSceneTypes(scenes: ExtendedScene[]): ExtendedScene[] {
  if (scenes.length === 0) return [];

  const result: ExtendedScene[] = [];
  let consecutiveCount = 0;
  let lastType: ExtendedScene['sceneType'] | null = null;

  for (let i = 0; i < scenes.length; i++) {
    let currentType = getNarrativeType(i, scenes.length);

    // If this type matches the previous and we've hit 3 consecutive, force switch
    if (currentType === lastType && consecutiveCount >= 3) {
      // Pick the next different type from the SCENE_TYPES list
      const currentIndex = SCENE_TYPES.indexOf(currentType);
      currentType = SCENE_TYPES[(currentIndex + 1) % SCENE_TYPES.length];
    }

    // Track consecutive count
    if (currentType === lastType) {
      consecutiveCount++;
    } else {
      consecutiveCount = 1;
    }

    lastType = currentType;

    result.push({
      ...scenes[i],
      sceneType: currentType,
    });
  }

  return result;
}

/**
 * Validates that no more than 3 consecutive scenes have the same type.
 * Returns true if the constraint is satisfied.
 */
export function validateTypeSequence(types: string[]): boolean {
  if (types.length <= 3) return true;

  let consecutiveCount = 1;

  for (let i = 1; i < types.length; i++) {
    if (types[i] === types[i - 1]) {
      consecutiveCount++;
      if (consecutiveCount > 3) {
        return false;
      }
    } else {
      consecutiveCount = 1;
    }
  }

  return true;
}

/**
 * Counts the number of sentences in a dialogue string.
 * A sentence is defined as text terminated by:
 * - purna viram (।)
 * - period (.)
 * - question mark (?)
 * - exclamation mark (!)
 */
export function countSentences(dialogue: string): number {
  if (!dialogue || dialogue.trim().length === 0) return 0;

  // Count occurrences of sentence-ending punctuation
  const sentenceEnders = /[।.?!]/g;
  const matches = dialogue.match(sentenceEnders);

  return matches ? matches.length : 0;
}
