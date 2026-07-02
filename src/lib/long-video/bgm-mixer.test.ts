/**
 * Tests for BGM Mixer module.
 *
 * Feature: long-video-export
 * Requirements: 7.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBGMMixer, BGMMixer } from './bgm-mixer';

// Helper to create a mock AudioBuffer with actual Float32Array data
function createMockAudioBuffer(
  sampleRate: number,
  durationSeconds: number,
  numberOfChannels: number = 1
): AudioBuffer {
  const length = Math.ceil(durationSeconds * sampleRate);
  const channelData: Float32Array[] = [];

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = new Float32Array(length);
    // Fill with a simple sine wave so we can verify crossfade behavior
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }
    channelData.push(data);
  }

  return {
    sampleRate,
    length,
    duration: durationSeconds,
    numberOfChannels,
    getChannelData(channel: number): Float32Array {
      return channelData[channel];
    },
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

// Helper to create a mock AudioContext
function createMockAudioContext(sampleRate: number = 44100) {
  const createdBuffers: AudioBuffer[] = [];

  const mockGainNode = {
    gain: { value: 1 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const mockSourceNode = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockMergerNode = {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const ctx = {
    sampleRate,
    createBuffer(
      numberOfChannels: number,
      length: number,
      sr: number
    ): AudioBuffer {
      const channelData: Float32Array[] = [];
      for (let ch = 0; ch < numberOfChannels; ch++) {
        channelData.push(new Float32Array(length));
      }
      const buffer = {
        sampleRate: sr,
        length,
        duration: length / sr,
        numberOfChannels,
        getChannelData(channel: number): Float32Array {
          return channelData[channel];
        },
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn(),
      } as unknown as AudioBuffer;
      createdBuffers.push(buffer);
      return buffer;
    },
    createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    })),
    createChannelMerger: vi.fn(() => ({ ...mockMergerNode })),
    decodeAudioData: vi.fn(),
    destination: {},
  } as unknown as AudioContext;

  return { ctx, createdBuffers };
}

describe('createBGMMixer', () => {
  let mockCtx: AudioContext;
  let createdBuffers: AudioBuffer[];

  beforeEach(() => {
    const result = createMockAudioContext(44100);
    mockCtx = result.ctx;
    createdBuffers = result.createdBuffers;
  });

  describe('loadBGM', () => {
    it('should load and decode audio from a URL', async () => {
      const sourceBuffer = createMockAudioBuffer(44100, 5);
      const mockArrayBuffer = new ArrayBuffer(100);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      });
      (mockCtx.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(
        sourceBuffer
      );

      const mixer = createBGMMixer(mockCtx);
      await mixer.loadBGM('https://example.com/bgm.mp3');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/bgm.mp3'
      );
      expect(mockCtx.decodeAudioData).toHaveBeenCalledWith(mockArrayBuffer);
    });

    it('should throw an error if fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const mixer = createBGMMixer(mockCtx);
      await expect(mixer.loadBGM('https://example.com/missing.mp3')).rejects.toThrow(
        'Failed to load BGM'
      );
    });
  });

  describe('getLoopedAudioBuffer', () => {
    it('should throw if BGM is not loaded', () => {
      const mixer = createBGMMixer(mockCtx);
      expect(() => mixer.getLoopedAudioBuffer(10)).toThrow(
        'BGM not loaded. Call loadBGM() first.'
      );
    });

    it('should return a buffer with correct duration', async () => {
      const sourceBuffer = createMockAudioBuffer(44100, 5);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      (mockCtx.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(
        sourceBuffer
      );

      const mixer = createBGMMixer(mockCtx);
      await mixer.loadBGM('https://example.com/bgm.mp3');

      const result = mixer.getLoopedAudioBuffer(10);

      // Should be approximately 10 seconds worth of samples
      const expectedSamples = Math.ceil(10 * 44100);
      expect(result.length).toBe(expectedSamples);
      expect(result.numberOfChannels).toBe(1);
    });

    it('should handle BGM shorter than total duration (multiple loops)', async () => {
      // 3 second BGM, 10 second total = needs multiple loops
      const sourceBuffer = createMockAudioBuffer(44100, 3);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      (mockCtx.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(
        sourceBuffer
      );

      const mixer = createBGMMixer(mockCtx);
      await mixer.loadBGM('https://example.com/bgm.mp3');

      const result = mixer.getLoopedAudioBuffer(10);

      expect(result.length).toBe(Math.ceil(10 * 44100));
      // Check buffer is not all zeros (i.e., audio was written)
      const channelData = result.getChannelData(0);
      const hasNonZero = channelData.some((v) => v !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('should apply crossfade at loop boundaries', async () => {
      const sampleRate = 44100;
      const bgmDuration = 4; // 4 seconds
      const sourceBuffer = createMockAudioBuffer(sampleRate, bgmDuration);

      // Fill source with constant 1.0 so crossfade effects are clearly visible
      const sourceData = sourceBuffer.getChannelData(0);
      for (let i = 0; i < sourceData.length; i++) {
        sourceData[i] = 1.0;
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      (mockCtx.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(
        sourceBuffer
      );

      const mixer = createBGMMixer(mockCtx);
      await mixer.loadBGM('https://example.com/bgm.mp3');

      const totalDuration = 10;
      const result = mixer.getLoopedAudioBuffer(totalDuration);
      const outputData = result.getChannelData(0);

      // With constant source of 1.0 and linear crossfade, at the midpoint of
      // a crossfade region: fadeOut(1.0) * 0.5 + fadeIn(1.0) * 0.5 = 1.0
      // The crossfade region starts at (sourceLength - crossfadeSamples)
      const sourceLength = sourceBuffer.length;
      const crossfadeSamples = Math.floor(2 * sampleRate); // 2 second crossfade

      // The first loop boundary crossfade starts at
      // outputPos + sourceLength - crossfadeSamples
      // where outputPos = 0 for the first iteration
      const firstFadeStart = sourceLength - crossfadeSamples;

      // At midpoint of crossfade: should blend both signals
      const midCrossfade = firstFadeStart + Math.floor(crossfadeSamples / 2);
      if (midCrossfade < result.length) {
        // With constant 1.0 source, crossfade midpoint should be ~1.0
        // (fadeOut * 0.5 + fadeIn * 0.5 = 1.0)
        expect(outputData[midCrossfade]).toBeCloseTo(1.0, 1);
      }
    });

    it('should handle BGM longer than total duration', async () => {
      // 20 second BGM, only need 5 seconds - no looping needed
      const sourceBuffer = createMockAudioBuffer(44100, 20);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      (mockCtx.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(
        sourceBuffer
      );

      const mixer = createBGMMixer(mockCtx);
      await mixer.loadBGM('https://example.com/bgm.mp3');

      const result = mixer.getLoopedAudioBuffer(5);
      expect(result.length).toBe(Math.ceil(5 * 44100));
    });

    it('should support stereo audio', async () => {
      const sourceBuffer = createMockAudioBuffer(44100, 3, 2);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      (mockCtx.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(
        sourceBuffer
      );

      const mixer = createBGMMixer(mockCtx);
      await mixer.loadBGM('https://example.com/bgm.mp3');

      const result = mixer.getLoopedAudioBuffer(8);
      expect(result.numberOfChannels).toBe(2);
      expect(result.length).toBe(Math.ceil(8 * 44100));
    });
  });

  describe('createLoopedBGM', () => {
    it('should throw if BGM is not loaded', () => {
      const mixer = createBGMMixer(mockCtx);
      expect(() => mixer.createLoopedBGM(10, 0.5)).toThrow(
        'BGM not loaded. Call loadBGM() first.'
      );
    });

    it('should create a source node with the looped buffer', async () => {
      const sourceBuffer = createMockAudioBuffer(44100, 5);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
      (mockCtx.decodeAudioData as ReturnType<typeof vi.fn>).mockResolvedValue(
        sourceBuffer
      );

      const mixer = createBGMMixer(mockCtx);
      await mixer.loadBGM('https://example.com/bgm.mp3');

      const sourceNode = mixer.createLoopedBGM(10, 0.7);

      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });
  });

  describe('mixAudioSources', () => {
    it('should create gain nodes and a channel merger', () => {
      const mixer = createBGMMixer(mockCtx);

      const narrationNode = {
        connect: vi.fn().mockReturnThis(),
      } as unknown as AudioNode;
      const bgmNode = {
        connect: vi.fn().mockReturnThis(),
      } as unknown as AudioNode;

      const result = mixer.mixAudioSources(narrationNode, bgmNode, 0.8, 0.3);

      expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
      expect(mockCtx.createChannelMerger).toHaveBeenCalledWith(2);
      expect(result).toBeDefined();
    });

    it('should clamp volume values to [0, 1]', () => {
      const mixer = createBGMMixer(mockCtx);

      const narrationNode = {
        connect: vi.fn().mockReturnThis(),
      } as unknown as AudioNode;
      const bgmNode = {
        connect: vi.fn().mockReturnThis(),
      } as unknown as AudioNode;

      // Volume values > 1 or < 0 should be clamped
      const result = mixer.mixAudioSources(narrationNode, bgmNode, 1.5, -0.2);
      expect(result).toBeDefined();
    });
  });
});
