/**
 * BGM (Background Music) Mixer for long-form video export.
 * Uses the Web Audio API to load, loop, crossfade, and mix background music
 * with narration audio at user-specified volume levels.
 *
 * Feature: long-video-export
 * Requirements: 7.5
 */

/** Duration of the crossfade applied at each BGM loop boundary, in seconds. */
const CROSSFADE_DURATION = 2;

export interface BGMMixer {
  /**
   * Loads and decodes a BGM audio file from a URL.
   * Must be called before any other method.
   */
  loadBGM(url: string): Promise<void>;

  /**
   * Creates an AudioBufferSourceNode configured for looped BGM playback
   * with gain applied. Note: crossfade is baked into the buffer via
   * getLoopedAudioBuffer for offline rendering scenarios.
   */
  createLoopedBGM(
    totalDurationSeconds: number,
    volume: number
  ): AudioBufferSourceNode;

  /**
   * Mixes narration and BGM audio nodes at the specified volume levels.
   * Returns a single AudioNode representing the combined output.
   */
  mixAudioSources(
    narrationNode: AudioNode,
    bgmNode: AudioNode,
    narrationVolume: number,
    bgmVolume: number
  ): AudioNode;

  /**
   * Returns a single AudioBuffer containing the BGM looped to fill the
   * specified duration with 2-second crossfades applied at each loop boundary.
   */
  getLoopedAudioBuffer(totalDurationSeconds: number): AudioBuffer;
}

/**
 * Creates a BGMMixer instance bound to the given AudioContext.
 *
 * Usage:
 * ```ts
 * const ctx = new AudioContext();
 * const mixer = createBGMMixer(ctx);
 * await mixer.loadBGM('/audio/bgm.mp3');
 * const loopedBuffer = mixer.getLoopedAudioBuffer(600); // 10 min
 * ```
 */
export function createBGMMixer(audioContext: AudioContext): BGMMixer {
  let bgmBuffer: AudioBuffer | null = null;

  return {
    async loadBGM(url: string): Promise<void> {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to load BGM from ${url}: ${response.status} ${response.statusText}`
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      bgmBuffer = await audioContext.decodeAudioData(arrayBuffer);
    },

    createLoopedBGM(
      totalDurationSeconds: number,
      volume: number
    ): AudioBufferSourceNode {
      if (!bgmBuffer) {
        throw new Error('BGM not loaded. Call loadBGM() first.');
      }

      const loopedBuffer = buildLoopedBuffer(
        audioContext,
        bgmBuffer,
        totalDurationSeconds
      );

      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = loopedBuffer;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = clampVolume(volume);

      sourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      return sourceNode;
    },

    mixAudioSources(
      narrationNode: AudioNode,
      bgmNode: AudioNode,
      narrationVolume: number,
      bgmVolume: number
    ): AudioNode {
      const narrationGain = audioContext.createGain();
      narrationGain.gain.value = clampVolume(narrationVolume);

      const bgmGain = audioContext.createGain();
      bgmGain.gain.value = clampVolume(bgmVolume);

      const merger = audioContext.createChannelMerger(2);

      narrationNode.connect(narrationGain);
      bgmGain.connect(merger);
      narrationGain.connect(merger);
      bgmNode.connect(bgmGain);

      return merger;
    },

    getLoopedAudioBuffer(totalDurationSeconds: number): AudioBuffer {
      if (!bgmBuffer) {
        throw new Error('BGM not loaded. Call loadBGM() first.');
      }

      return buildLoopedBuffer(audioContext, bgmBuffer, totalDurationSeconds);
    },
  };
}

/**
 * Builds an AudioBuffer containing the source BGM looped to fill the target
 * duration, with a 2-second crossfade applied at each loop boundary.
 *
 * Crossfade strategy:
 * - At each loop point, the last CROSSFADE_DURATION seconds of the ending
 *   iteration are linearly faded out while the first CROSSFADE_DURATION
 *   seconds of the next iteration are linearly faded in.
 * - This overlapping region prevents audible "clicks" at loop boundaries.
 */
function buildLoopedBuffer(
  audioContext: AudioContext,
  sourceBuffer: AudioBuffer,
  totalDurationSeconds: number
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate;
  const numberOfChannels = sourceBuffer.numberOfChannels;
  const totalSamples = Math.ceil(totalDurationSeconds * sampleRate);
  const crossfadeSamples = Math.min(
    Math.floor(CROSSFADE_DURATION * sampleRate),
    Math.floor(sourceBuffer.length / 2) // Don't crossfade more than half the source
  );

  const outputBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalSamples,
    sampleRate
  );

  const sourceLength = sourceBuffer.length;

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    let outputPos = 0;

    while (outputPos < totalSamples) {
      const remainingSamples = totalSamples - outputPos;
      const samplesToWrite = Math.min(sourceLength, remainingSamples);

      // Write the current loop iteration
      for (let i = 0; i < samplesToWrite; i++) {
        outputData[outputPos + i] = sourceData[i];
      }

      // Apply crossfade at the loop boundary
      // Only if there's a next iteration and enough room for the crossfade
      const nextIterationStart = outputPos + sourceLength;
      if (nextIterationStart < totalSamples && crossfadeSamples > 0) {
        // Crossfade region: last N samples of current iteration overlap with
        // first N samples of next iteration
        const fadeStart = outputPos + sourceLength - crossfadeSamples;

        for (let i = 0; i < crossfadeSamples; i++) {
          if (fadeStart + i >= totalSamples) break;

          const progress = i / crossfadeSamples; // 0 -> 1
          const fadeOutGain = 1 - progress; // current iteration fades out
          const fadeInGain = progress; // next iteration fades in

          // Current iteration's tail (fade out)
          const currentSample =
            sourceData[sourceLength - crossfadeSamples + i];
          // Next iteration's head (fade in)
          const nextSample = sourceData[i];

          outputData[fadeStart + i] =
            currentSample * fadeOutGain + nextSample * fadeInGain;
        }

        // Advance output position, but skip the crossfade overlap region
        // since it was already written as a blend
        outputPos += sourceLength - crossfadeSamples;
      } else {
        outputPos += samplesToWrite;
      }
    }
  }

  return outputBuffer;
}

/**
 * Clamps a volume value to [0, 1] range.
 */
function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}
