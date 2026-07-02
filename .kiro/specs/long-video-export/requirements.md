# Requirements Document

## Introduction

This feature enables AI-StoryCraft to generate long-form videos (10-15 minutes) suitable for YouTube monetization. Currently, the system produces short story videos (under 1 minute) because the script generation and scene division are limited to small outputs with few scenes. This feature addresses that gap by introducing extended script generation capable of producing 1500-2500 word stories, a segmented video assembly pipeline that handles 40-60+ scenes without browser memory issues, and a robust export mechanism that produces YouTube-ready MP4 files at 10-15 minute durations. The existing TTS, image generation, and canvas-based video export are preserved and extended to handle the increased scale.

## Glossary

- **Long_Script_Generator**: The backend module responsible for generating extended story scripts (1500-2500 words) that produce 10-15 minutes of narrated audio content
- **Segment_Assembler**: The client-side module that divides the full scene list into manageable segments, renders each segment to a video blob, and concatenates them into a final output
- **Scene_Batch_Processor**: The module responsible for generating images and audio for large numbers of scenes (40-60+) with rate limiting, retry logic, and progress tracking
- **Export_Engine**: The enhanced client-side video export module that uses MediaRecorder with canvas rendering to produce the final long-form video file
- **Video_Duration_Calculator**: The module that estimates total video duration based on audio lengths of all scenes before export begins
- **Progress_Tracker**: The UI component that displays real-time status of long-form video generation including scene processing, asset generation, and export progress
- **TTS_Chunker**: The module that splits long dialogue text into chunks within the 200-character Google TTS limit and concatenates the resulting audio segments into a single continuous narration per scene
- **Script_Part_Manager**: The module that handles splitting a long story into logical narrative parts (Part 1, Part 2, etc.) when a single generation exceeds the target duration

## Requirements

### Requirement 1: Extended Script Generation for Long-Form Content

**User Story:** As a content creator, I want to generate story scripts that are 1500-2500 words long, so that the resulting narrated video reaches 10-15 minutes in duration for YouTube monetization eligibility.

#### Acceptance Criteria

1. WHEN the user selects "Long Video" mode and submits a brainstorm request, THE Long_Script_Generator SHALL generate a story script containing between 1500 and 2500 words in the target language and return the script as a plain text string within 120 seconds
2. WHEN generating a long script, THE Long_Script_Generator SHALL structure the generated script with a clear narrative arc including introduction (10-15% of total word count), rising action (25-30%), climax (15-20%), falling action (20-25%), and resolution (15-20%)
3. WHEN generating a long script, THE Long_Script_Generator SHALL set the maximum output token limit to at least 4096 tokens to accommodate the longer output length
4. IF the generated script contains fewer than 1500 words, THEN THE Long_Script_Generator SHALL make up to 3 follow-up API calls requesting continuation of the story until the minimum word count of 1500 is reached or the maximum retry limit is exhausted
5. THE Long_Script_Generator SHALL accept an optional `targetDurationMinutes` parameter with a valid range of 1 to 20 (default: 12) and adjust word count generation proportionally based on an average narration rate of 130 words per minute for Hindi content
6. IF the OpenAI API fails during extended generation, THEN THE Long_Script_Generator SHALL return whatever partial script was generated (even if below 1500 words) along with an error flag indicating incomplete generation and the word count achieved so far
7. IF the `targetDurationMinutes` parameter is outside the range of 1 to 20, THEN THE Long_Script_Generator SHALL reject the request and return a validation error indicating the acceptable range

### Requirement 2: Enhanced Scene Division for Large Scene Counts

**User Story:** As a content creator, I want my long scripts to be divided into 40-60 scenes with proper narrative pacing, so that the video has sufficient visual variety across its 10-15 minute duration.

#### Acceptance Criteria

1. WHEN a long-form script (over 1000 words) is submitted for scene generation, THE Scene_Divider SHALL produce between 40 and 60 scenes to ensure visual changes every 10-20 seconds of video
2. WHEN processing a long-form script (over 1000 words), THE Scene_Divider SHALL divide the script into chunks of 500 words maximum per API call, maintaining narrative context between chunks by including the previous chunk's last 2 scenes as reference in the prompt for the next chunk
3. WHEN dividing a long script into scenes, THE Scene_Divider SHALL ensure each scene contains 2-4 sentences of dialogue text, where a sentence is defined as text terminated by a purna viram (।), period (.), or question/exclamation mark
4. THE Scene_Divider SHALL assign a scene type (establishing shot, character close-up, action sequence, emotional moment, or transition) to each scene and SHALL NOT assign the same scene type to more than 3 consecutive scenes
5. IF the total number of generated scenes produces an estimated duration below 10 minutes (calculated at a rate of 150 words of dialogue per minute of audio), THEN THE Scene_Divider SHALL split scenes containing more than 4 sentences into multiple scenes until the total scene count reaches at least 40
6. WHEN generating scenes for a long-form script (over 1000 words), THE Scene_Divider SHALL place a thumbnail scene at position 0, an intro scene at position 1, and an outro scene containing a call-to-action prompt at the final position

### Requirement 3: Full-Length TTS Audio with Chunked Processing

**User Story:** As a content creator, I want each scene's dialogue to be fully narrated without truncation, so that the video audio is continuous and natural across the entire 10-15 minute duration.

#### Acceptance Criteria

1. WHEN a scene dialogue exceeds 200 characters, THE TTS_Chunker SHALL split the text into segments of 199 characters or fewer at the last occurring natural sentence boundary (।, ., or comma position) within the 199-character limit
2. IF no sentence boundary (।, ., or comma) exists within the 199-character limit, THEN THE TTS_Chunker SHALL split at the last whitespace position within the limit to avoid breaking mid-word
3. WHEN the TTS_Chunker has split a scene dialogue into chunks, THE TTS_Chunker SHALL generate TTS audio for each chunk in sequential order (first chunk to last) and concatenate the resulting audio data into a single continuous base64-encoded audio string per scene
4. WHEN concatenating audio chunks, THE TTS_Chunker SHALL insert a 100-millisecond silence gap between consecutive chunks and maintain consistent MP3 audio format across all chunks to prevent playback artifacts and words running together
5. IF a TTS chunk request fails, THEN THE TTS_Chunker SHALL retry the failed chunk up to 2 times with a 2-second delay between retries before marking that chunk as failed
6. IF one or more chunks in a scene fail after all retries are exhausted, THEN THE TTS_Chunker SHALL return the successfully generated audio portions concatenated in order and include a boolean warning flag (set to true) in that scene's response object indicating incomplete audio generation

### Requirement 4: Batched Asset Generation with Rate Limiting

**User Story:** As a content creator, I want the system to generate all 40-60 scene images reliably without hitting API rate limits, so that my long-form video has complete visual assets.

#### Acceptance Criteria

1. WHEN generating assets for a video with more than 20 scenes, THE Scene_Batch_Processor SHALL process image generation requests sequentially with a minimum 4-second delay between consecutive requests to the Pollinations API
2. WHILE asset generation is in progress, THE Scene_Batch_Processor SHALL update the Progress_Tracker at least once per scene completion, displaying the current scene number out of total scenes, percentage complete (rounded to the nearest integer), and estimated time remaining calculated from the average processing time of all completed scenes
3. IF an image generation request returns HTTP 429 (rate limited) or HTTP 5xx (server error), THEN THE Scene_Batch_Processor SHALL wait 10 seconds before each retry, attempt the request up to 3 additional times, and if all retries fail, mark that scene with a visually distinct placeholder indicator and continue processing the remaining scenes
4. THE Scene_Batch_Processor SHALL process TTS audio generation in parallel with image generation for the same scene to reduce total processing time
5. WHEN all assets have been generated or marked as failed, THE Scene_Batch_Processor SHALL display a summary to the user via the Progress_Tracker showing total generation time in minutes and seconds, count of successfully generated assets, and count of failed assets
6. WHILE asset generation is in progress, THE Scene_Batch_Processor SHALL allow the user to pause generation via a visible pause control, retaining all previously generated image and audio assets in memory, and resume from the next unprocessed scene when the user activates the resume control
7. IF the browser tab loses focus during asset generation, THEN THE Scene_Batch_Processor SHALL continue processing the queue without interruption or increased delay between requests
8. IF the user navigates away from the generation page or closes the browser tab while generation is in progress, THEN THE Scene_Batch_Processor SHALL persist all already-generated assets so they are recoverable when the user returns to the page

### Requirement 5: Segmented Video Export for Long Durations

**User Story:** As a content creator, I want to export 10-15 minute videos reliably without browser crashes or memory issues, so that I can upload them directly to YouTube.

#### Acceptance Criteria

1. WHEN exporting a video with more than 30 scenes, THE Segment_Assembler SHALL divide the scene list into segments of 15 scenes each (with the final segment containing the remaining scenes) and render each segment as a separate video blob before concatenation
2. WHEN exporting a video with 30 or fewer scenes, THE Segment_Assembler SHALL render all scenes as a single segment without subdivision
3. THE Export_Engine SHALL use MediaRecorder with a video bitrate of 5 Mbps and audio bitrate of 128 kbps to produce video output in WebM or MP4 container format
4. WHEN rendering each segment, THE Export_Engine SHALL release memory from the previous segment's image data and audio buffers before processing the next segment
5. WHILE export is in progress, THE Export_Engine SHALL display export progress as a percentage (0-100%) with estimated time remaining in seconds, updating after each scene is rendered
6. WHEN all segments are rendered, THE Segment_Assembler SHALL concatenate the segment blobs into a single downloadable file in WebM or MP4 format (preferring MP4 when the browser supports MediaRecorder MP4 encoding)
7. IF the export process fails due to a MediaRecorder error, memory allocation failure, or audio decode error, THEN THE Export_Engine SHALL stop processing, display an error message indicating the failure reason, and offer the user the option to download the partially exported video containing all segments rendered before the failure
8. IF all scenes contain audio assets that are successfully decoded and have a duration greater than 0 seconds, THEN THE Export_Engine SHALL produce a final video file with total duration between 10 and 15 minutes
9. WHEN export begins, THE Video_Duration_Calculator SHALL compute and display the estimated final video duration by summing all scene audio durations plus the thumbnail scene duration (3 seconds) and outro scene duration (5 seconds)

### Requirement 6: Long-Form Video Mode UI Controls

**User Story:** As a content creator, I want clear UI controls to switch between short-form and long-form video modes, so that I can choose the appropriate output format for my content.

#### Acceptance Criteria

1. THE Studio page SHALL display a video mode toggle allowing the user to select between "Short Video" (current behavior, under 2 minutes) and "Long Video" (10-15 minutes target), with "Short Video" selected as the default on initial page load
2. WHEN "Long Video" mode is selected, THE Studio page SHALL display a target duration slider allowing the user to set desired duration between 8 and 18 minutes in 1-minute increments, with a default value of 12 minutes
3. WHILE "Long Video" mode is active and at least one scene exists in the storyboard, THE Studio page SHALL display an estimated duration indicator in "MM:SS" format that recalculates within 2 seconds of any scene being added, removed, or modified, calculated from the sum of all scene audio durations
4. WHEN the storyboard contains at least one scene, THE Studio page SHALL display a generation time estimate in "MM:SS" format, calculated as (number of scenes × 7 seconds) for image generation plus (total script word count × 0.5 seconds) for TTS processing
5. WHILE long-form asset generation is in progress, THE Progress_Tracker SHALL display a progress panel showing each phase with a status indicator (pending, in-progress, or complete): script generation, scene division, individual scene image/audio generation with current scene number out of total scene count, and export readiness
6. IF the user switches from "Long Video" to "Short Video" mode after at least one scene has been generated, THEN THE Studio page SHALL display a confirmation dialog stating that existing scene data will be cleared, with "Cancel" and "Confirm" actions, and SHALL only clear scene data and switch modes when the user selects "Confirm"

### Requirement 7: Video Export Format and Quality for YouTube

**User Story:** As a content creator, I want the exported video to meet YouTube's recommended upload specifications, so that my video looks professional and qualifies for monetization without re-encoding.

#### Acceptance Criteria

1. THE Export_Engine SHALL produce video encoded with H.264 codec in an MP4 container at a resolution of 1920x1080 pixels (16:9 mode) or 1080x1920 pixels (9:16 mode) for YouTube upload
2. THE Export_Engine SHALL render video at 30 frames per second with a frame interval tolerance of no more than 1 millisecond deviation per frame throughout the entire duration
3. THE Export_Engine SHALL apply Ken Burns effect to each scene image by zooming between 5% and 10% of the original scale and panning across 5% to 10% of the frame width over the scene duration to create visual motion
4. THE Export_Engine SHALL render subtitle text on each frame within 50 milliseconds of the corresponding audio narration word timing, using the user-selected subtitle style (viral, cinematic, or none)
5. WHEN background music is enabled, THE Export_Engine SHALL mix the BGM audio track encoded in AAC format, looped to match video duration with a crossfade of 2 seconds at each loop point, with the narration audio at the user-specified volume levels
6. THE Export_Engine SHALL ensure the final video file size does not exceed 2 GB for YouTube standard upload compatibility
7. IF the estimated file size exceeds 2 GB, THEN THE Export_Engine SHALL reduce video bitrate proportionally to keep the file under the limit and display a notification to the user indicating the adjusted bitrate value before export completes
