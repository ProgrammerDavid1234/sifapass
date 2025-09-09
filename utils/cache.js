// utils/cache.js
import NodeCache from "node-cache";

// Create cache instances
export const quickCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every minute
  useClones: false // Better performance, but be careful with object mutations
});

export const statsCache = new NodeCache({ 
  stdTTL: 600, // 10 minutes default
  checkperiod: 120,
  useClones: false
});

export const activityCache = new NodeCache({ 
  stdTTL: 180, // 3 minutes default
  checkperiod: 60,
  useClones: false
});

/**
 * Clear a specific cache key
 * @param {string} key - The cache key to clear
 * @param {NodeCache} cache - Optional specific cache instance
 */
export const clearCache = (key, cache = null) => {
  if (cache) {
    return cache.del(key);
  }
  
  // Try to delete from all caches if no specific cache provided
  const deleted = [];
  if (quickCache.del(key)) deleted.push('quick');
  if (statsCache.del(key)) deleted.push('stats');
  if (activityCache.del(key)) deleted.push('activity');
  
  return deleted.length > 0 ? deleted : false;
};

/**
 * Clear cache keys matching a pattern
 * @param {string} pattern - Pattern to match (supports wildcards with *)
 * @param {NodeCache} cache - Optional specific cache instance
 */
export const clearCachePattern = (pattern, cache = null) => {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  const caches = cache ? [cache] : [quickCache, statsCache, activityCache];
  
  let totalDeleted = 0;
  
  caches.forEach(cacheInstance => {
    const keys = cacheInstance.keys();
    const keysToDelete = keys.filter(key => regex.test(key));
    keysToDelete.forEach(key => {
      if (cacheInstance.del(key)) {
        totalDeleted++;
      }
    });
  });
  
  return totalDeleted;
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    quick: {
      keys: quickCache.keys().length,
      hits: quickCache.getStats().hits,
      misses: quickCache.getStats().misses,
      ksize: quickCache.getStats().ksize,
      vsize: quickCache.getStats().vsize
    },
    stats: {
      keys: statsCache.keys().length,
      hits: statsCache.getStats().hits,
      misses: statsCache.getStats().misses,
      ksize: statsCache.getStats().ksize,
      vsize: statsCache.getStats().vsize
    },
    activity: {
      keys: activityCache.keys().length,
      hits: activityCache.getStats().hits,
      misses: activityCache.getStats().misses,
      ksize: activityCache.getStats().ksize,
      vsize: activityCache.getStats().vsize
    }
  };
};

/**
 * Flush all caches
 */
export const flushAllCaches = () => {
  quickCache.flushAll();
  statsCache.flushAll();
  activityCache.flushAll();
  return true;
};

/**
 * Cache wrapper function with automatic key generation
 * @param {Function} fn - Function to cache
 * @param {string} keyPrefix - Prefix for the cache key
 * @param {number} ttl - Time to live in seconds
 * @param {NodeCache} cache - Cache instance to use
 */
export const withCache = (fn, keyPrefix, ttl = 300, cache = quickCache) => {
  return async (...args) => {
    // Generate cache key from function arguments
    const keyParts = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    });
    const cacheKey = `${keyPrefix}:${keyParts.join(':')}`;
    
    // Try to get from cache
    let result = cache.get(cacheKey);
    if (result !== undefined) {
      return { ...result, cached: true };
    }
    
    // Execute function and cache result
    result = await fn(...args);
    cache.set(cacheKey, result, ttl);
    
    return { ...result, cached: false };
  };
};

/**
 * Intelligent cache warming - preload frequently accessed data
 */
export const warmCache = async () => {
  try {
    console.log('Starting cache warming...');
    
    // Import controllers to warm their caches
    const { getMetrics, getDetailedStats } = await import('../controllers/dashboardController.js');
    
    // Mock request/response objects
    const mockReq = { query: {} };
    const mockRes = { json: (data) => data };
    
    // Warm basic metrics
    await getMetrics(mockReq, mockRes);
    
    // Warm common stats queries
    const timeRanges = ['7days', '30days'];
    for (const timeRange of timeRanges) {
      await getDetailedStats({ ...mockReq, query: { timeRange } }, mockRes);
    }
    
    console.log('Cache warming completed');
  } catch (error) {
    console.error('Cache warming failed:', error);
  }
};

/**
 * Cache maintenance - remove expired keys and optimize memory
 */
export const maintainCache = () => {
  const stats = getCacheStats();
  const totalKeys = stats.quick.keys + stats.stats.keys + stats.activity.keys;
  
  console.log(`Cache maintenance: ${totalKeys} total keys`);
  
  // If we have too many keys, clear some older ones
  if (totalKeys > 1000) {
    console.log('Cache size limit exceeded, clearing old entries...');
    
    // Clear pattern-based keys that might be accumulating
    clearCachePattern('recent-activity-*');
    clearCachePattern('detailed-stats-*');
    
    console.log('Cache cleanup completed');
  }
  
  return stats;
};

// Schedule periodic cache maintenance
setInterval(maintainCache, 10 * 60 * 1000); // Every 10 minutes

// Warm cache on startup (with delay to allow app to fully initialize)
setTimeout(warmCache, 5000);

export default {
  quickCache,
  statsCache,
  activityCache,
  clearCache,
  clearCachePattern,
  getCacheStats,
  flushAllCaches,
  withCache,
  warmCache,
  maintainCache
};