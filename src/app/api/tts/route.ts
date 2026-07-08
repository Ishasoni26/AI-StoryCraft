import { NextResponse } from 'next/server';
import { chunkTextForTTS } from '@/lib/long-video/tts-chunker';

/** Threshold above which chunked processing is triggered. */
const CHUNK_THRESHOLD = 200;

/** Maximum retry attempts for a failed chunk. */
const MAX_RETRIES = 2;

/** Delay in ms between retries. */
const RETRY_DELAY_MS = 2000;

/** Duration of silence to insert between chunks in ms. */
const SILENCE_GAP_MS = 100;

/**
 * Generates a short MP3-encoded silence buffer (~100ms).
 * This is a minimal valid MP3 frame representing silence.
 * The frame is a valid MPEG Audio Layer 3, 128kbps, 44100Hz, stereo silent frame.
 */
function generateSilenceBuffer(): Buffer {
  // A minimal valid MP3 frame of silence (~26ms per frame at 128kbps/44100Hz).
  // We repeat it ~4 times to approximate 100ms of silence.
  // MP3 frame header: 0xFF 0xFB (sync word + MPEG1, Layer3, 128kbps, 44100Hz, stereo)
  // Frame size for 128kbps/44100Hz = 417 bytes
  const frameSize = 417;
  const framesNeeded = 4; // ~104ms of silence
  const silenceFrame = Buffer.alloc(frameSize);
  // Set MP3 frame header bytes
  silenceFrame[0] = 0xFF;
  silenceFrame[1] = 0xFB; // MPEG1, Layer 3, no CRC
  silenceFrame[2] = 0x90; // 128kbps, 44100Hz
  silenceFrame[3] = 0x00; // padding, stereo
  // Rest is zeros = silence

  const frames: Buffer[] = [];
  for (let i = 0; i < framesNeeded; i++) {
    frames.push(Buffer.from(silenceFrame));
  }
  return Buffer.concat(frames);
}

/**
 * Fetches TTS audio for a single text chunk from Google Translate TTS API.
 * Returns the audio as a Buffer, or null on failure.
 */
async function fetchTTSForChunk(text: string): Promise<Buffer | null> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=hi&client=tw-ob&ttsspeed=1.5`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Google TTS API Error: ${response.status}`);
  }

  const audioBlob = await response.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Fetches TTS audio for a chunk with retry logic.
 * Retries up to MAX_RETRIES times with RETRY_DELAY_MS between attempts.
 */
async function fetchTTSWithRetry(text: string): Promise<Buffer | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fetchTTSForChunk(text);
      return result;
    } catch (error: any) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  console.error(
    `TTS chunk failed after ${MAX_RETRIES + 1} attempts:`,
    lastError?.message
  );
  return null;
}

/**
 * Delays execution for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  try {
    const { text, chunked } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Chunked processing path: when explicitly requested and text exceeds threshold
    if (chunked && text.length > CHUNK_THRESHOLD) {
      return handleChunkedTTS(text);
    }

    // Default path: existing behavior for short text or non-chunked requests
    return handleStandardTTS(text);
  } catch (error: any) {
    console.error('Error fetching TTS:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handles standard (non-chunked) TTS - preserves original behavior exactly.
 */
async function handleStandardTTS(text: string) {
  // Google TTS has a strict 200 character limit, otherwise it throws 400 Bad Request
  const safeText =
    text.length > 199 ? text.substring(0, 196) + '...' : text;
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=hi&client=tw-ob&ttsspeed=1.5`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Google TTS API Error: ${response.status}`);
  }

  const audioBlob = await response.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Return base64 audio
  const base64Audio = `data:audio/mp3;base64,${buffer.toString('base64')}`;

  return NextResponse.json({ audioUrl: base64Audio });
}

/**
 * Handles chunked TTS processing for long text.
 * Splits text into chunks, generates TTS for each, inserts silence gaps,
 * and concatenates into a single audio response.
 */
async function handleChunkedTTS(text: string) {
  const chunks = chunkTextForTTS(text);
  const audioBuffers: (Buffer | null)[] = [];
  const silenceBuffer = generateSilenceBuffer();
  let failedChunks = 0;

  // Process each chunk sequentially
  for (let i = 0; i < chunks.length; i++) {
    const chunkAudio = await fetchTTSWithRetry(chunks[i]);

    if (chunkAudio === null) {
      failedChunks++;
    }

    audioBuffers.push(chunkAudio);
  }

  // Concatenate successful audio chunks with silence between them
  const concatenatedParts: Buffer[] = [];

  for (let i = 0; i < audioBuffers.length; i++) {
    const buffer = audioBuffers[i];
    if (buffer !== null) {
      if (concatenatedParts.length > 0) {
        // Insert silence between chunks
        concatenatedParts.push(silenceBuffer);
      }
      concatenatedParts.push(buffer);
    }
  }

  // If all chunks failed, return an error
  if (concatenatedParts.length === 0) {
    return NextResponse.json(
      { error: 'All TTS chunks failed', hasIncompleteAudio: true },
      { status: 500 }
    );
  }

  const finalBuffer = Buffer.concat(concatenatedParts);
  const base64Audio = `data:audio/mp3;base64,${finalBuffer.toString('base64')}`;

  const response: {
    audioUrl: string;
    hasIncompleteAudio?: boolean;
    chunkCount?: number;
  } = {
    audioUrl: base64Audio,
    chunkCount: chunks.length,
  };

  if (failedChunks > 0) {
    response.hasIncompleteAudio = true;
  }

  return NextResponse.json(response);
}
