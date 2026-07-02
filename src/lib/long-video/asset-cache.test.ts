/**
 * Unit tests for asset persistence and recovery module.
 * Feature: long-video-export
 * Requirements: 4.8
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AssetCache } from './types';

// Mock localStorage before importing the module
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
};

vi.stubGlobal('localStorage', mockLocalStorage);

// Import after stubbing globals
import {
  saveAssets,
  loadAssets,
  clearAssets,
  generateSessionId,
  isUsingMemoryFallback,
  _resetMemoryFallback,
} from './asset-cache';

function createMockAssets(sessionId: string): AssetCache {
  return {
    sessionId,
    timestamp: Date.now(),
    scenes: [
      { index: 0, imageUrl: 'data:image/png;base64,abc', audioUrl: 'data:audio/mp3;base64,xyz', status: 'complete' },
      { index: 1, status: 'pending' },
      { index: 2, imageUrl: 'data:image/png;base64,def', status: 'failed' },
    ],
  };
}

describe('asset-cache', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    // Reset to default implementations
    mockLocalStorage.getItem.mockImplementation((key: string) => store[key] ?? null);
    mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
      store[key] = value;
    });
    mockLocalStorage.removeItem.mockImplementation((key: string) => {
      delete store[key];
    });
    _resetMemoryFallback();
  });

  describe('saveAssets', () => {
    it('persists assets to localStorage with correct key format', () => {
      const assets = createMockAssets('test-session-1');
      saveAssets('test-session-1', assets);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'ai-storycraft-assets-test-session-1',
        JSON.stringify(assets)
      );
    });

    it('falls back to in-memory storage on QuotaExceededError', () => {
      const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
      mockLocalStorage.setItem.mockImplementation(() => {
        throw quotaError;
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const assets = createMockAssets('session-quota');

      saveAssets('session-quota', assets);

      expect(isUsingMemoryFallback()).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('localStorage quota exceeded'));

      // Verify assets are still accessible via loadAssets
      const loaded = loadAssets('session-quota');
      expect(loaded).toEqual(assets);

      warnSpy.mockRestore();
    });

    it('re-throws non-QuotaExceededError exceptions', () => {
      const error = new Error('unexpected error');
      mockLocalStorage.setItem.mockImplementation(() => {
        throw error;
      });

      const assets = createMockAssets('session-error');
      expect(() => saveAssets('session-error', assets)).toThrow('unexpected error');
    });

    it('uses memory store directly once fallback is activated', () => {
      // Trigger fallback
      const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
      mockLocalStorage.setItem.mockImplementation(() => {
        throw quotaError;
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const assets1 = createMockAssets('s1');
      saveAssets('s1', assets1);

      // Reset mock to allow normal localStorage operations
      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });

      // Second save should go directly to memory store (fallback flag is set)
      const assets2 = createMockAssets('s2');
      saveAssets('s2', assets2);

      // Should NOT have called localStorage.setItem for the second save
      // (it was called once for the first save attempt which threw)
      const setItemCallsAfterReset = mockLocalStorage.setItem.mock.calls.filter(
        (call) => call[0] === 'ai-storycraft-assets-s2'
      );
      expect(setItemCallsAfterReset.length).toBe(0);

      // But loadAssets should still return the data
      const loaded = loadAssets('s2');
      expect(loaded).toEqual(assets2);
    });
  });

  describe('loadAssets', () => {
    it('returns cached assets from localStorage', () => {
      const assets = createMockAssets('load-test');
      store['ai-storycraft-assets-load-test'] = JSON.stringify(assets);

      const loaded = loadAssets('load-test');
      expect(loaded).toEqual(assets);
    });

    it('returns null when no cached assets exist', () => {
      const loaded = loadAssets('nonexistent');
      expect(loaded).toBeNull();
    });

    it('returns null on invalid JSON in localStorage', () => {
      store['ai-storycraft-assets-bad-json'] = 'not valid json{{{';
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        const val = store[key];
        return val ?? null;
      });

      const loaded = loadAssets('bad-json');
      expect(loaded).toBeNull();
    });

    it('reads from memory store when using fallback', () => {
      // Trigger fallback
      const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
      mockLocalStorage.setItem.mockImplementation(() => {
        throw quotaError;
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const assets = createMockAssets('mem-read');
      saveAssets('mem-read', assets);

      const loaded = loadAssets('mem-read');
      expect(loaded).toEqual(assets);
    });
  });

  describe('clearAssets', () => {
    it('removes assets from localStorage', () => {
      const assets = createMockAssets('clear-test');
      saveAssets('clear-test', assets);

      clearAssets('clear-test');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('ai-storycraft-assets-clear-test');
      expect(loadAssets('clear-test')).toBeNull();
    });

    it('removes assets from memory store when using fallback', () => {
      // Trigger fallback
      const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
      mockLocalStorage.setItem.mockImplementation(() => {
        throw quotaError;
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const assets = createMockAssets('clear-mem');
      saveAssets('clear-mem', assets);

      clearAssets('clear-mem');
      expect(loadAssets('clear-mem')).toBeNull();
    });
  });

  describe('generateSessionId', () => {
    it('returns a non-empty string', () => {
      const id = generateSessionId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique IDs on consecutive calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('isUsingMemoryFallback', () => {
    it('returns false initially', () => {
      expect(isUsingMemoryFallback()).toBe(false);
    });

    it('returns true after QuotaExceededError', () => {
      const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
      mockLocalStorage.setItem.mockImplementation(() => {
        throw quotaError;
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      saveAssets('trigger', createMockAssets('trigger'));

      expect(isUsingMemoryFallback()).toBe(true);
    });
  });
});
