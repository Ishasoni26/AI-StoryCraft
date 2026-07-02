/**
 * Shared types and interfaces for long-form video export feature.
 * These extend the existing short-form video pipeline to support
 * 10-15 minute YouTube content with 40-60+ scenes.
 */

// ============================================================
// Character Entry (re-exported from existing usage for consistency)
// ============================================================

export interface CharacterEntry {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

// ============================================================
// 1. Long Script Generator (API: /api/brainstorm extension)
// ============================================================

/** Request body for the extended brainstorm endpoint in long-form mode. */
export interface LongBrainstormRequest {
  idea: string;
  characterProfile?: string;
  locationProfile?: string;
  isLongForm: boolean;
  targetDurationMinutes?: number; // 1-20, default 12
}

/** Response from the extended brainstorm endpoint in long-form mode. */
export interface LongBrainstormResponse {
  script: string;
  wordCount: number;
  isIncomplete?: boolean; // true if API failed mid-generation
  estimatedDurationMinutes?: number;
}

// ============================================================
// 2. Enhanced Scene Divider (API: /api/generate extension)
// ============================================================

/** Request body for the extended generate endpoint in long-form mode. */
export interface LongGenerateRequest {
  script: string;
  targetLanguage: string;
  characterProfile?: string;
  locationProfile?: string;
  characters?: CharacterEntry[];
  isLongForm: boolean;
}

/** Response from the extended generate endpoint in long-form mode. */
export interface LongGenerateResponse {
  scenes: ExtendedScene[];
  totalSceneCount: number;
}

/** Extended scene model with additional fields for long-form video. */
export interface ExtendedScene {
  // Existing fields
  imagePrompt: string;
  dialogue: string;
  imageUrl?: string;
  audioUrl?: string;
  isThumbnail?: boolean;

  // New fields for long-form
  sceneType?: 'establishing' | 'close-up' | 'action' | 'emotional' | 'transition';
  isOutro?: boolean;
  audioDurationMs?: number;
  hasIncompleteAudio?: boolean;
  hasFallbackImage?: boolean;
  chunkIndex?: number; // which script chunk this scene came from
}

// ============================================================
// 3. TTS Chunker (API: /api/tts extension)
// ============================================================

/** Request body for the extended TTS endpoint with chunked processing. */
export interface ChunkedTTSRequest {
  text: string;
  chunked?: boolean; // Enable chunking for long text
}

/** Response from the extended TTS endpoint with chunked processing. */
export interface ChunkedTTSResponse {
  audioUrl: string; // base64 concatenated audio
  hasIncompleteAudio?: boolean; // true if some chunks failed
  chunkCount?: number;
}

// ============================================================
// 4. Scene Batch Processor (Client-side)
// ============================================================

/** State of the batch processor during asset generation. */
export interface BatchProcessorState {
  status: 'idle' | 'processing' | 'paused' | 'complete' | 'error';
  currentScene: number;
  totalScenes: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // seconds
  successCount: number;
  failedCount: number;
  isPaused: boolean;
  startTime: number;
  generatedAssets: Map<number, { imageUrl?: string; audioUrl?: string }>;
}

/** Configuration for the batch processor's retry and delay behavior. */
export interface BatchProcessorConfig {
  imageDelay: number; // minimum 4000ms between image requests
  maxImageRetries: number; // 3
  retryDelay: number; // 10000ms for 429/5xx
  ttsRetries: number; // 2
  ttsRetryDelay: number; // 2000ms
}

// ============================================================
// 5. Segment Assembler & Export Engine (Client-side)
// ============================================================

/** Configuration for the video export engine. */
export interface ExportConfig {
  segmentSize: number; // 15 scenes per segment
  videoBitrate: number; // 5_000_000 bps
  audioBitrate: number; // 128_000 bps
  fps: number; // 30
  resolution: { width: number; height: number }; // 1920x1080 or 1080x1920
  maxFileSizeBytes: number; // 2GB
  kenBurnsZoomRange: [number, number]; // [0.05, 0.10]
  kenBurnsPanRange: [number, number]; // [0.05, 0.10]
}

/** Result of rendering a single video segment. */
export interface SegmentResult {
  blob: Blob;
  sceneRange: [number, number];
  durationMs: number;
}

/** State of the export process. */
export interface ExportState {
  phase: 'idle' | 'calculating' | 'rendering' | 'concatenating' | 'complete' | 'error';
  currentSegment: number;
  totalSegments: number;
  progressPercent: number;
  estimatedTimeRemaining: number;
  estimatedDuration: string; // "MM:SS"
  error?: string;
  partialBlob?: Blob; // available on error for partial download
}

// ============================================================
// 6. Video Duration Calculator (Client-side)
// ============================================================

/** Estimated video duration breakdown. */
export interface DurationEstimate {
  totalDurationMs: number;
  formattedDuration: string; // "MM:SS"
  thumbnailDurationMs: number; // 3000
  outroDurationMs: number; // 5000
  sceneDurations: number[]; // per-scene audio durations
}

// ============================================================
// 7. Progress Tracker (Client-side component)
// ============================================================

/** A single phase in the progress tracking pipeline. */
export interface ProgressPhase {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  detail?: string; // e.g., "Scene 23/45"
}

// ============================================================
// 8. UI Controls (Studio page extension)
// ============================================================

/** State for the video mode toggle and duration controls. */
export interface VideoModeState {
  mode: 'short' | 'long';
  targetDurationMinutes: number; // 8-18, default 12
  estimatedDuration: string; // "MM:SS" recalculated on scene changes
  generationTimeEstimate: string; // "MM:SS"
}

// ============================================================
// Data Models: Asset Cache (localStorage)
// ============================================================

/** Asset cache model persisted to localStorage for recovery. */
export interface AssetCache {
  sessionId: string; // unique per generation run
  timestamp: number;
  scenes: Array<{
    index: number;
    imagePrompt?: string;
    dialogue?: string;
    imageUrl?: string; // blob URL or base64
    audioUrl?: string; // base64
    status: 'pending' | 'complete' | 'failed';
  }>;
}

// ============================================================
// Data Models: Export Session
// ============================================================

/** Full export session state combining scenes, config, and progress. */
export interface ExportSession {
  scenes: ExtendedScene[];
  config: ExportConfig;
  segments: SegmentResult[];
  startTime: number;
  status: ExportState;
}
