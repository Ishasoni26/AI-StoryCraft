/**
 * Segment Assembler for long-form video export.
 * Divides scene lists into manageable segments for rendering.
 *
 * Feature: long-video-export
 * Requirements: 5.1, 5.2
 */

import { ExtendedScene } from './types';

const SEGMENT_SIZE = 15;
const SEGMENTATION_THRESHOLD = 30;

/**
 * Segments a list of scenes into groups for sequential rendering.
 *
 * - If scenes.length > 30: divides into segments of 15 scenes each
 *   (final segment gets the remainder)
 * - If scenes.length ≤ 30: returns a single segment containing all scenes
 *
 * @param scenes - The full list of scenes to segment
 * @returns An array of scene arrays, where each inner array is one segment
 */
export function segmentScenes(scenes: ExtendedScene[]): ExtendedScene[][] {
  if (scenes.length <= SEGMENTATION_THRESHOLD) {
    return [scenes];
  }

  const segments: ExtendedScene[][] = [];
  for (let i = 0; i < scenes.length; i += SEGMENT_SIZE) {
    segments.push(scenes.slice(i, i + SEGMENT_SIZE));
  }

  return segments;
}
