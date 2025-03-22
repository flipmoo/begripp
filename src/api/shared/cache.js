/**
 * Eenvoudige in-memory cache implementatie
 */

// Cache-opslag
const cacheStore = new Map();

// Cache configuratie
const defaultConfig = {
  ttl: 5 * 60 * 1000, // 5 minuten in milliseconden
  maxSize: 1000, // Maximum aantal cache entries
  enabled: true
};

let config = { ...defaultConfig };

// LRU-achtige functionaliteit door het bijhouden van access timestamps
const accessTimestamps = new Map();

// Cache operaties
export const cache = {
  // Configuratie
  setConfig: (newConfig) => {
    config = { ...config, ...newConfig };
    return config;
  },
  
  getConfig: () => {
    return { ...config };
  },
  
  // Cache operaties
  get: (key) => {
    if (!config.enabled) return null;
    
    const cacheEntry = cacheStore.get(key);
    
    if (!cacheEntry) return null;
    
    const { value, timestamp } = cacheEntry;
    const now = Date.now();
    
    // Check TTL
    if (now - timestamp > config.ttl) {
      cacheStore.delete(key);
      accessTimestamps.delete(key);
      return null;
    }
    
    // Update access timestamp voor LRU
    accessTimestamps.set(key, now);
    
    return value;
  },
  
  set: (key, value) => {
    if (!config.enabled) return;
    
    // Check cache grootte en evt. entries verwijderen
    if (cacheStore.size >= config.maxSize) {
      // Vind oudste entry (least recently used)
      const sortedEntries = [...accessTimestamps.entries()]
        .sort(([, timeA], [, timeB]) => timeA - timeB);
      
      if (sortedEntries.length > 0) {
        const oldestKey = sortedEntries[0][0];
        cacheStore.delete(oldestKey);
        accessTimestamps.delete(oldestKey);
      }
    }
    
    // Opslaan waarde met timestamp
    cacheStore.set(key, {
      value,
      timestamp: Date.now()
    });
    
    // Access timestamp bijwerken
    accessTimestamps.set(key, Date.now());
  },
  
  delete: (key) => {
    cacheStore.delete(key);
    accessTimestamps.delete(key);
  },
  
  clear: () => {
    cacheStore.clear();
    accessTimestamps.clear();
  },
  
  // Statistieken
  stats: () => {
    return {
      size: cacheStore.size,
      keys: [...cacheStore.keys()],
      config: { ...config }
    };
  }
};

// Express middleware voor caching van responses
export const cacheMiddleware = (keyGenerator, ttlOverride = null) => {
  return (req, res, next) => {
    if (!config.enabled) {
      return next();
    }
    
    // Genereer cache key op basis van request
    const cacheKey = keyGenerator ? 
      keyGenerator(req) : 
      `${req.method}:${req.originalUrl}`;
    
    // Check of we gecachte data hebben
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      // Zet cache header
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }
    
    // Cache miss - onderschep response
    const originalSend = res.send;
    res.send = function(body) {
      // Alleen succesvole responses cachen (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let data;
        try {
          data = JSON.parse(body);
          cache.set(cacheKey, data);
        } catch (e) {
          // Als het geen JSON is, niet cachen
        }
      }
      
      // Zet cache header
      res.setHeader('X-Cache', 'MISS');
      return originalSend.call(this, body);
    };
    
    next();
  };
}; 