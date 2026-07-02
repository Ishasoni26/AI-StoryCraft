/**
 * Unit tests for the extended TTS route with chunked processing.
 *
 * Feature: long-video-export
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';

// Helper to create a mock Request with JSON body
function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Helper to create a fake MP3 audio buffer
function createFakeAudioBuffer(size = 100): ArrayBuffer {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  // Fill with non-zero data to simulate audio
  for (let i = 0; i < size; i++) {
    view[i] = (i % 255) + 1;
  }
  return buffer;
}

describe('/api/tts route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe('standard (non-chunked) behavior', () => {
    it('returns 400 when text is missing', async () => {
      const req = createRequest({});
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Text is required');
    });

    it('returns audioUrl for short text without chunked flag', async () => {
      const fakeAudio = createFakeAudioBuffer();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob([fakeAudio])),
      });

      const req = createRequest({ text: 'Hello world' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.audioUrl).toMatch(/^data:audio\/mp3;base64,/);
      expect(json.chunkCount).toBeUndefined();
      expect(json.hasIncompleteAudio).toBeUndefined();
    });

    it('truncates text > 199 chars in standard mode', async () => {
      const longText = 'a'.repeat(250);
      const fakeAudio = createFakeAudioBuffer();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob([fakeAudio])),
      });

      const req = createRequest({ text: longText }); // no chunked flag
      const res = await POST(req);
      expect(res.status).toBe(200);

      // Should use truncated text
      const fetchCall = (global.fetch as any).mock.calls[0][0] as string;
      expect(fetchCall).toContain('...');
    });

    it('does not chunk when chunked=false even with long text', async () => {
      const longText = 'a'.repeat(250);
      const fakeAudio = createFakeAudioBuffer();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob([fakeAudio])),
      });

      const req = createRequest({ text: longText, chunked: false });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.chunkCount).toBeUndefined();
    });
  });

  describe('chunked processing', () => {
    it('uses chunked processing when chunked=true and text > 200 chars', async () => {
      // Text with sentence boundaries for clean splitting (> 200 chars)
      const longText =
        'यह एक लंबा वाक्य है जो दो सौ अक्षरों से अधिक है और इसमें कई शब्द हैं। ' +
        'इस कहानी में बहुत सारे पात्र हैं जो अलग-अलग जगहों पर रहते हैं और काम करते हैं। ' +
        'वे सब मिलकर एक बड़ा काम करते हैं जो बहुत महत्वपूर्ण है। ' +
        'अंत में सब खुश होते हैं और अपने अपने घर वापस जाते हैं।';

      const fakeAudio = createFakeAudioBuffer(50);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob([fakeAudio])),
      });

      const req = createRequest({ text: longText, chunked: true });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.audioUrl).toMatch(/^data:audio\/mp3;base64,/);
      expect(json.chunkCount).toBeGreaterThanOrEqual(2);
      expect(json.hasIncompleteAudio).toBeUndefined();
    });

    it('falls back to standard processing when chunked=true but text ≤ 200 chars', async () => {
      const shortText = 'Short text under the limit.';
      const fakeAudio = createFakeAudioBuffer();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob([fakeAudio])),
      });

      const req = createRequest({ text: shortText, chunked: true });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      // Should not have chunkCount (standard path)
      expect(json.chunkCount).toBeUndefined();
    });

    it('returns hasIncompleteAudio=true when some chunks fail', async () => {
      // Text long enough to produce at least 2 chunks (> 200 chars)
      const longText =
        'यह एक बहुत लंबा पाठ है जो कई वाक्यों में विभाजित होगा और इसमें बहुत सारी जानकारी है। ' +
        'पहला भाग सफलतापूर्वक काम करेगा लेकिन दूसरा भाग विफल हो जाएगा जो एक समस्या है। ' +
        'तीसरा भाग भी सफल होगा और अंतिम परिणाम आंशिक होगा जो हमें बताएगा कि कुछ गलत हुआ।';

      let callCount = 0;
      const fakeAudio = createFakeAudioBuffer(50);
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        // Fail the second chunk (calls 2, 3, 4 for retries)
        // First call succeeds, then next 3 fail (original + 2 retries), then rest succeed
        if (callCount >= 2 && callCount <= 4) {
          return Promise.resolve({
            ok: false,
            status: 500,
            blob: () => Promise.reject(new Error('Server Error')),
          });
        }
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob([fakeAudio])),
        });
      });

      const req = createRequest({ text: longText, chunked: true });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.audioUrl).toMatch(/^data:audio\/mp3;base64,/);
      expect(json.hasIncompleteAudio).toBe(true);
    });

    it('returns 500 when all chunks fail', { timeout: 30000 }, async () => {
      const longText =
        'यह एक लंबा टेक्स्ट है जो कई हिस्सों में बंटेगा और सभी हिस्से विफल हो जाएंगे। ' +
        'लेकिन सभी हिस्से विफल हो जाएंगे और कोई ऑडियो नहीं मिलेगा क्योंकि सर्वर काम नहीं कर रहा है। ' +
        'यह एक त्रुटि परिदृश्य का परीक्षण करता है जो बहुत ही महत्वपूर्ण है हमारे एप्लिकेशन के लिए।';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        blob: () => Promise.reject(new Error('Server Error')),
      });

      const req = createRequest({ text: longText, chunked: true });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.hasIncompleteAudio).toBe(true);
    });

    it('retries failed chunks up to 2 times with delays', async () => {
      const longText =
        'यह एक लंबा पाठ है जो चंकिंग के लिए पर्याप्त है और इसमें बहुत सारे अक्षर हैं। ' +
        'इसमें कई वाक्य हैं जो अलग अलग चंक्स में बंटेंगे और हर चंक का अलग से परीक्षण होगा। ' +
        'प्रत्येक चंक के लिए रिट्राई लॉजिक का परीक्षण किया जाएगा जो बहुत जरूरी है।';

      let callCount = 0;
      const fakeAudio = createFakeAudioBuffer(50);
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        // First chunk: fails twice then succeeds on 3rd attempt
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 503,
            blob: () => Promise.reject(new Error('Service Unavailable')),
          });
        }
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob([fakeAudio])),
        });
      });

      const req = createRequest({ text: longText, chunked: true });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      // First chunk should have eventually succeeded after retries
      expect(json.audioUrl).toMatch(/^data:audio\/mp3;base64,/);
      // Verify retries happened (at least 3 calls for first chunk: 2 failures + 1 success)
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('concatenated audio is larger than single chunk audio (proves concatenation)', async () => {
      // Long text that will definitely produce multiple chunks
      const longText =
        'पहला वाक्य यहाँ है जो काफी लंबा है। ' +
        'दूसरा वाक्य भी यहाँ है और यह भी लंबा है। ' +
        'तीसरा वाक्य इस कहानी का एक महत्वपूर्ण हिस्सा है। ' +
        'चौथा वाक्य सबसे अंत में आता है और कहानी समाप्त करता है। ' +
        'पांचवां वाक्य अतिरिक्त लंबाई के लिए जोड़ा गया है।';

      const fakeAudio = createFakeAudioBuffer(200);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob([fakeAudio])),
      });

      const req = createRequest({ text: longText, chunked: true });
      const res = await POST(req);
      const json = await res.json();

      // The base64 audio should be significantly larger than a single chunk
      // because it includes multiple chunks + silence between them
      const audioData = json.audioUrl.replace('data:audio/mp3;base64,', '');
      const decodedSize = Buffer.from(audioData, 'base64').length;

      // At minimum, size should be > single chunk (200 bytes) since we have multiple
      expect(decodedSize).toBeGreaterThan(200);
      expect(json.chunkCount).toBeGreaterThanOrEqual(2);
    });
  });
});
