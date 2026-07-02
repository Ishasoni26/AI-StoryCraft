import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneBatchProcessor } from './batch-processor';
import type { ExtendedScene } from './types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock-url') });

function createScene(overrides?: Partial<ExtendedScene>): ExtendedScene {
  return {
    imagePrompt: 'A beautiful sunset',
    dialogue: 'Hello world',
    ...overrides,
  };
}

function createImageResponse(ok = true, status = 200) {
  if (ok) {
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['image-data'])),
    });
  }
  return Promise.resolve({
    ok: false,
    status,
    blob: () => Promise.resolve(new Blob()),
  });
}

function createTTSResponse(ok = true) {
  if (ok) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ audioUrl: 'data:audio/mp3;base64,abc123' }),
    });
  }
  return Promise.resolve({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'fail' }),
  });
}

describe('SceneBatchProcessor', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should initialize with idle state', () => {
    const processor = new SceneBatchProcessor();
    const state = processor.getState();

    expect(state.status).toBe('idle');
    expect(state.currentScene).toBe(0);
    expect(state.totalScenes).toBe(0);
    expect(state.percentComplete).toBe(0);
    expect(state.isPaused).toBe(false);
    expect(state.successCount).toBe(0);
    expect(state.failedCount).toBe(0);
  });

  it('should process scenes and reach complete status', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene(), createScene()];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse();
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    const progressStates: string[] = [];
    processor.onProgress((state) => progressStates.push(state.status));

    await processor.start(scenes);

    const state = processor.getState();
    expect(state.status).toBe('complete');
    expect(state.totalScenes).toBe(2);
    expect(state.successCount).toBe(2);
    expect(state.failedCount).toBe(0);
    expect(state.percentComplete).toBe(100);
    expect(progressStates).toContain('processing');
    expect(progressStates).toContain('complete');
  });

  it('should call /api/image with scene imagePrompt', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene({ imagePrompt: 'A red car' })];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse();
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    const imageCall = mockFetch.mock.calls.find(
      (call) => call[0] === '/api/image'
    );
    expect(imageCall).toBeDefined();
    const body = JSON.parse(imageCall![1].body);
    expect(body.prompt).toBe('A red car');
  });

  it('should call /api/tts with chunked: true', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene({ dialogue: 'Some dialogue text' })];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse();
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    const ttsCall = mockFetch.mock.calls.find(
      (call) => call[0] === '/api/tts'
    );
    expect(ttsCall).toBeDefined();
    const body = JSON.parse(ttsCall![1].body);
    expect(body.text).toBe('Some dialogue text');
    expect(body.chunked).toBe(true);
  });

  it('should mark scene as failed when image retries are exhausted (429)', async () => {
    const processor = new SceneBatchProcessor({
      imageDelay: 0,
      maxImageRetries: 3,
      retryDelay: 0,
      ttsRetryDelay: 0,
    });
    const scenes = [createScene()];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse(false, 429);
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    const state = processor.getState();
    expect(state.failedCount).toBe(1);
    expect(state.successCount).toBe(0);

    // Asset should have no imageUrl
    const asset = state.generatedAssets.get(0);
    expect(asset?.imageUrl).toBeUndefined();
    expect(asset?.audioUrl).toBeDefined();

    // Scene should be marked with hasFallbackImage (Requirement 4.3)
    expect(scenes[0].hasFallbackImage).toBe(true);
  });

  it('should mark scene as failed when image retries are exhausted (5xx)', async () => {
    const processor = new SceneBatchProcessor({
      imageDelay: 0,
      maxImageRetries: 3,
      retryDelay: 0,
      ttsRetryDelay: 0,
    });
    const scenes = [createScene()];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse(false, 503);
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    const state = processor.getState();
    expect(state.failedCount).toBe(1);
  });

  it('should retry image request up to maxImageRetries times on 429', async () => {
    const processor = new SceneBatchProcessor({
      imageDelay: 0,
      maxImageRetries: 3,
      retryDelay: 0,
      ttsRetryDelay: 0,
    });
    const scenes = [createScene()];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse(false, 429);
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    // Should have called /api/image 4 times (1 initial + 3 retries)
    const imageCalls = mockFetch.mock.calls.filter(
      (call) => call[0] === '/api/image'
    );
    expect(imageCalls.length).toBe(4);
  });

  it('should succeed on retry after initial 429', async () => {
    const processor = new SceneBatchProcessor({
      imageDelay: 0,
      maxImageRetries: 3,
      retryDelay: 0,
      ttsRetryDelay: 0,
    });
    const scenes = [createScene()];

    let imageAttempt = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') {
        imageAttempt++;
        if (imageAttempt === 1) return createImageResponse(false, 429);
        return createImageResponse(true);
      }
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    const state = processor.getState();
    expect(state.successCount).toBe(1);
    expect(state.failedCount).toBe(0);
  });

  it('should support pause and resume', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene(), createScene(), createScene()];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse();
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    // Start processing and pause immediately
    const startPromise = processor.start(scenes);

    // Pause after first scene would be processed
    // We'll verify pause/resume works via state checks
    processor.pause();
    expect(processor.getState().status).toBe('paused');
    expect(processor.getState().isPaused).toBe(true);

    // Resume
    processor.resume();
    expect(processor.getState().status).toBe('processing');
    expect(processor.getState().isPaused).toBe(false);

    await startPromise;
    expect(processor.getState().status).toBe('complete');
  });

  it('should emit progress callbacks with correct state', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene()];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse();
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    const progressUpdates: Array<{ currentScene: number; percentComplete: number }> = [];
    processor.onProgress((state) => {
      progressUpdates.push({
        currentScene: state.currentScene,
        percentComplete: state.percentComplete,
      });
    });

    await processor.start(scenes);

    // Should have received progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);
    // Last update should be 100%
    const last = progressUpdates[progressUpdates.length - 1];
    expect(last.percentComplete).toBe(100);
  });

  it('should skip image generation for scenes without imagePrompt', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene({ imagePrompt: '' })];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('should not call image'));
    });

    await processor.start(scenes);

    const imageCalls = mockFetch.mock.calls.filter(
      (call) => call[0] === '/api/image'
    );
    expect(imageCalls.length).toBe(0);
    expect(processor.getState().successCount).toBe(1);
  });

  it('should skip TTS generation for scenes without dialogue', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene({ dialogue: '' })];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse();
      return Promise.reject(new Error('should not call tts'));
    });

    await processor.start(scenes);

    const ttsCalls = mockFetch.mock.calls.filter(
      (call) => call[0] === '/api/tts'
    );
    expect(ttsCalls.length).toBe(0);
  });

  it('should provide completion summary', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene(), createScene()];

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/image') return createImageResponse();
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    const summary = processor.getSummary();
    expect(summary.successCount).toBe(2);
    expect(summary.failedCount).toBe(0);
    expect(summary.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(summary.totalTimeFormatted).toMatch(/^\d+m \d+s$/);
  });

  it('should generate assets in parallel (image + TTS for same scene)', async () => {
    const processor = new SceneBatchProcessor({ imageDelay: 0 });
    const scenes = [createScene()];

    const callOrder: string[] = [];
    mockFetch.mockImplementation((url: string) => {
      callOrder.push(url);
      if (url === '/api/image') return createImageResponse();
      if (url === '/api/tts') return createTTSResponse();
      return Promise.reject(new Error('unknown url'));
    });

    await processor.start(scenes);

    // Both image and TTS should be called for the same scene
    expect(callOrder).toContain('/api/image');
    expect(callOrder).toContain('/api/tts');

    // Assets should have both
    const asset = processor.getState().generatedAssets.get(0);
    expect(asset?.imageUrl).toBeDefined();
    expect(asset?.audioUrl).toBeDefined();
  });
});
