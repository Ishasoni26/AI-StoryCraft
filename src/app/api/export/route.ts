import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

/**
 * Runs FFmpeg command — ignores stderr output (FFmpeg always writes info to stderr).
 * Only throws if exit code is non-zero.
 */
async function runFfmpeg(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 100 * 1024 * 1024 });
    return stdout;
  } catch (err: any) {
    // exec throws if exit code != 0 — that's a real error
    const stderrMsg = (err.stderr || '').slice(0, 300);
    throw new Error(`FFmpeg failed: ${stderrMsg}`);
  }
}

// ============================================================
// Types
// ============================================================

interface ExportScene {
  imageUrl: string;       // base64 data URL or external URL
  audioUrl: string;       // base64 data URL
  dialogue: string;       // subtitle text for this scene
  duration?: number;      // duration in seconds (calculated from audio if not provided)
  isThumbnail?: boolean;
}

interface ExportRequest {
  scenes: ExportScene[];
  subtitleStyle?: 'viral' | 'cinematic' | 'none';
  bgmUrl?: string;        // BGM audio URL or base64
  bgmVolume?: number;     // 0-100, default 20
  voiceVolume?: number;   // 0-100, default 100
  storyTitle?: string;
  aspectRatio?: '16:9' | '9:16'; // default 16:9
}

// ============================================================
// Helper: Check if FFmpeg is installed
// ============================================================

async function checkFfmpeg(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Helper: Find a font that supports Hindi/Devanagari
// ============================================================

function findFontPath(): string {
  const candidates = [
    // macOS
    '/System/Library/Fonts/Kohinoor.ttc',
    '/System/Library/Fonts/KohinoorDevanagari.ttc',
    '/System/Library/Fonts/Supplemental/Devanagari MT.ttc',
    '/System/Library/Fonts/Devanagari Sangam MN.ttc',
    '/Library/Fonts/NotoSansDevanagari-Regular.ttf',
    // Linux
    '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    // Windows
    'C:\\Windows\\Fonts\\Nirmala.ttf',
    'C:\\Windows\\Fonts\\mangal.ttf',
  ];

  return candidates[0];
}

// ============================================================
// Helper: Escape text for FFmpeg drawtext filter
// ============================================================

function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/%/g, '%%')
    .replace(/\n/g, ' ');
}

// ============================================================
// Helper: Decode base64 data URL and save to file
// ============================================================

async function saveBase64ToFile(dataUrl: string, filePath: string): Promise<void> {
  const matches = dataUrl.match(/^data:[^;]+;base64,([\s\S]+)$/);
  if (!matches) {
    throw new Error(`Invalid base64 data URL format for file: ${filePath}`);
  }
  const buffer = Buffer.from(matches[1], 'base64');
  await fs.writeFile(filePath, buffer);
}

// ============================================================
// Helper: Download URL content to file
// ============================================================

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${url} (HTTP ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

// ============================================================
// Helper: Generate SRT subtitle file from scenes
// ============================================================

function generateSrtContent(scenes: ExportScene[], durations: number[]): string {
  const lines: string[] = [];
  let cumulativeTime = 0;
  let subtitleIndex = 1;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const duration = durations[i] || 3;

    // Skip thumbnail scenes or scenes with no dialogue
    if (scene.isThumbnail || !scene.dialogue || scene.dialogue.trim() === '') {
      cumulativeTime += duration;
      continue;
    }

    const startTime = cumulativeTime;
    const endTime = cumulativeTime + duration;

    lines.push(String(subtitleIndex));
    lines.push(`${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}`);
    lines.push(scene.dialogue.trim());
    lines.push('');

    subtitleIndex++;
    cumulativeTime += duration;
  }

  return lines.join('\n');
}

function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad3(ms)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

// ============================================================
// Helper: Get audio duration using ffprobe
// ============================================================

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    // Try ffprobe first
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}" 2>/dev/null`
    );
    const duration = parseFloat(stdout.trim());
    if (!isNaN(duration) && duration > 0) return duration;
  } catch {
    // ffprobe not available, try ffmpeg -i as fallback
    try {
      const { stderr } = await execAsync(
        `ffmpeg -i "${audioPath}" -f null - 2>&1 | grep "Duration" || true`
      );
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
      }
    } catch { /* ignore */ }
  }
  
  // Last resort: estimate from file size (MP3 at ~16kbps for Google TTS)
  try {
    const stat = await fs.stat(audioPath);
    const fileSizeBytes = stat.size;
    // Google TTS typically 32kbps = 4000 bytes/second
    const estimatedDuration = fileSizeBytes / 4000;
    return Math.max(2, Math.min(30, estimatedDuration)); // Clamp between 2-30 seconds
  } catch {
    return 3;
  }
}

// ============================================================
// Helper: Escape file path for FFmpeg filter strings
// ============================================================

function escapeFfmpegPath(filePath: string): string {
  // FFmpeg filter paths need special escaping for Windows backslashes and colons
  return filePath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\''");
}

// ============================================================
// Main Export Route
// ============================================================

export async function POST(req: Request) {
  const sessionId = randomUUID();
  const tempDir = path.join(os.tmpdir(), `ai-storycraft-export-${sessionId}`);

  try {
    // Check FFmpeg availability first
    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) {
      return NextResponse.json(
        {
          error: 'FFmpeg not installed',
          details: 'FFmpeg is required for video export. Install it via: brew install ffmpeg (macOS), apt install ffmpeg (Linux), or download from https://ffmpeg.org',
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body: ExportRequest = await req.json();
    const {
      scenes,
      subtitleStyle = 'cinematic',
      bgmUrl,
      bgmVolume = 20,
      voiceVolume = 100,
      storyTitle = 'Video',
      aspectRatio = '16:9',
    } = body;

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: 'No scenes provided' }, { status: 400 });
    }

    // Set resolution based on aspect ratio
    const resolution = aspectRatio === '9:16' ? '1080x1920' : '1280x720';

    console.log(`[Export] Starting export with ${scenes.length} scenes, session: ${sessionId}`);

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    const fontPath = findFontPath();
    const sceneVideoPaths: string[] = [];
    const sceneDurations: number[] = [];

    // ====================================================
    // Step 1: Process each scene - save assets, create video segments
    // ====================================================

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageFile = path.join(tempDir, `image_${i}.png`);
      const audioFile = path.join(tempDir, `audio_${i}.mp3`);
      const sceneVideo = path.join(tempDir, `scene_${i}.mp4`);

      // --- Save image ---
      if (scene.imageUrl && scene.imageUrl.startsWith('data:')) {
        await saveBase64ToFile(scene.imageUrl, imageFile);
      } else if (scene.imageUrl && scene.imageUrl.startsWith('http')) {
        await downloadToFile(scene.imageUrl, imageFile);
      } else {
        // Create a black frame placeholder
        await runFfmpeg(
          `ffmpeg -f lavfi -i "color=c=black:s=${resolution}:d=1" -frames:v 1 -y "${imageFile}"`
        );
      }

      // --- Save audio ---
      let hasAudio = false;
      if (scene.audioUrl && scene.audioUrl.startsWith('data:')) {
        await saveBase64ToFile(scene.audioUrl, audioFile);
        hasAudio = true;
      } else if (scene.audioUrl && scene.audioUrl.startsWith('http')) {
        await downloadToFile(scene.audioUrl, audioFile);
        hasAudio = true;
      }

      // --- Determine duration ---
      let duration: number;
      if (scene.duration && scene.duration > 0) {
        duration = scene.duration;
      } else if (hasAudio) {
        duration = await getAudioDuration(audioFile);
      } else {
        // Estimate from dialogue word count, minimum 3 seconds
        const wordCount = scene.dialogue ? scene.dialogue.split(/\s+/).filter(w => w.length > 0).length : 0;
        duration = Math.max(3, wordCount * 0.35 + 0.5);
      }
      sceneDurations.push(duration);

      // If no audio file exists, generate silence for the duration
      if (!hasAudio) {
        await runFfmpeg(
          `ffmpeg -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${duration} -c:a aac -b:a 128k -y "${audioFile}"`
        );
      }

      // --- Build FFmpeg filter for this scene ---
      const filters: string[] = [];

      // Simple scale to target resolution (no zoompan — much faster encoding)
      filters.push(`scale=${resolution.replace('x', ':')}:force_original_aspect_ratio=decrease,pad=${resolution.replace('x', ':')}:(ow-iw)/2:(oh-ih)/2`);

      const videoFilter = filters.join(',');

      // --- Create scene video segment (optimized for speed) ---
      const ffmpegCmd = [
        'ffmpeg',
        '-loop 1',
        `-i "${imageFile}"`,
        `-i "${audioFile}"`,
        '-c:v libx264',
        '-preset ultrafast',
        '-tune stillimage',
        '-c:a aac',
        '-b:a 128k',
        '-crf 23',
        '-r 24',
        `-vf "${videoFilter}"`,
        '-shortest',
        '-pix_fmt yuv420p',
        `-y "${sceneVideo}"`,
      ].join(' ');

      try {
        await runFfmpeg(ffmpegCmd);
      } catch (err: any) {
        console.error(`[Export] FFmpeg error on scene ${i}:`, err.stderr || err.message);
        // Try simpler command without complex filters
        const simpleFfmpegCmd = [
          'ffmpeg',
          '-loop 1',
          `-i "${imageFile}"`,
          `-i "${audioFile}"`,
          '-c:v libx264',
          '-preset ultrafast',
          '-tune stillimage',
          '-c:a aac',
          '-b:a 128k',
          '-crf 23',
          '-r 24',
          `-vf "scale=${resolution.replace('x', ':')}:force_original_aspect_ratio=decrease,pad=${resolution.replace('x', ':')}:(ow-iw)/2:(oh-ih)/2"`,
          '-shortest',
          '-pix_fmt yuv420p',
          `-y "${sceneVideo}"`,
        ].join(' ');

        await runFfmpeg(simpleFfmpegCmd);
      }

      sceneVideoPaths.push(sceneVideo);
      console.log(`[Export] Scene ${i + 1}/${scenes.length} rendered (${duration.toFixed(1)}s)`);
    }

    // ====================================================
    // Step 2: Generate SRT subtitle file
    // ====================================================

    const srtFile = path.join(tempDir, 'subtitles.srt');
    const srtContent = generateSrtContent(scenes, sceneDurations);
    await fs.writeFile(srtFile, srtContent, 'utf-8');

    // ====================================================
    // Step 3: Concatenate all scene videos
    // ====================================================

    const concatListFile = path.join(tempDir, 'filelist.txt');
    const concatContent = sceneVideoPaths.map(f => `file '${f}'`).join('\n');
    await fs.writeFile(concatListFile, concatContent);

    const concatenatedFile = path.join(tempDir, 'concatenated.mp4');
    await runFfmpeg(
      `ffmpeg -f concat -safe 0 -i "${concatListFile}" -c copy -y "${concatenatedFile}"`,
      { maxBuffer: 100 * 1024 * 1024 }
    );

    console.log('[Export] All scenes concatenated');

    // ====================================================
    // Step 4: Mix in BGM if provided
    // ====================================================

    let finalFile = concatenatedFile;

    if (bgmUrl) {
      const bgmFile = path.join(tempDir, 'bgm.mp3');
      const finalWithBgm = path.join(tempDir, 'final_bgm.mp4');

      // Save BGM file
      if (bgmUrl.startsWith('data:')) {
        await saveBase64ToFile(bgmUrl, bgmFile);
      } else if (bgmUrl.startsWith('http')) {
        await downloadToFile(bgmUrl, bgmFile);
      }

      // Calculate volume levels (normalize 0-100 to 0.0-1.0)
      const bgmVol = Math.max(0, Math.min(1, bgmVolume / 100));
      const voiceVol = Math.max(0, Math.min(1, voiceVolume / 100));

      // Mix BGM with narration - BGM loops and plays at lower volume
      const mixCmd = [
        'ffmpeg',
        `-i "${concatenatedFile}"`,
        `-i "${bgmFile}"`,
        '-filter_complex',
        `"[0:a]volume=${voiceVol}[voice];[1:a]aloop=loop=-1:size=2e+09,volume=${bgmVol}[bgm];[voice][bgm]amix=inputs=2:duration=first[aout]"`,
        '-map 0:v',
        '-map "[aout]"',
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        `-y "${finalWithBgm}"`,
      ].join(' ');

      try {
        await runFfmpeg(mixCmd);
        finalFile = finalWithBgm;
        console.log('[Export] BGM mixed successfully');
      } catch (err: any) {
        console.warn('[Export] BGM mixing failed, using video without BGM:', err.message);
        // Continue with concatenated file (no BGM)
      }
    }

    // ====================================================
    // Step 5: Read output video and return as download response
    // ====================================================

    const videoBuffer = await fs.readFile(finalFile);

    // Sanitize filename — HTTP headers only support ASCII
    const safeTitle = (storyTitle || 'Video')
      .replace(/[^a-zA-Z0-9_\- ]/g, '') // Only ASCII alphanumeric + basic chars
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 40) || 'Video';
    const filename = `AI_StoryCraft_${safeTitle}.mp4`;

    console.log(`[Export] Complete! File size: ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    return new Response(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[Export] Export failed:', error);

    const isExecError = error.stderr || error.stdout;
    const details = isExecError
      ? `FFmpeg error: ${(error.stderr || error.stdout || '').slice(0, 500)}`
      : error.message || String(error);

    return NextResponse.json(
      {
        error: 'Video export failed',
        details,
      },
      { status: 500 }
    );
  } finally {
    // ====================================================
    // Cleanup: Remove ALL temp files
    // ====================================================
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`[Export] Cleaned up temp directory: ${tempDir}`);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Next.js route segment config.
 * Allow up to 5 minutes for FFmpeg processing of long videos.
 */
export const maxDuration = 300;
