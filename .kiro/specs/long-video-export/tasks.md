# Implementation Plan: Long Video Export

## Overview

This plan extends AI-StoryCraft's existing short-form video pipeline to support long-form YouTube content (10-15 minutes). The implementation proceeds in layers: first utility/calculation functions, then backend API extensions, then client-side batch processing and export, and finally UI integration with progress tracking. Property-based tests validate correctness properties defined in the design.

## Tasks

- [x] 1. Create utility modules and core interfaces
  - [x] 1.1 Create shared types and interfaces for long-form video
    - Create `src/lib/long-video/types.ts` with all TypeScript interfaces from the design: `LongBrainstormRequest`, `LongBrainstormResponse`, `LongGenerateRequest`, `LongGenerateResponse`, `ExtendedScene`, `ChunkedTTSRequest`, `ChunkedTTSResponse`, `BatchProcessorState`, `BatchProcessorConfig`, `ExportConfig`, `SegmentResult`, `ExportState`, `DurationEstimate`, `ProgressPhase`, `VideoModeState`, `AssetCache`, `ExportSession`
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

  - [x] 1.2 Implement Video Duration Calculator utility
    - Create `src/lib/long-video/duration-calculator.ts`
    - Implement `calculateTotalDuration(sceneDurations: number[]): DurationEstimate` that sums all audio durations plus 3000ms thumbnail plus 5000ms outro
    - Implement `formatDuration(ms: number): string` returning "MM:SS" format
    - _Requirements: 5.9, 6.3_

  - [x] 1.3 Implement Generation Time Estimator utility
    - Create `src/lib/long-video/generation-estimator.ts`
    - Implement `estimateGenerationTime(sceneCount: number, wordCount: number): number` returning `(sceneCount × 7) + (wordCount × 0.5)` seconds
    - _Requirements: 6.4_

  - [x] 1.4 Implement Ken Burns effect calculator
    - Create `src/lib/long-video/ken-burns.ts`
    - Implement `calculateKenBurns(progress: number, sceneConfig: { width: number; height: number }): { zoom: number; panX: number; panY: number }` producing zoom in [1.05, 1.10] and pan offsets between 5-10% of frame dimensions
    - _Requirements: 7.3_

  - [x] 1.5 Implement adaptive bitrate calculator
    - Create `src/lib/long-video/bitrate-calculator.ts`
    - Implement `adjustBitrateForFileSize(durationSeconds: number, initialBitrate: number, maxFileSize: number): { bitrate: number; adjusted: boolean }` that reduces bitrate if estimated file exceeds 2GB
    - _Requirements: 7.6, 7.7_

  - [ ]* 1.6 Write property tests for duration calculator (Property 10)
    - **Property 10: Video duration calculation**
    - Test with random arrays of positive durations that total equals sum + 3000 + 5000
    - **Validates: Requirements 5.9**

  - [ ]* 1.7 Write property tests for generation time estimator (Property 11)
    - **Property 11: Generation time estimation**
    - Test with random positive scene counts and word counts that result equals `(sceneCount × 7) + (wordCount × 0.5)`
    - **Validates: Requirements 6.4**

  - [ ]* 1.8 Write property tests for Ken Burns calculator (Property 12)
    - **Property 12: Ken Burns effect parameters within range**
    - Test with random progress values in [0, 1] that zoom is in [1.05, 1.10] and pan is in [5%, 10%]
    - **Validates: Requirements 7.3**

  - [ ]* 1.9 Write property tests for adaptive bitrate calculator (Property 13)
    - **Property 13: File size constraint with adaptive bitrate**
    - Test with random durations that adjusted bitrate × duration ≤ 2GB, and no adjustment for durations under threshold
    - **Validates: Requirements 7.6, 7.7**

- [x] 2. Implement TTS Chunker backend
  - [x] 2.1 Implement TTS text chunking logic
    - Create `src/lib/long-video/tts-chunker.ts`
    - Implement `chunkTextForTTS(text: string): string[]` that splits text > 200 chars at last sentence boundary (।, ., or comma) within 199 chars; falls back to last whitespace if no boundary; ensures no mid-word breaks
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Extend `/api/tts/route.ts` with chunked processing
    - Accept optional `chunked: boolean` parameter in request body
    - When `chunked: true` and text > 200 chars: use `chunkTextForTTS` to split, generate TTS for each chunk sequentially, insert 100ms silence between chunks, concatenate into single base64 audio
    - Implement retry logic: up to 2 retries with 2s delay per failed chunk
    - Return `{ audioUrl, hasIncompleteAudio?, chunkCount? }` response
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.3 Write property tests for TTS chunking (Property 8)
    - **Property 8: TTS text chunking respects character limit and boundaries**
    - Test with random Unicode strings of 200-2000 chars that all chunks ≤ 199 chars, splits at boundaries when available, no mid-word breaks
    - **Validates: Requirements 3.1, 3.2**

- [x] 3. Implement Long Script Generator backend
  - [x] 3.1 Implement target duration validation and word count calculation
    - Create `src/lib/long-video/script-generator.ts`
    - Implement `validateTargetDuration(minutes: number): boolean` rejecting values outside [1, 20]
    - Implement `calculateTargetWordCount(minutes: number): number` returning `minutes × 130`
    - _Requirements: 1.5, 1.7_

  - [x] 3.2 Extend `/api/brainstorm/route.ts` for long-form script generation
    - Accept new parameters: `isLongForm: boolean`, `targetDurationMinutes?: number` (default 12)
    - Validate `targetDurationMinutes` in [1, 20]; return 400 if invalid
    - Set `max_tokens: 4096` for long-form
    - Calculate target word count from duration; use system prompt requesting 1500-2500 word story with narrative arc structure (intro 10-15%, rising 25-30%, climax 15-20%, falling 20-25%, resolution 15-20%)
    - If initial response < 1500 words, make up to 3 follow-up continuation calls
    - On API failure, return partial script with `isIncomplete: true` and `wordCount`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 3.3 Write property tests for target duration validation (Property 3)
    - **Property 3: Invalid target duration rejection**
    - Test with random numbers outside [1, 20] that validation returns false/error
    - **Validates: Requirements 1.7**

  - [ ]* 3.4 Write property tests for word count calculation (Property 2)
    - **Property 2: Target duration to word count calculation**
    - Test with random integers in [1, 20] that result equals `minutes × 130`
    - **Validates: Requirements 1.5**

- [x] 4. Implement Enhanced Scene Divider backend
  - [x] 4.1 Implement script chunking utility
    - Create `src/lib/long-video/script-chunker.ts`
    - Implement `chunkScript(script: string, maxWordsPerChunk: number): string[]` that splits scripts > 1000 words into chunks of max 500 words at sentence boundaries, preserving full text reconstruction
    - _Requirements: 2.2_

  - [x] 4.2 Implement scene type assignment and validation
    - Create `src/lib/long-video/scene-types.ts`
    - Implement `assignSceneTypes(scenes: Scene[]): Scene[]` distributing scene types with max 3 consecutive same type
    - Implement `validateTypeSequence(types: string[]): boolean` checking the constraint
    - Implement `countSentences(dialogue: string): number` counting sentences terminated by ।, ., ?, !
    - _Requirements: 2.3, 2.4_

  - [x] 4.3 Extend `/api/generate/route.ts` for long-form scene generation
    - Accept `isLongForm: boolean` parameter
    - When `isLongForm`: split script into 500-word chunks, process each chunk with context overlap (last 2 scenes from previous chunk)
    - Enforce 2-4 sentences per scene
    - Add thumbnail at position 0, intro at position 1, outro with CTA at final position
    - If estimated duration < 10 min (at 150 words/min), split scenes with > 4 sentences until count ≥ 40
    - Return scenes with scene type assignments
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 4.4 Write property tests for script chunking (Property 4)
    - **Property 4: Script chunking produces bounded-size chunks**
    - Test with random strings of 1000-5000 words that each chunk ≤ 500 words and concatenation reconstructs original
    - **Validates: Requirements 2.2**

  - [ ]* 4.5 Write property tests for scene sentence count (Property 5)
    - **Property 5: Scene dialogue sentence count invariant**
    - Test with random scene arrays that each dialogue contains 2-4 sentences
    - **Validates: Requirements 2.3**

  - [ ]* 4.6 Write property tests for scene type sequence (Property 6)
    - **Property 6: Scene type consecutive constraint**
    - Test with random scene type arrays that no more than 3 consecutive same type
    - **Validates: Requirements 2.4**

  - [ ]* 4.7 Write property tests for scene list structure (Property 7)
    - **Property 7: Long-form scene list structural invariant**
    - Test that position 0 is thumbnail, position 1 is intro, final position is outro
    - **Validates: Requirements 2.6**

- [x] 5. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Scene Batch Processor (client-side)
  - [x] 6.1 Create Scene Batch Processor module
    - Create `src/lib/long-video/batch-processor.ts`
    - Implement class/module with: sequential image processing with 4s delay, parallel TTS for same scene, retry logic (10s wait, 3 retries for 429/5xx), pause/resume support, progress tracking per scene
    - Emit progress updates with current scene, percentage, estimated time remaining
    - Mark failed scenes with placeholder indicator
    - Display summary on completion (total time, success count, failed count)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 6.2 Implement asset persistence and recovery
    - Create `src/lib/long-video/asset-cache.ts`
    - Implement `saveAssets(sessionId: string, assets: AssetCache): void` persisting to localStorage
    - Implement `loadAssets(sessionId: string): AssetCache | null` for recovery
    - Implement `clearAssets(sessionId: string): void` for cleanup
    - Handle localStorage quota exceeded by falling back to in-memory with warning
    - _Requirements: 4.8_

- [x] 7. Implement Segment Assembler & Export Engine (client-side)
  - [x] 7.1 Implement scene segmentation logic
    - Create `src/lib/long-video/segment-assembler.ts`
    - Implement `segmentScenes(scenes: Scene[]): Scene[][]` that divides into segments of 15 for > 30 scenes, or single segment for ≤ 30
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Implement Export Engine with MediaRecorder
    - Create `src/lib/long-video/export-engine.ts`
    - Implement canvas-based rendering with MediaRecorder at 5Mbps video / 128kbps audio, 30fps
    - Render Ken Burns effect per scene using `calculateKenBurns`
    - Render subtitles within 50ms of word timing
    - Process segments sequentially, releasing previous segment memory before next
    - Support H.264/MP4 with VP9/WebM fallback
    - Apply adaptive bitrate if estimated file > 2GB
    - On failure: stop, display error, offer partial download
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

  - [x] 7.3 Implement BGM audio mixing with loop crossfade
    - Extend export engine to mix BGM track in AAC format, looped with 2s crossfade at loop points, at user-specified volume levels
    - _Requirements: 7.5_

  - [ ]* 7.4 Write property tests for scene segmentation (Property 9)
    - **Property 9: Scene list segmentation**
    - Test with random arrays of 1-100 scenes that segmentation produces correct segment count and sizes
    - **Validates: Requirements 5.1, 5.2**

- [ ] 8. Implement Long-Form Mode UI Controls
  - [x] 8.1 Add video mode toggle to Studio page
    - Add "Short Video" / "Long Video" toggle with "Short Video" as default
    - When "Long Video" selected: show target duration slider (8-18 min, 1-min increments, default 12)
    - Display confirmation dialog when switching from Long to Short if scenes exist
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 8.2 Implement estimated duration indicator
    - Display "MM:SS" estimated duration recalculating within 2 seconds of scene changes
    - Display generation time estimate as "MM:SS" using `estimateGenerationTime`
    - _Requirements: 6.3, 6.4_

  - [x] 8.3 Implement Progress Tracker UI component
    - Create `src/components/ProgressTracker.tsx`
    - Display phases: script generation, scene division, scene image/audio generation (with current/total), export readiness
    - Each phase shows status: pending, in-progress, complete, or error
    - Show overall percentage and estimated time remaining
    - Include pause/resume button for asset generation phase
    - _Requirements: 4.2, 4.5, 4.6, 5.5, 6.5_

- [x] 9. Integration and wiring
  - [x] 9.1 Wire long-form mode into Studio page workflow
    - Connect mode toggle to brainstorm API (pass `isLongForm`, `targetDurationMinutes`)
    - Connect to generate API (pass `isLongForm`)
    - Connect to TTS API (pass `chunked: true` for long-form)
    - Replace inline sequential processing with `BatchProcessor` when in long-form mode
    - Wire export button to `SegmentAssembler` + `ExportEngine` pipeline
    - Wire `VideoDurationCalculator` to estimated duration display
    - _Requirements: 1.1, 2.1, 3.3, 4.1, 5.1, 6.1, 6.3_

  - [x] 9.2 Implement asset recovery on page reload
    - On Studio mount, check localStorage for cached assets
    - If found, offer user option to resume or start fresh
    - _Requirements: 4.8_

  - [ ]* 9.3 Write integration tests for full pipeline
    - Test brainstorm → generate → batch process → export flow with mocked APIs
    - Test pause/resume during batch processing
    - Test partial download on export failure
    - _Requirements: 1.1, 2.1, 3.3, 4.1, 5.1_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript with Next.js 16, React 19, Tailwind CSS 4, and framer-motion
- fast-check library should be installed for property-based tests (`npm install --save-dev fast-check`)
- All new modules go under `src/lib/long-video/` for clean separation from existing code
- Existing API routes are extended (not replaced) to maintain backward compatibility

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "2.1", "3.1", "4.1", "4.2"] },
    { "id": 2, "tasks": ["1.6", "1.7", "1.8", "1.9", "2.2", "2.3", "3.2", "3.3", "3.4", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 3, "tasks": ["4.7", "6.1", "6.2", "7.1"] },
    { "id": 4, "tasks": ["7.2", "7.4"] },
    { "id": 5, "tasks": ["7.3", "8.1", "8.2", "8.3"] },
    { "id": 6, "tasks": ["9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3"] }
  ]
}
```
