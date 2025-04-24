/**
 * Enhanced Cache Service
 * 
 * Een verbeterde cache service met multi-level caching, expiration en statistieken.
 */
import NodeCache from 'node-cache';

/**
 * Cache levels
 */
export enum CacheLevel {
  /** Memory cache (snelste, maar verdwijnt bij server restart) */
  MEMORY = 'memory',
  /** Persistent cache (langzamer, maar blijft bestaan na server restart) */
  PERSISTENT = 'persistent'
}

/**
 * Cache entry type
 */
interface CacheEntry<T> {
  /** De waarde */
  value: T;
  /** Timestamp wanneer de entry is aangemaakt */
  created: number;
  /** Timestamp wanneer de entry verloopt */
  expires: number;
  /** Cache level */
  level: CacheLevel;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Cache statistieken
 */
interface CacheStats {
  /** Aantal hits */
  hits: number;
  /** Aantal misses */
  misses: number;
  /** Aantal sets */
  sets: number;
  /** Aantal deletes */
  deletes: number;
  /** Aantal flushes */
  flushes: number;
  /** Hit ratio */
  hitRatio: number;
  /** Aantal items in de cache */
  size: number;
  /** Geschatte geheugengebruik in bytes */
  memoryUsage: number;
  /** Statistieken per cache level */
  byLevel: Record<CacheLevel, {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    size: number;
  }>;
  /** Statistieken per cache key prefix */
  byPrefix: Record<string, {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    size: number;
  }>;
}

/**
 * Cache opties
 */
interface CacheOptions {
  /** Standaard TTL in seconden */
  defaultTtl?: number;
  /** Check periode in seconden */
  checkPeriod?: number;
  /** Maximum aantal items in de cache */
  maxItems?: number;
  /** Gebruik debug logging */
  debug?: boolean;
  /** Functie voor het serialiseren van waarden (voor persistent cache) */
  serialize?: <T>(value: T) => string;
  /** Functie voor het deserializeren van waarden (voor persistent cache) */
  deserialize?: <T>(value: string) => T;
}

/**
 * Enhanced Cache Service
 */
export class EnhancedCache {
  private memoryCache: NodeCache;
  private persistentCache: Map<string, string> = new Map();
  private stats: CacheStats;
  private options: Required<CacheOptions>;
  private prefixStats: Map<string, { hits: number; misses: number; sets: number; deletes: number; size: number }> = new Map();

  /**
   * Constructor
   * @param options Cache opties
   */
  constructor(options: CacheOptions = {}) {
    // Standaard opties
    this.options = {
      defaultTtl: 3600, // 1 uur
      checkPeriod: 600, // 10 minuten
      maxItems: 1000,
      debug: false,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
      ...options
    };

    // Initialiseer memory cache
    this.memoryCache = new NodeCache({
      stdTTL: this.options.defaultTtl,
      checkperiod: this.options.checkPeriod,
      maxKeys: this.options.maxItems
    });

    // Initialiseer statistieken
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      flushes: 0,
      hitRatio: 0,
      size: 0,
      memoryUsage: 0,
      byLevel: {
        [CacheLevel.MEMORY]: { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0 },
        [CacheLevel.PERSISTENT]: { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0 }
      },
      byPrefix: {}
    };

    // Log initialisatie
    if (this.options.debug) {
      console.log(`Enhanced cache initialized with options:`, {
        defaultTtl: this.options.defaultTtl,
        checkPeriod: this.options.checkPeriod,
        maxItems: this.options.maxItems
      });
    }

    // Laad persistent cache uit localStorage in browser omgeving
    this.loadPersistentCache();
  }

  /**
   * Haal een waarde op uit de cache
   * @param key Cache key
   * @param defaultValue Standaard waarde als de key niet bestaat
   * @returns De waarde of undefined
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    // Probeer eerst memory cache
    const memoryValue = this.memoryCache.get<CacheEntry<T>>(key);
    
    if (memoryValue !== undefined) {
      // Update statistieken
      this.updateStats('hit', key, CacheLevel.MEMORY);
      
      if (this.options.debug) {
        console.log(`Cache HIT (memory) for key: ${key}`);
      }
      
      return memoryValue.value;
    }
    
    // Probeer persistent cache
    try {
      const persistentKey = this.getPersistentKey(key);
      const serializedValue = this.persistentCache.get(persistentKey);
      
      if (serializedValue !== undefined) {
        const entry = this.options.deserialize<CacheEntry<T>>(serializedValue);
        
        // Controleer of de entry is verlopen
        if (entry.expires > Date.now()) {
          // Update statistieken
          this.updateStats('hit', key, CacheLevel.PERSISTENT);
          
          // Kopieer naar memory cache voor snellere toegang in de toekomst
          this.memoryCache.set(
            key,
            entry,
            Math.floor((entry.expires - Date.now()) / 1000)
          );
          
          if (this.options.debug) {
            console.log(`Cache HIT (persistent) for key: ${key}`);
          }
          
          return entry.value;
        } else {
          // Verwijder verlopen entry
          this.persistentCache.delete(persistentKey);
          this.updateStats('delete', key, CacheLevel.PERSISTENT);
          
          if (this.options.debug) {
            console.log(`Cache EXPIRED for key: ${key}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error retrieving from persistent cache for key: ${key}`, error);
    }
    
    // Cache miss
    this.updateStats('miss', key);
    
    if (this.options.debug) {
      console.log(`Cache MISS for key: ${key}`);
    }
    
    return defaultValue;
  }

  /**
   * Zet een waarde in de cache
   * @param key Cache key
   * @param value De waarde
   * @param ttl TTL in seconden (optioneel)
   * @param level Cache level (optioneel, standaard: MEMORY)
   * @param metadata Metadata (optioneel)
   */
  set<T>(
    key: string,
    value: T,
    ttl: number = this.options.defaultTtl,
    level: CacheLevel = CacheLevel.MEMORY,
    metadata?: Record<string, any>
  ): void {
    // Bereken expiration timestamp
    const now = Date.now();
    const expires = now + (ttl * 1000);
    
    // Maak cache entry
    const entry: CacheEntry<T> = {
      value,
      created: now,
      expires,
      level,
      metadata
    };
    
    // Zet in memory cache
    this.memoryCache.set(key, entry, ttl);
    this.updateStats('set', key, CacheLevel.MEMORY);
    
    // Zet in persistent cache als nodig
    if (level === CacheLevel.PERSISTENT) {
      try {
        const persistentKey = this.getPersistentKey(key);
        const serializedValue = this.options.serialize(entry);
        this.persistentCache.set(persistentKey, serializedValue);
        this.savePersistentCache();
        this.updateStats('set', key, CacheLevel.PERSISTENT);
      } catch (error) {
        console.error(`Error saving to persistent cache for key: ${key}`, error);
      }
    }
    
    if (this.options.debug) {
      console.log(`Cache SET for key: ${key} with TTL: ${ttl}s at level: ${level}`);
    }
  }

  /**
   * Controleer of een key in de cache zit
   * @param key Cache key
   * @returns True als de key in de cache zit
   */
  has(key: string): boolean {
    // Controleer memory cache
    if (this.memoryCache.has(key)) {
      return true;
    }
    
    // Controleer persistent cache
    try {
      const persistentKey = this.getPersistentKey(key);
      return this.persistentCache.has(persistentKey);
    } catch (error) {
      console.error(`Error checking persistent cache for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Verwijder een key uit de cache
   * @param key Cache key
   * @returns True als de key is verwijderd
   */
  delete(key: string): boolean {
    let deleted = false;
    
    // Verwijder uit memory cache
    if (this.memoryCache.del(key) > 0) {
      deleted = true;
      this.updateStats('delete', key, CacheLevel.MEMORY);
    }
    
    // Verwijder uit persistent cache
    try {
      const persistentKey = this.getPersistentKey(key);
      if (this.persistentCache.delete(persistentKey)) {
        deleted = true;
        this.updateStats('delete', key, CacheLevel.PERSISTENT);
        this.savePersistentCache();
      }
    } catch (error) {
      console.error(`Error deleting from persistent cache for key: ${key}`, error);
    }
    
    if (this.options.debug && deleted) {
      console.log(`Cache DELETE for key: ${key}`);
    }
    
    return deleted;
  }

  /**
   * Verwijder meerdere keys uit de cache
   * @param keys Array van cache keys
   * @returns Aantal verwijderde keys
   */
  deleteMany(keys: string[]): number {
    let count = 0;
    
    for (const key of keys) {
      if (this.delete(key)) {
        count++;
      }
    }
    
    if (this.options.debug && count > 0) {
      console.log(`Cache DELETE_MANY: ${count} keys removed`);
    }
    
    return count;
  }

  /**
   * Verwijder alle keys met een bepaald prefix
   * @param prefix Key prefix
   * @returns Aantal verwijderde keys
   */
  deleteByPrefix(prefix: string): number {
    // Verzamel alle keys met het prefix
    const memoryKeys = this.memoryCache.keys().filter(key => key.startsWith(prefix));
    const persistentKeys = Array.from(this.persistentCache.keys())
      .filter(key => this.getOriginalKey(key).startsWith(prefix))
      .map(key => this.getOriginalKey(key));
    
    // Combineer en verwijder duplicaten
    const allKeys = [...new Set([...memoryKeys, ...persistentKeys])];
    
    // Verwijder alle keys
    return this.deleteMany(allKeys);
  }

  /**
   * Leeg de cache
   * @param level Cache level (optioneel, standaard: alle levels)
   */
  clear(level?: CacheLevel): void {
    // Leeg memory cache
    if (!level || level === CacheLevel.MEMORY) {
      this.memoryCache.flushAll();
      this.stats.byLevel[CacheLevel.MEMORY].size = 0;
    }
    
    // Leeg persistent cache
    if (!level || level === CacheLevel.PERSISTENT) {
      this.persistentCache.clear();
      this.savePersistentCache();
      this.stats.byLevel[CacheLevel.PERSISTENT].size = 0;
    }
    
    // Update statistieken
    this.stats.flushes++;
    this.updateCacheSize();
    
    if (this.options.debug) {
      console.log(`Cache CLEAR${level ? ` for level: ${level}` : ''}`);
    }
  }

  /**
   * Haal alle cache keys op
   * @param level Cache level (optioneel, standaard: alle levels)
   * @returns Array van cache keys
   */
  keys(level?: CacheLevel): string[] {
    const keys: string[] = [];
    
    // Haal memory cache keys op
    if (!level || level === CacheLevel.MEMORY) {
      keys.push(...this.memoryCache.keys());
    }
    
    // Haal persistent cache keys op
    if (!level || level === CacheLevel.PERSISTENT) {
      keys.push(...Array.from(this.persistentCache.keys()).map(key => this.getOriginalKey(key)));
    }
    
    // Verwijder duplicaten
    return [...new Set(keys)];
  }

  /**
   * Haal cache statistieken op
   * @returns Cache statistieken
   */
  getStats(): CacheStats {
    // Update cache grootte en geheugengebruik
    this.updateCacheSize();
    
    // Bereken hit ratio
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    // Update prefix statistieken
    this.stats.byPrefix = {};
    for (const [prefix, stats] of this.prefixStats.entries()) {
      this.stats.byPrefix[prefix] = { ...stats };
    }
    
    return { ...this.stats };
  }

  /**
   * Haal de TTL van een key op
   * @param key Cache key
   * @returns TTL in seconden of undefined als de key niet bestaat
   */
  getTtl(key: string): number | undefined {
    // Probeer memory cache
    const memoryValue = this.memoryCache.get<CacheEntry<any>>(key);
    
    if (memoryValue !== undefined) {
      return Math.max(0, Math.floor((memoryValue.expires - Date.now()) / 1000));
    }
    
    // Probeer persistent cache
    try {
      const persistentKey = this.getPersistentKey(key);
      const serializedValue = this.persistentCache.get(persistentKey);
      
      if (serializedValue !== undefined) {
        const entry = this.options.deserialize<CacheEntry<any>>(serializedValue);
        return Math.max(0, Math.floor((entry.expires - Date.now()) / 1000));
      }
    } catch (error) {
      console.error(`Error getting TTL from persistent cache for key: ${key}`, error);
    }
    
    return undefined;
  }

  /**
   * Update de TTL van een key
   * @param key Cache key
   * @param ttl Nieuwe TTL in seconden
   * @returns True als de TTL is bijgewerkt
   */
  updateTtl(key: string, ttl: number): boolean {
    // Probeer memory cache
    const memoryValue = this.memoryCache.get<CacheEntry<any>>(key);
    
    if (memoryValue !== undefined) {
      // Update expiration
      memoryValue.expires = Date.now() + (ttl * 1000);
      
      // Zet terug in memory cache
      this.memoryCache.set(key, memoryValue, ttl);
      
      // Update persistent cache als nodig
      if (memoryValue.level === CacheLevel.PERSISTENT) {
        try {
          const persistentKey = this.getPersistentKey(key);
          const serializedValue = this.options.serialize(memoryValue);
          this.persistentCache.set(persistentKey, serializedValue);
          this.savePersistentCache();
        } catch (error) {
          console.error(`Error updating TTL in persistent cache for key: ${key}`, error);
        }
      }
      
      if (this.options.debug) {
        console.log(`Cache TTL updated for key: ${key} to ${ttl}s`);
      }
      
      return true;
    }
    
    // Probeer persistent cache
    try {
      const persistentKey = this.getPersistentKey(key);
      const serializedValue = this.persistentCache.get(persistentKey);
      
      if (serializedValue !== undefined) {
        const entry = this.options.deserialize<CacheEntry<any>>(serializedValue);
        
        // Update expiration
        entry.expires = Date.now() + (ttl * 1000);
        
        // Zet terug in persistent cache
        const updatedSerializedValue = this.options.serialize(entry);
        this.persistentCache.set(persistentKey, updatedSerializedValue);
        this.savePersistentCache();
        
        // Zet ook in memory cache voor snellere toegang
        this.memoryCache.set(key, entry, ttl);
        
        if (this.options.debug) {
          console.log(`Cache TTL updated for key: ${key} to ${ttl}s`);
        }
        
        return true;
      }
    } catch (error) {
      console.error(`Error updating TTL in persistent cache for key: ${key}`, error);
    }
    
    return false;
  }

  /**
   * Haal de metadata van een key op
   * @param key Cache key
   * @returns Metadata of undefined als de key niet bestaat
   */
  getMetadata(key: string): Record<string, any> | undefined {
    // Probeer memory cache
    const memoryValue = this.memoryCache.get<CacheEntry<any>>(key);
    
    if (memoryValue !== undefined) {
      return memoryValue.metadata;
    }
    
    // Probeer persistent cache
    try {
      const persistentKey = this.getPersistentKey(key);
      const serializedValue = this.persistentCache.get(persistentKey);
      
      if (serializedValue !== undefined) {
        const entry = this.options.deserialize<CacheEntry<any>>(serializedValue);
        return entry.metadata;
      }
    } catch (error) {
      console.error(`Error getting metadata from persistent cache for key: ${key}`, error);
    }
    
    return undefined;
  }

  /**
   * Update de metadata van een key
   * @param key Cache key
   * @param metadata Nieuwe metadata
   * @returns True als de metadata is bijgewerkt
   */
  updateMetadata(key: string, metadata: Record<string, any>): boolean {
    // Probeer memory cache
    const memoryValue = this.memoryCache.get<CacheEntry<any>>(key);
    
    if (memoryValue !== undefined) {
      // Update metadata
      memoryValue.metadata = { ...memoryValue.metadata, ...metadata };
      
      // Bereken resterende TTL
      const ttl = Math.max(0, Math.floor((memoryValue.expires - Date.now()) / 1000));
      
      // Zet terug in memory cache
      this.memoryCache.set(key, memoryValue, ttl);
      
      // Update persistent cache als nodig
      if (memoryValue.level === CacheLevel.PERSISTENT) {
        try {
          const persistentKey = this.getPersistentKey(key);
          const serializedValue = this.options.serialize(memoryValue);
          this.persistentCache.set(persistentKey, serializedValue);
          this.savePersistentCache();
        } catch (error) {
          console.error(`Error updating metadata in persistent cache for key: ${key}`, error);
        }
      }
      
      if (this.options.debug) {
        console.log(`Cache metadata updated for key: ${key}`);
      }
      
      return true;
    }
    
    // Probeer persistent cache
    try {
      const persistentKey = this.getPersistentKey(key);
      const serializedValue = this.persistentCache.get(persistentKey);
      
      if (serializedValue !== undefined) {
        const entry = this.options.deserialize<CacheEntry<any>>(serializedValue);
        
        // Update metadata
        entry.metadata = { ...entry.metadata, ...metadata };
        
        // Bereken resterende TTL
        const ttl = Math.max(0, Math.floor((entry.expires - Date.now()) / 1000));
        
        // Zet terug in persistent cache
        const updatedSerializedValue = this.options.serialize(entry);
        this.persistentCache.set(persistentKey, updatedSerializedValue);
        this.savePersistentCache();
        
        // Zet ook in memory cache voor snellere toegang
        this.memoryCache.set(key, entry, ttl);
        
        if (this.options.debug) {
          console.log(`Cache metadata updated for key: ${key}`);
        }
        
        return true;
      }
    } catch (error) {
      console.error(`Error updating metadata in persistent cache for key: ${key}`, error);
    }
    
    return false;
  }

  /**
   * Haal een waarde op uit de cache of bereken deze als de key niet bestaat
   * @param key Cache key
   * @param factory Functie om de waarde te berekenen
   * @param ttl TTL in seconden (optioneel)
   * @param level Cache level (optioneel, standaard: MEMORY)
   * @returns De waarde
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = this.options.defaultTtl,
    level: CacheLevel = CacheLevel.MEMORY
  ): Promise<T> {
    // Probeer eerst uit de cache te halen
    const cachedValue = this.get<T>(key);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    // Bereken de waarde
    try {
      const value = await factory();
      
      // Zet in de cache
      this.set(key, value, ttl, level);
      
      return value;
    } catch (error) {
      console.error(`Error calculating value for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Update statistieken
   * @param action Actie (hit, miss, set, delete)
   * @param key Cache key
   * @param level Cache level (optioneel)
   */
  private updateStats(
    action: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    level?: CacheLevel
  ): void {
    // Update globale statistieken
    switch (action) {
      case 'hit':
        this.stats.hits++;
        if (level) {
          this.stats.byLevel[level].hits++;
        }
        break;
      case 'miss':
        this.stats.misses++;
        break;
      case 'set':
        this.stats.sets++;
        if (level) {
          this.stats.byLevel[level].sets++;
        }
        break;
      case 'delete':
        this.stats.deletes++;
        if (level) {
          this.stats.byLevel[level].deletes++;
        }
        break;
    }
    
    // Update prefix statistieken
    const prefix = this.getKeyPrefix(key);
    if (prefix) {
      let prefixStat = this.prefixStats.get(prefix);
      
      if (!prefixStat) {
        prefixStat = { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0 };
        this.prefixStats.set(prefix, prefixStat);
      }
      
      switch (action) {
        case 'hit':
          prefixStat.hits++;
          break;
        case 'miss':
          prefixStat.misses++;
          break;
        case 'set':
          prefixStat.sets++;
          prefixStat.size++;
          break;
        case 'delete':
          prefixStat.deletes++;
          prefixStat.size = Math.max(0, prefixStat.size - 1);
          break;
      }
    }
    
    // Update cache grootte
    this.updateCacheSize();
  }

  /**
   * Update cache grootte statistieken
   */
  private updateCacheSize(): void {
    // Update memory cache grootte
    this.stats.byLevel[CacheLevel.MEMORY].size = this.memoryCache.keys().length;
    
    // Update persistent cache grootte
    this.stats.byLevel[CacheLevel.PERSISTENT].size = this.persistentCache.size;
    
    // Update totale grootte
    this.stats.size = this.stats.byLevel[CacheLevel.MEMORY].size + this.stats.byLevel[CacheLevel.PERSISTENT].size;
    
    // Schat geheugengebruik (ruwe schatting)
    let memoryUsage = 0;
    
    // Memory cache
    for (const key of this.memoryCache.keys()) {
      const value = this.memoryCache.get<CacheEntry<any>>(key);
      if (value) {
        // Schat grootte van key + value (zeer ruwe schatting)
        memoryUsage += key.length * 2; // UTF-16 karakters
        memoryUsage += this.estimateObjectSize(value.value);
      }
    }
    
    // Persistent cache
    for (const [key, value] of this.persistentCache.entries()) {
      memoryUsage += key.length * 2; // UTF-16 karakters
      memoryUsage += value.length * 2; // UTF-16 karakters
    }
    
    this.stats.memoryUsage = memoryUsage;
  }

  /**
   * Schat de grootte van een object in bytes
   * @param obj Het object
   * @returns Geschatte grootte in bytes
   */
  private estimateObjectSize(obj: any): number {
    if (obj === null || obj === undefined) {
      return 0;
    }
    
    const type = typeof obj;
    
    // Primitieve types
    if (type === 'number') return 8;
    if (type === 'boolean') return 4;
    if (type === 'string') return obj.length * 2; // UTF-16 karakters
    
    // Arrays
    if (Array.isArray(obj)) {
      return obj.reduce((size, item) => size + this.estimateObjectSize(item), 0);
    }
    
    // Objecten
    if (type === 'object') {
      let size = 0;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          size += key.length * 2; // Key grootte
          size += this.estimateObjectSize(obj[key]); // Value grootte
        }
      }
      return size;
    }
    
    // Fallback
    return 8;
  }

  /**
   * Haal het prefix van een key op
   * @param key Cache key
   * @returns Key prefix of undefined
   */
  private getKeyPrefix(key: string): string | undefined {
    const parts = key.split(':');
    return parts.length > 1 ? parts[0] : undefined;
  }

  /**
   * Haal de persistent key op voor een cache key
   * @param key Cache key
   * @returns Persistent key
   */
  private getPersistentKey(key: string): string {
    return `cache:${key}`;
  }

  /**
   * Haal de originele key op uit een persistent key
   * @param persistentKey Persistent key
   * @returns Originele key
   */
  private getOriginalKey(persistentKey: string): string {
    return persistentKey.replace(/^cache:/, '');
  }

  /**
   * Laad persistent cache uit localStorage in browser omgeving
   */
  private loadPersistentCache(): void {
    try {
      // In browser omgeving
      if (typeof localStorage !== 'undefined') {
        // Haal alle cache keys op
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          
          if (key && key.startsWith('cache:')) {
            const value = localStorage.getItem(key);
            
            if (value) {
              this.persistentCache.set(key, value);
            }
          }
        }
        
        if (this.options.debug) {
          console.log(`Loaded ${this.persistentCache.size} items from persistent cache`);
        }
      }
    } catch (error) {
      console.error('Error loading persistent cache:', error);
    }
  }

  /**
   * Sla persistent cache op in localStorage in browser omgeving
   */
  private savePersistentCache(): void {
    try {
      // In browser omgeving
      if (typeof localStorage !== 'undefined') {
        // Sla alle cache entries op
        for (const [key, value] of this.persistentCache.entries()) {
          localStorage.setItem(key, value);
        }
        
        if (this.options.debug) {
          console.log(`Saved ${this.persistentCache.size} items to persistent cache`);
        }
      }
    } catch (error) {
      console.error('Error saving persistent cache:', error);
    }
  }
}

// Singleton instance
export const enhancedCache = new EnhancedCache({
  defaultTtl: 3600, // 1 uur
  checkPeriod: 600, // 10 minuten
  maxItems: 10000,
  debug: process.env.NODE_ENV === 'development'
});
