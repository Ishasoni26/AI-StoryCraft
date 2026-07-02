/**
 * Ken Burns effect calculator for long-form video export.
 *
 * Produces smooth zoom and pan parameters that create visual motion
 * on static scene images during video playback.
 *
 * Feature: long-video-export
 * Validates: Requirements 7.3
 */

/**
 * Smooth easing function (ease-in-out) for natural motion.
 * Maps a linear progress [0, 1] to a smoothed value [0, 1].
 */
function smoothStep(t: number): number {
  // Clamp to [0, 1] for safety
  const clamped = Math.max(0, Math.min(1, t));
  // Hermite interpolation (smoothstep)
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Calculates Ken Burns effect parameters (zoom and pan) for a given
 * progress point within a scene.
 *
 * @param progress - A value in [0, 1] representing how far through the scene we are.
 *   At 0 the effect starts with minimal zoom/pan; at 1 it reaches maximum.
 * @param sceneConfig - The frame dimensions for the scene.
 * @param sceneConfig.width - Frame width in pixels.
 * @param sceneConfig.height - Frame height in pixels.
 * @returns An object with zoom (in [1.05, 1.10]), panX (5-10% of width),
 *   and panY (5-10% of height).
 */
export function calculateKenBurns(
  progress: number,
  sceneConfig: { width: number; height: number }
): { zoom: number; panX: number; panY: number } {
  const { width, height } = sceneConfig;

  // Apply smooth interpolation to the progress value
  const smoothed = smoothStep(progress);

  // Zoom range: 1.05 (5% zoom) to 1.10 (10% zoom)
  const minZoom = 1.05;
  const maxZoom = 1.10;
  const zoom = minZoom + smoothed * (maxZoom - minZoom);

  // Pan range: 5% to 10% of frame dimensions
  const minPanFraction = 0.05;
  const maxPanFraction = 0.10;
  const panFraction = minPanFraction + smoothed * (maxPanFraction - minPanFraction);

  const panX = panFraction * width;
  const panY = panFraction * height;

  return { zoom, panX, panY };
}
