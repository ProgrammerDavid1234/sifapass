// middleware/performance.js
import { performance } from 'perf_hooks';

// Store performance metrics
const performanceMetrics = {
  requests: [],
  slowRequests: [],
  errorRequests: [],
  endpoints: new Map()
};

// Configuration
const SLOW_REQUEST_THRESHOLD = 1000; // 1 second
const MAX_STORED_REQUESTS = 1000;
const METRICS_RETENTION_TIME = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Performance monitoring middleware
 */
export const performanceMonitor = (req, res, next) => {
  const startTime = performance.now();
  const timestamp = new Date();
  
  // Capture request details
  const requestInfo = {
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp
  };

  // Override res.json to capture response
  const originalJson = res.json;
  let responseSize = 0;
  
  res.json = function(data) {
    responseSize = JSON.stringify(data).length;
    return originalJson.call(this, data);
  };

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metric = {
      ...requestInfo,
      duration: Math.round(duration),
      statusCode: res.statusCode,
      responseSize,
      memory: process.memoryUsage().heapUsed,
      cached: res.getHeader('X-Cache-Status') === 'HIT'
    };

    // Store the metric
    storeMetric(metric);
    
    // Add performance headers
    res.setHeader('X-Response-Time', `${Math.round(duration)}ms`);
    res.setHeader('X-Memory-Usage', `${Math.round(metric.memory / 1024 / 1024)}MB`);
    
    return originalEnd.apply(this, args);
  };

  next();
};

/**
 * Store performance metric
 */
const storeMetric = (metric) => {
  // Add to general requests array
  performanceMetrics.requests.push(metric);
  
  // Track slow requests
  if (metric.duration > SLOW_REQUEST_THRESHOLD) {
    performanceMetrics.slowRequests.push(metric);
    console.warn(`Slow request detected: ${metric.method} ${metric.path} - ${metric.duration}ms`);
  }
  
  // Track error requests
  if (metric.statusCode >= 400) {
    performanceMetrics.errorRequests.push(metric);
  }
  
  // Track by endpoint
  const endpointKey = `${metric.method} ${metric.path}`;
  if (!performanceMetrics.endpoints.has(endpointKey)) {
    performanceMetrics.endpoints.set(endpointKey, {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errorCount: 0,
      slowCount: 0
    });
  }
  
  const endpointStats = performanceMetrics.endpoints.get(endpointKey);
  endpointStats.count++;
  endpointStats.totalDuration += metric.duration;
  endpointStats.avgDuration = Math.round(endpointStats.totalDuration / endpointStats.count);
  endpointStats.minDuration = Math.min(endpointStats.minDuration, metric.duration);
  endpointStats.maxDuration = Math.max(endpointStats.maxDuration, metric.duration);
  
  if (metric.statusCode >= 400) {
    endpointStats.errorCount++;
  }
  
  if (metric.duration > SLOW_REQUEST_THRESHOLD) {
    endpointStats.slowCount++;
  }
  
  // Cleanup old metrics
  cleanup();
};

/**
 * Cleanup old metrics to prevent memory leaks
 */
const cleanup = () => {
  const cutoffTime = new Date(Date.now() - METRICS_RETENTION_TIME);
  
  performanceMetrics.requests = performanceMetrics.requests
    .filter(metric => metric.timestamp > cutoffTime)
    .slice(-MAX_STORED_REQUESTS);
    
  performanceMetrics.slowRequests = performanceMetrics.slowRequests
    .filter(metric => metric.timestamp > cutoffTime)
    .slice(-MAX_STORED_REQUESTS);
    
  performanceMetrics.errorRequests = performanceMetrics.errorRequests
    .filter(metric => metric.timestamp > cutoffTime)
    .slice(-MAX_STORED_REQUESTS);
};

/**
 * Get performance statistics
 */
export const getPerformanceStats = () => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  const recentRequests = performanceMetrics.requests.filter(
    metric => metric.timestamp.getTime() > oneHourAgo
  );
  
  const dailyRequests = performanceMetrics.requests.filter(
    metric => metric.timestamp.getTime() > oneDayAgo
  );
  
  // Calculate averages
  const avgResponseTime = recentRequests.length > 0 
    ? Math.round(recentRequests.reduce((sum, metric) => sum + metric.duration, 0) / recentRequests.length)
    : 0;
    
  const dailyAvgResponseTime = dailyRequests.length > 0
    ? Math.round(dailyRequests.reduce((sum, metric) => sum + metric.duration, 0) / dailyRequests.length)
    : 0;

  // Error rates
  const recentErrors = recentRequests.filter(metric => metric.statusCode >= 400);
  const errorRate = recentRequests.length > 0 
    ? (recentErrors.length / recentRequests.length) * 100 
    : 0;

  // Slow request rate
  const recentSlowRequests = recentRequests.filter(metric => metric.duration > SLOW_REQUEST_THRESHOLD);
  const slowRequestRate = recentRequests.length > 0 
    ? (recentSlowRequests.length / recentRequests.length) * 100 
    : 0;

  // Top slow endpoints
  const endpointStats = Array.from(performanceMetrics.endpoints.entries())
    .map(([endpoint, stats]) => ({ endpoint, ...stats }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10);

  return {
    summary: {
      totalRequests: performanceMetrics.requests.length,
      recentRequests: recentRequests.length,
      avgResponseTime,
      dailyAvgResponseTime,
      errorRate: parseFloat(errorRate.toFixed(2)),
      slowRequestRate: parseFloat(slowRequestRate.toFixed(2)),
      slowRequestThreshold: SLOW_REQUEST_THRESHOLD
    },
    slowestEndpoints: endpointStats,
    recentSlowRequests: performanceMetrics.slowRequests.slice(-10),
    recentErrors: performanceMetrics.errorRequests.slice(-10),
    timeRange: {
      from: new Date(oneHourAgo),
      to: new Date(now)
    }
  };
};

/**
 * Performance report generator
 */
export const generatePerformanceReport = () => {
  const stats = getPerformanceStats();
  
  console.log('\n========== PERFORMANCE REPORT ==========');
  console.log(`Total Requests: ${stats.summary.totalRequests}`);
  console.log(`Recent Requests (1h): ${stats.summary.recentRequests}`);
  console.log(`Avg Response Time: ${stats.summary.avgResponseTime}ms`);
  console.log(`Daily Avg Response Time: ${stats.summary.dailyAvgResponseTime}ms`);
  console.log(`Error Rate: ${stats.summary.errorRate}%`);
  console.log(`Slow Request Rate: ${stats.summary.slowRequestRate}%`);
  
  if (stats.slowestEndpoints.length > 0) {
    console.log('\nSlowest Endpoints:');
    stats.slowestEndpoints.slice(0, 5).forEach((endpoint, index) => {
      console.log(`${index + 1}. ${endpoint.endpoint} - ${endpoint.avgDuration}ms avg (${endpoint.count} requests)`);
    });
  }
  
  if (stats.recentSlowRequests.length > 0) {
    console.log('\nRecent Slow Requests:');
    stats.recentSlowRequests.slice(0, 3).forEach(request => {
      console.log(`- ${request.method} ${request.path} - ${request.duration}ms`);
    });
  }
  
  console.log('=======================================\n');
  
  return stats;
};

/**
 * Performance alert system
 */