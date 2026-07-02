/**
 * Scene Batch Processor
 *
 * Processes scenes sequentially for image generation and TTS audio,
 * with rate limiting, retry logic, pause/resume, and progress tracking.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import type {
  ExtendedScene,
  BatchProcessorState,
  BatchProcessorConfig,
} from './types';

/** Default configuration matching design spec. */
const DEFAULT_CONFIG: BatchProcessorConfig = {
  imageDelay: 4000, // 4s minimum between image requests
  maxImageRetries: 3, // 3 retry attempts for 429/5xx
  retryDelay: 10000, // 10s wait before retry
  ttsRetries: 2, // 2 retry attempts for TTS
  ttsRetryDelay: 2000, // 2s wait before TTS retry
};

/** Summary returned after batch processing completes. */
export interface BatchProcessorSummary {
  totalTimeMs: number;
  totalTimeFormatted: string;
  successCount: number;
  failedCount: number;
}

type ProgressCallback = (state: BatchProcessorState) => void;

/**
 * SceneBatchProcessor handles the sequential generation of image and TTS
 * assets for a list of scenes, respecting API rate limits and providing
 * pause/resume capability with real-time progress updates.
 */
export class SceneBatchProcessor {
  private state: BatchProcessorState;
  private config: BatchProcessorConfig;
  private progressListeners: ProgressCallback[] = [];
  private pausePromiseResolve: (() => void) | null = null;
  private lastImageRequestTime = 0;

  constructor(config?: Partial<BatchProcessorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  /**
   * Starts processing all scenes for image and TTS generation.
   * Processes images sequentially with 4s delay; TTS runs in parallel per scene.
   */
  async start(scenes: ExtendedScene[]): Promise<void> {
    this.state = this.createInitialState();
    this.state.status = 'processing';
    this.state.totalScenes = scenes.length;
    this.state.startTime = Date.now();
    this.emitProgress();

    try {
      for (let i = 0; i < scenes.length; i++) {
        // Check pause state before processing each scene
        await this.waitIfPaused();

        this.state.currentScene = i + 1;
        this.emitProgress();

        const scene = scenes[i];
        const assets = await this.processScene(scene, i);

        // Store generated assets
        this.state.generatedAssets.set(i, assets);

        // Mark failed scenes with placeholder indicator (Requirement 4.3)
        if (!assets.imageUrl && scene.imagePrompt) {
          scene.hasFallbackImage = true;
        }

        // Update success/fail counts
        if (assets.imageUrl || !scene.imagePrompt) {
          this.state.successCount++;
        } else {
          this.state.failedCount++;
        }

        // Update progress percentage and estimated time
        this.state.percentComplete = Math.round(
          ((i + 1) / scenes.length) * 100
        );
        this.state.estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(
          i + 1,
          scenes.length
        );
        this.emitProgress();
      }

      this.state.status = 'complete';
      this.emitProgress();
    } catch (error) {
      this.state.status = 'error';
      this.emitProgress();
      throw error;
    }
  }

  /** Pauses the processing loop. Already-generated assets are retained. */
  pause(): void {
    if (this.state.status === 'processing') {
      this.state.isPaused = true;
      this.state.status = 'paused';
      this.emitProgress();
    }
  }

  /** Resumes the processing loop from the next unprocessed scene. */
  resume(): void {
    if (this.state.status === 'paused' && this.state.isPaused) {
      this.state.isPaused = false;
      this.state.status = 'processing';
      this.emitProgress();

      // Resolve the pause promise to unblock the processing loop
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
    }
  }

  /** Returns the current state of the batch processor. */
  getState(): BatchProcessorState {
    return { ...this.state };
  }

  /** Registers a callback that fires on every progress update. */
  onProgress(callback: ProgressCallback): void {
    this.progressListeners.push(callback);
  }

  /** Returns the completion summary. Only meaningful when status is 'complete'. */
  getSummary(): BatchProcessorSummary {
    const totalTimeMs = Date.now() - this.state.startTime;
    const totalSeconds = Math.floor(totalTimeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return {
      totalTimeMs,
      totalTimeFormatted: `${minutes}m ${seconds}s`,
      successCount: this.state.successCount,
      failedCount: this.state.failedCount,
    };
  }

  // ─── Private Methods ────────────────────────────────────────────────

  private createInitialState(): BatchProcessorState {
    return {
      status: 'idle',
      currentScene: 0,
      totalScenes: 0,
      percentComplete: 0,
      estimatedTimeRemaining: 0,
      successCount: 0,
      failedCount: 0,
      isPaused: false,
      startTime: 0,
      generatedAssets: new Map(),
    };
  }

  /**
   * Processes a single scene: generates image (with rate limiting) and
   * TTS audio in parallel.
   */
  private async processScene(
    scene: ExtendedScene,
    _index: number
  ): Promise<{ imageUrl?: string; audioUrl?: string }> {
    // Launch image and TTS in parallel (Requirement 4.4)
    const [imageUrl, audioUrl] = await Promise.all([
      this.generateImage(scene),
      this.generateTTS(scene),
    ]);

    return { imageUrl: imageUrl ?? undefined, audioUrl: audioUrl ?? undefined };
  }

  /**
   * Generates an image for the scene via /api/image.
   * Enforces 4s minimum delay between requests (Requirement 4.1).
   * Retries on 429/5xx with 10s delay, up to 3 times (Requirement 4.3).
   */
  private async generateImage(scene: ExtendedScene): Promise<string | null> {
    if (!scene.imagePrompt) return null;

    // Enforce minimum delay between image requests
    await this.enforceImageDelay();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxImageRetries; attempt++) {
      try {
        this.lastImageRequestTime = Date.now();

        const response = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: scene.imagePrompt }),
        });

        if (response.ok) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        }

        // Retry on rate limit or server errors
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`HTTP ${response.status}`);
          if (attempt < this.config.maxImageRetries) {
            await this.delay(this.config.retryDelay);
            continue;
          }
        } else {
          // Non-retryable error
          lastError = new Error(`HTTP ${response.status}`);
          break;
        }
      } catch (error: any) {
        lastError = error;
        if (attempt < this.config.maxImageRetries) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    // All retries exhausted — mark scene with placeholder (Requirement 4.3)
    console.warn(
      `Image generation failed for scene after ${this.config.maxImageRetries + 1} attempts:`,
      lastError?.message
    );
    // The scene will be marked with hasFallbackImage: true by the caller
    return null;
  }

  /**
   * Generates TTS audio for the scene via /api/tts with chunked: true.
   * Retries on failure up to ttsRetries times with ttsRetryDelay.
   */
  private async generateTTS(scene: ExtendedScene): Promise<string | null> {
    if (!scene.dialogue) return null;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.ttsRetries; attempt++) {
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: scene.dialogue, chunked: true }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.audioUrl ?? null;
        }

        lastError = new Error(`TTS HTTP ${response.status}`);
        if (attempt < this.config.ttsRetries) {
          await this.delay(this.config.ttsRetryDelay);
        }
      } catch (error: any) {
        lastError = error;
        if (attempt < this.config.ttsRetries) {
          await this.delay(this.config.ttsRetryDelay);
        }
      }
    }

    console.warn(
      `TTS generation failed for scene after ${this.config.ttsRetries + 1} attempts:`,
      lastError?.message
    );
    return null;
  }

  /**
   * Enforces a minimum delay between consecutive image API requests.
   * Waits the remaining time if the minimum interval hasn't elapsed.
   */
  private async enforceImageDelay(): Promise<void> {
    if (this.lastImageRequestTime === 0) return;

    const elapsed = Date.now() - this.lastImageRequestTime;
    const remaining = this.config.imageDelay - elapsed;

    if (remaining > 0) {
      await this.delay(remaining);
    }
  }

  /**
   * Blocks execution while the processor is paused.
   * Resolves when resume() is called.
   */
  private async waitIfPaused(): Promise<void> {
    if (!this.state.isPaused) return;

    return new Promise<void>((resolve) => {
      this.pausePromiseResolve = resolve;
    });
  }

  /**
   * Calculates estimated time remaining based on average processing time
   * of completed scenes.
   */
  private calculateEstimatedTimeRemaining(
    completedScenes: number,
    totalScenes: number
  ): number {
    if (completedScenes === 0) return 0;

    const elapsedMs = Date.now() - this.state.startTime;
    const avgTimePerScene = elapsedMs / completedScenes;
    const remainingScenes = totalScenes - completedScenes;

    return Math.round((avgTimePerScene * remainingScenes) / 1000);
  }

  /** Emits progress state to all registered listeners. */
  private emitProgress(): void {
    const stateCopy = this.getState();
    for (const listener of this.progressListeners) {
      listener(stateCopy);
    }
  }

  /** Promise-based delay utility. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
