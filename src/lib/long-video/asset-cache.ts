/**
 * Asset persistence and recovery for long-form video generation.
 * Persists generated assets (images, audio) to localStorage so they can
 * be recovered if the user navigates away or closes the browser tab.
 *
 * Handles localStorage quota exceeded errors by falling back to in-memory storage.
 *
 * Feature: long-video-export
 * Requirements: 4.8
 */

import { AssetCache } from './types';

const STORAGE_KEY_PREFIX = 'ai-storycraft-assets-';

/** In-memory fallback storage used when localStorage quota is exceeded. */
const memoryStore = new Map<string, AssetCache>();

/** Flag indicating localStorage is unavailable and recovery won't persist across page loads. */
let usingMemoryFallback = false;

/**
 * Returns whether the module has fallen back to in-memory storage.
 * When true, assets won't survive page navigation or tab close.
 */
export function isUsingMemoryFallback(): boolean {
  return usingMemoryFallback;
}

/**
 * Persists asset cache to localStorage for the given session.
 * Falls back to in-memory storage if localStorage quota is exceeded.
 */
export function saveAssets(sessionId: string, assets: AssetCache): void {
  const key = `${STORAGE_KEY_PREFIX}${sessionId}`;

  if (usingMemoryFallback) {
    memoryStore.set(key, assets);
    return;
  }

  try {
    const serialized = JSON.stringify(assets);
    localStorage.setItem(key, serialized);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn(
        '[asset-cache] localStorage quota exceeded. Falling back to in-memory storage. ' +
          'Asset recovery will not be possible if the user leaves the page.'
      );
      usingMemoryFallback = true;
      memoryStore.set(key, assets);
    } else {
      // Re-throw unexpected errors
      throw error;
    }
  }
}

/**
 * Loads cached assets from localStorage (or in-memory fallback) for the given session.
 * Returns null if no cached assets are found.
 */
export function loadAssets(sessionId: string): AssetCache | null {
  const key = `${STORAGE_KEY_PREFIX}${sessionId}`;

  if (usingMemoryFallback) {
    return memoryStore.get(key) ?? null;
  }

  try {
    const serialized = localStorage.getItem(key);
    if (serialized === null) {
      return null;
    }
    return JSON.parse(serialized) as AssetCache;
  } catch {
    // If parsing fails or localStorage is inaccessible, try memory fallback
    return memoryStore.get(key) ?? null;
  }
}

/**
 * Removes cached assets for a session from localStorage (or in-memory fallback).
 */
export function clearAssets(sessionId: string): void {
  const key = `${STORAGE_KEY_PREFIX}${sessionId}`;

  if (usingMemoryFallback) {
    memoryStore.delete(key);
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // If localStorage is inaccessible, clear from memory store
    memoryStore.delete(key);
  }
}

/**
 * Creates a unique session ID for a generation run.
 * Uses crypto.randomUUID when available, falls back to Date.now-based ID.
 */
export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random suffix for uniqueness
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Finds any cached session in localStorage by scanning for keys with the asset prefix.
 * Returns the parsed AssetCache of the most recent session, or null if none found.
 */
export function findCachedSession(): AssetCache | null {
  if (usingMemoryFallback) {
    // Check in-memory store
    let latest: AssetCache | null = null;
    for (const value of memoryStore.values()) {
      if (!latest || value.timestamp > latest.timestamp) {
        latest = value;
      }
    }
    return latest;
  }

  try {
    let latest: AssetCache | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as AssetCache;
          if (!latest || parsed.timestamp > latest.timestamp) {
            latest = parsed;
          }
        }
      }
    }
    return latest;
  } catch {
    return null;
  }
}

/**
 * Resets the memory fallback state. Primarily useful for testing.
 * @internal
 */
export function _resetMemoryFallback(): void {
  usingMemoryFallback = false;
  memoryStore.clear();
}
