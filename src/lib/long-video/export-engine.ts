/**
 * Export Engine for long-form video export.
 *
 * Uses Canvas-based rendering with MediaRecorder to produce video output.
 * Processes scenes in segments for memory safety, applies Ken Burns effects,
 * renders subtitles, and supports adaptive bitrate for file size constraints.
 *
 * Feature: long-video-export
 * Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3, 7.4, 7.6, 7.7
 */

import { ExtendedScene, ExportConfig, ExportState, SegmentResult } from './types';
import { calculateKenBurns } from './ken-burns';
import { adjustBitrateForFileSize } from './bitrate-calculator';
import { calculateTotalDuration, formatDuration } from './duration-calculator';

export interface ExportOptions {
  subtitleStyle?: 'viral' | 'cinematic' | 'none';
  bgmUrl?: string;
  bgmVolume?: number;
  narrationVolume?: number;
}

type ProgressCallback = (state: ExportState) => void;

/**
 * ExportEngine handles canvas-based video rendering using MediaRecorder.
 *
 * It processes scenes in segments to avoid memory issues, applies Ken Burns
 * effects to images, renders synchronized subtitles, and produces a final
 * video blob suitable for YouTube upload.
 */
export class ExportEngine {
  private state: ExportState;
  private progressCallbacks: ProgressCallback[] = [];
  private completedSegmentBlobs: Blob[] = [];
  private exportStartTime: number = 0;

  constructor() {
    this.state = this.createInitialState();
  }

  /**
   * Returns the current export state.
   */
  getState(): ExportState {
    return { ...this.state };
  }

  /**
   * Registers a callback to receive progress updates during export.
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Main export method. Renders all scenes into a single video blob.
   *
   * @param scenes - Array of extended scenes with image/audio data
   * @param config - Export configuration (resolution, bitrate, fps, etc.)
   * @param options - Optional subtitle style, BGM, and volume settings
   * @returns Final video blob
   */
  async export(
    scenes: ExtendedScene[],
    config: ExportConfig,
    options?: ExportOptions
  ): Promise<Blob> {
    this.completedSegmentBlobs = [];
    this.exportStartTime = Date.now();

    try {
      // Phase 1: Calculate duration and adaptive bitrate
      this.updateState({ phase: 'calculating', progressPercent: 0 });

      const durationEstimate = this.calculateDuration(scenes);
      this.updateState({ estimatedDuration: durationEstimate.formattedDuration });

      const totalDurationSeconds = durationEstimate.totalDurationMs / 1000;
      const { bitrate: adjustedVideoBitrate, adjusted: bitrateAdjusted } =
        adjustBitrateForFileSize(
          totalDurationSeconds,
          config.videoBitrate,
          config.maxFileSizeBytes
        );

      if (bitrateAdjusted) {
        // Notify caller of bitrate reduction
        this.updateState({
          error: `Bitrate reduced to ${Math.round(adjustedVideoBitrate / 1_000_000 * 100) / 100} Mbps to keep file under 2GB`,
        });
      }

      const effectiveConfig = { ...config, videoBitrate: adjustedVideoBitrate };

      // Phase 2: Render all scenes in a single session (no segmentation)
      this.updateState({
        phase: 'rendering',
        totalSegments: 1,
        currentSegment: 1,
      });

      const segmentResult = await this.renderSegment(
        scenes,
        effectiveConfig,
        options,
        0,
        1,
        0
      );

      // Phase 3: Complete (no concatenation needed with single session)
      this.updateState({ phase: 'concatenating', progressPercent: 95 });

      const finalBlob = segmentResult.blob;

      this.updateState({
        phase: 'complete',
        progressPercent: 100,
        estimatedTimeRemaining: 0,
      });

      return finalBlob;
    } catch (error) {
      if (this.state.phase !== 'error') {
        const partialBlob = this.createPartialBlob();
        this.updateState({
          phase: 'error',
          error: error instanceof Error ? error.message : 'Unknown export error',
          partialBlob,
        });
      }
      throw error;
    }
  }

  /**
   * Renders a single segment of scenes into a video blob using MediaRecorder.
   */
  private async renderSegment(
    scenes: ExtendedScene[],
    config: ExportConfig,
    options: ExportOptions | undefined,
    segmentIndex: number,
    totalSegments: number,
    globalSceneOffset: number
  ): Promise<SegmentResult> {
    const { width, height } = config.resolution;
    const fps = config.fps;

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context creation failure: cannot proceed with export');
    }

    // Set up audio context for mixing
    const audioContext = new AudioContext();
    const audioDestination = audioContext.createMediaStreamDestination();

    // Create MediaRecorder with appropriate codec
    const canvasStream = canvas.captureStream(fps);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);

    const mimeType = this.selectMimeType();
    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: config.videoBitrate,
      audioBitsPerSecond: config.audioBitrate,
    });

    const chunks: Blob[] = [];

    return new Promise<SegmentResult>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${(event as ErrorEvent).message || 'unknown'}`));
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const startScene = globalSceneOffset;
        const endScene = globalSceneOffset + scenes.length - 1;
        const durationMs = scenes.reduce(
          (sum, s) => sum + (s.audioDurationMs || 3000),
          0
        );

        audioContext.close();

        resolve({
          blob,
          sceneRange: [startScene, endScene],
          durationMs,
        });
      };

      // Start recording
      recorder.start(1000); // collect data every 1 second

      // Render scenes sequentially
      this.renderScenesOnCanvas(
        scenes,
        ctx,
        config,
        options,
        audioContext,
        audioDestination,
        segmentIndex,
        totalSegments,
        globalSceneOffset
      )
        .then(() => {
          recorder.stop();
        })
        .catch((error) => {
          recorder.stop();
          reject(error);
        });
    });
  }

  /**
   * Renders all scenes in a segment onto the canvas frame-by-frame.
   */
  private async renderScenesOnCanvas(
    scenes: ExtendedScene[],
    ctx: CanvasRenderingContext2D,
    config: ExportConfig,
    options: ExportOptions | undefined,
    audioContext: AudioContext,
    audioDestination: MediaStreamAudioDestinationNode,
    segmentIndex: number,
    totalSegments: number,
    globalSceneOffset: number
  ): Promise<void> {
    const { width, height } = config.resolution;
    const fps = config.fps;
    const frameDurationMs = 1000 / fps;

    for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
      const scene = scenes[sceneIdx];
      const sceneDurationMs = scene.audioDurationMs || 3000;
      const totalFrames = Math.ceil((sceneDurationMs / 1000) * fps);

      // Load scene image
      const image = await this.loadImage(scene.imageUrl || '');

      // Play scene audio if available
      if (scene.audioUrl) {
        await this.playSceneAudio(
          scene.audioUrl,
          audioContext,
          audioDestination,
          options?.narrationVolume ?? 1.0
        );
      }

      // Render frames for this scene
      for (let frame = 0; frame < totalFrames; frame++) {
        const progress = totalFrames > 1 ? frame / (totalFrames - 1) : 0;

        // Apply Ken Burns effect
        const kenBurns = calculateKenBurns(progress, { width, height });

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw image with Ken Burns transform
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(kenBurns.zoom, kenBurns.zoom);
        ctx.translate(-width / 2 - kenBurns.panX, -height / 2 - kenBurns.panY);

        if (image) {
          ctx.drawImage(image, 0, 0, width, height);
        } else {
          // Fallback: black frame
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.restore();

        // Render subtitles
        if (options?.subtitleStyle && options.subtitleStyle !== 'none') {
          this.renderSubtitle(ctx, scene.dialogue, progress, width, height, options.subtitleStyle);
        }

        // Wait for frame duration to maintain fps
        await this.waitFrame(frameDurationMs);
      }

      // Update progress
      const globalSceneIndex = globalSceneOffset + sceneIdx;
      const totalScenes = totalSegments > 1 ? segmentIndex * 15 + scenes.length : scenes.length;
      const overallProgress = Math.round(
        ((globalSceneIndex + 1) / totalScenes) * 90
      ); // 90% for rendering, 10% for concatenation

      const elapsed = Date.now() - this.exportStartTime;
      const rate = (globalSceneIndex + 1) / elapsed;
      const remaining = rate > 0 ? (totalScenes - globalSceneIndex - 1) / rate : 0;

      this.updateState({
        progressPercent: overallProgress,
        estimatedTimeRemaining: Math.round(remaining / 1000),
      });

      // Release image reference for GC
      if (image) {
        (image as HTMLImageElement).src = '';
      }
    }
  }

  /**
   * Loads an image from a URL (blob URL or data URL).
   */
  private loadImage(url: string): Promise<HTMLImageElement | null> {
    if (!url) return Promise.resolve(null);

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // Continue with black frame on error
      img.src = url;
    });
  }

  /**
   * Plays scene narration audio through the audio destination for mixing.
   */
  private async playSceneAudio(
    audioUrl: string,
    audioContext: AudioContext,
    destination: MediaStreamAudioDestinationNode,
    volume: number
  ): Promise<void> {
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = audioBuffer;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(destination);

      source.start(audioContext.currentTime);
    } catch {
      // Audio decode error: continue rendering with silence for that scene
      console.warn('Audio decode error: rendering scene with silence');
    }
  }

  /**
   * Renders subtitle text on the canvas frame.
   */
  private renderSubtitle(
    ctx: CanvasRenderingContext2D,
    dialogue: string,
    progress: number,
    width: number,
    height: number,
    style: 'viral' | 'cinematic'
  ): void {
    if (!dialogue) return;

    // Calculate which portion of dialogue to show based on progress
    const words = dialogue.split(/\s+/);
    const wordIndex = Math.min(
      Math.floor(progress * words.length),
      words.length - 1
    );

    // Show current segment of words (context window around current word)
    const windowSize = style === 'viral' ? 3 : 6;
    const startWord = Math.max(0, wordIndex - Math.floor(windowSize / 2));
    const endWord = Math.min(words.length, startWord + windowSize);
    const visibleText = words.slice(startWord, endWord).join(' ');

    ctx.save();

    if (style === 'viral') {
      // Viral style: bold, centered, large text with dark background
      const fontSize = Math.round(width * 0.04);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textMetrics = ctx.measureText(visibleText);
      const textHeight = fontSize * 1.4;
      const padding = 16;

      const x = width / 2;
      const y = height * 0.8;

      // Background box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(
        x - textMetrics.width / 2 - padding,
        y - textHeight / 2 - padding / 2,
        textMetrics.width + padding * 2,
        textHeight + padding
      );

      // Text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(visibleText, x, y);
    } else {
      // Cinematic style: elegant, bottom-center, with subtle shadow
      const fontSize = Math.round(width * 0.03);
      ctx.font = `${fontSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      const x = width / 2;
      const y = height * 0.9;

      // Text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(visibleText, x, y);
    }

    ctx.restore();
  }

  /**
   * Waits for approximately one frame duration.
   * In a real browser, this uses requestAnimationFrame timing.
   */
  private waitFrame(durationMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  /**
   * Selects the best supported MIME type for MediaRecorder.
   * Prefers H.264/MP4, falls back to VP9/WebM, then VP8/WebM.
   */
  private selectMimeType(): string {
    const candidates = [
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    for (const mimeType of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Default fallback
    return 'video/webm';
  }

  /**
   * Concatenates all segment blobs into a single downloadable blob.
   */
  private concatenateSegments(segments: SegmentResult[]): Blob {
    const mimeType = this.selectMimeType();
    const allBlobParts = segments.map((s) => s.blob);
    return new Blob(allBlobParts, { type: mimeType });
  }

  /**
   * Creates a partial blob from all completed segments for partial download.
   */
  private createPartialBlob(): Blob | undefined {
    if (this.completedSegmentBlobs.length === 0) return undefined;

    const mimeType = this.selectMimeType();
    return new Blob(this.completedSegmentBlobs, { type: mimeType });
  }

  /**
   * Calculates total duration from scene audio durations.
   */
  private calculateDuration(scenes: ExtendedScene[]) {
    const sceneDurations = scenes.map((s) => s.audioDurationMs || 3000);
    return calculateTotalDuration(sceneDurations);
  }

  /**
   * Creates the initial idle state.
   */
  private createInitialState(): ExportState {
    return {
      phase: 'idle',
      currentSegment: 0,
      totalSegments: 0,
      progressPercent: 0,
      estimatedTimeRemaining: 0,
      estimatedDuration: '00:00',
    };
  }

  /**
   * Updates the export state and notifies all progress callbacks.
   */
  private updateState(partial: Partial<ExportState>): void {
    this.state = { ...this.state, ...partial };
    for (const callback of this.progressCallbacks) {
      callback(this.getState());
    }
  }
}
