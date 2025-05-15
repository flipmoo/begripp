/**
 * Cache Module
 *
 * This module provides functions for caching data in the database.
 */

import { getDatabase } from '../database';

/**
 * Cache Manager class
 *
 * Provides methods for managing cache entries in the database.
 */
export class CacheManager {
  /**
   * Set a cache entry
   * @param key Cache key
   * @param data Data to cache
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   */
  static async set(key: string, data: any, expiresIn = 3600): Promise<void> {
    await setCache(key, data, expiresIn);
  }

  /**
   * Get a cache entry
   * @param key Cache key
   * @returns Cached data or null if not found or expired
   */
  static async get<T = any>(key: string): Promise<T | null> {
    return getCache<T>(key);
  }

  /**
   * Delete a cache entry
   * @param key Cache key
   */
  static async delete(key: string): Promise<void> {
    await deleteCache(key);
  }

  /**
   * Clear all cache entries
   */
  static async clear(): Promise<void> {
    await clearCache();
  }

  /**
   * Clear expired cache entries
   */
  static async clearExpired(): Promise<void> {
    await clearExpiredCache();
  }
}

/**
 * Set a cache entry
 * @param key Cache key
 * @param data Data to cache
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 */
export async function setCache(key: string, data: any, expiresIn = 3600): Promise<void> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresIn;

  try {
    // Check if key already exists
    const existing = await db.get('SELECT key FROM cache WHERE key = ?', [key]);

    if (existing) {
      // Update existing entry
      await db.run(
        'UPDATE cache SET value = ?, created_at = ?, expires_at = ? WHERE key = ?',
        [JSON.stringify(data), now, expiresAt, key]
      );
    } else {
      // Insert new entry
      await db.run(
        'INSERT INTO cache (key, value, created_at, expires_at) VALUES (?, ?, ?, ?)',
        [key, JSON.stringify(data), now, expiresAt]
      );
    }
  } catch (error) {
    console.error('Error setting cache:', error);
    throw error;
  }
}

/**
 * Get a cache entry
 * @param key Cache key
 * @returns Cached data or null if not found or expired
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  try {
    const entry = await db.get(
      'SELECT value, expires_at FROM cache WHERE key = ?',
      [key]
    );

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expires_at < now) {
      // Remove expired entry
      await db.run('DELETE FROM cache WHERE key = ?', [key]);
      return null;
    }

    return JSON.parse(entry.value);
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

/**
 * Delete a cache entry
 * @param key Cache key
 */
export async function deleteCache(key: string): Promise<void> {
  const db = await getDatabase();

  try {
    await db.run('DELETE FROM cache WHERE key = ?', [key]);
  } catch (error) {
    console.error('Error deleting cache:', error);
    throw error;
  }
}

/**
 * Clear all cache entries
 */
export async function clearCache(): Promise<void> {
  const db = await getDatabase();

  try {
    await db.run('DELETE FROM cache');
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<void> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.run('DELETE FROM cache WHERE expires_at < ?', [now]);
  } catch (error) {
    console.error('Error clearing expired cache:', error);
    throw error;
  }
}

export default {
  setCache,
  getCache,
  deleteCache,
  clearCache,
  clearExpiredCache
};
