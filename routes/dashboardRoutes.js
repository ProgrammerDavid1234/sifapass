import express from "express";
import { 
  getMetrics, 
  getDetailedStats, 
  getRecentActivity,
  getAnalytics,
  getSystemHealth,
  exportDashboardData
} from "../controllers/dashboardController.js";
import { authenticate } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for dashboard endpoints
const dashboardRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many dashboard requests",
    retryAfter: "1 minute"
  }
});

// Apply rate limiting to all dashboard routes
router.use(dashboardRateLimit);

/**
 * @swagger
 * /api/dashboard/metrics:
 *   get:
 *     summary: Get basic dashboard metrics with caching
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 participants:
 *                   type: integer
 *                   example: 1250
 *                 events:
 *                   type: integer
 *                   example: 45
 *                 credentials:
 *                   type: integer
 *                   example: 3420
 *                 plans:
 *                   type: integer
 *                   example: 12
 *                 cached:
 *                   type: boolean
 *                   example: false
 *                 timestamp:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.get("/metrics", authenticate, getMetrics);

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get detailed statistics with time-based filtering
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year]
 *           default: 30days
 *         description: Time range for statistics
 *       - in: query
 *         name: includeBreakdown
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed breakdown by type
 *     responses:
 *       200:
 *         description: Detailed statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 credentials:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     certificates:
 *                       type: integer
 *                     badges:
 *                       type: integer
 *                     shared:
 *                       type: integer
 *                     verified:
 *                       type: integer
 *                 events:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     completed:
 *                       type: integer
 *                 participants:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     withCredentials:
 *                       type: integer
 *                 timeRange:
 *                   type: string
 *                 cached:
 *                   type: boolean
 */
router.get("/stats", authenticate, getDetailedStats);

/**
 * @swagger
 * /api/dashboard/activity:
 *   get:
 *     summary: Get recent activity feed with pagination
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of activities to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of activities to skip
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *         description: Comma-separated list of activity types (credential_created, credential_shared, credential_verified, event_created)
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Only return activities since this timestamp
 *     responses:
 *       200:
 *         description: Recent activities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       description:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       actor:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
router.get("/activity", authenticate, getRecentActivity);

/**
 * @swagger
 * /api/dashboard/analytics:
 *   get:
 *     summary: Get advanced analytics and trends
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year]
 *           default: 30days
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: How to group the analytics data
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *         description: Comma-separated list of metrics (credentials, verifications, shares, events)
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timeSeries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       credentials:
 *                         type: integer
 *                       verifications:
 *                         type: integer
 *                       shares:
 *                         type: integer
 *                       events:
 *                         type: integer
 *                 trends:
 *                   type: object
 *                   properties:
 *                     credentials:
 *                       type: object
 *                       properties:
 *                         change:
 *                           type: number
 *                         trend:
 *                           type: string
 *                           enum: [up, down, stable]
 *                 topPerformers:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                     templates:
 *                       type: array
 */
router.get("/analytics", authenticate, getAnalytics);

/**
 * @swagger
 * /api/dashboard/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, warning, critical]
 *                 uptime:
 *                   type: number
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                     total:
 *                       type: number
 *                     percentage:
 *                       type: number
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     responseTime:
 *                       type: number
 *                 cache:
 *                   type: object
 *                   properties:
 *                     hitRate:
 *                       type: number
 *                     size:
 *                       type: number
 *                 errors:
 *                   type: object
 *                   properties:
 *                     last24h:
 *                       type: integer
 *                     errorRate:
 *                       type: number
 */
router.get("/health", authenticate, getSystemHealth);

/**
 * @swagger
 * /api/dashboard/export:
 *   post:
 *     summary: Export dashboard data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [json, csv, xlsx]
 *                 default: json
 *               timeRange:
 *                 type: string
 *                 enum: [7days, 30days, 90days, 1year]
 *                 default: 30days
 *               sections:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [metrics, stats, activity, analytics]
 *                 description: Which sections to include in export
 *               includeDetails:
 *                 type: boolean
 *                 default: false
 *                 description: Include detailed breakdowns
 *     responses:
 *       200:
 *         description: Export completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 downloadUrl:
 *                   type: string
 *                 filename:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       202:
 *         description: Export queued for processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 message:
 *                   type: string
 *                 estimatedTime:
 *                   type: integer
 */
router.post("/export", authenticate, exportDashboardData);

/**
 * @swagger
 * /api/dashboard/refresh:
 *   post:
 *     summary: Force refresh of cached dashboard data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sections:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [metrics, stats, activity, analytics]
 *                 description: Which sections to refresh (default: all)
 *     responses:
 *       200:
 *         description: Cache refreshed successfully
 */
router.post("/refresh", authenticate, async (req, res) => {
  try {
    const { sections = ['metrics', 'stats', 'activity', 'analytics'] } = req.body;
    
    // Import cache utility
    const { clearCache, clearCachePattern } = await import("../utils/cache.js");
    
    const clearedSections = [];
    
    for (const section of sections) {
      switch (section) {
        case 'metrics':
          clearCache('dashboard-metrics');
          clearedSections.push('metrics');
          break;
        case 'stats':
          clearCachePattern('detailed-stats-*');
          clearedSections.push('stats');
          break;
        case 'activity':
          clearCachePattern('recent-activity-*');
          clearedSections.push('activity');
          break;
        case 'analytics':
          clearCachePattern('analytics-*');
          clearedSections.push('analytics');
          break;
        default:
          console.warn(`Unknown section: ${section}`);
      }
    }

    res.json({
      success: true,
      message: `Cache cleared for sections: ${clearedSections.join(', ')}`,
      clearedSections,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Cache refresh error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh cache",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Get dashboard summary for quick overview
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary retrieved successfully
 */
router.get("/summary", authenticate, async (req, res) => {
  try {
    // This endpoint combines multiple data sources for a quick overview
    const [metrics, recentStats, systemHealth] = await Promise.allSettled([
      getMetrics(req, { json: (data) => data }), // Mock response object
      getDetailedStats({ ...req, query: { timeRange: '7days' } }, { json: (data) => data }),
      getSystemHealth(req, { json: (data) => data })
    ]);

    const summary = {
      quickMetrics: metrics.status === 'fulfilled' ? metrics.value : null,
      weeklyTrends: recentStats.status === 'fulfilled' ? recentStats.value : null,
      systemStatus: systemHealth.status === 'fulfilled' ? systemHealth.value?.status : 'unknown',
      lastUpdated: new Date(),
      errors: []
    };

    // Track any failures
    if (metrics.status === 'rejected') {
      summary.errors.push({ section: 'metrics', error: 'Failed to load' });
    }
    if (recentStats.status === 'rejected') {
      summary.errors.push({ section: 'stats', error: 'Failed to load' });
    }
    if (systemHealth.status === 'rejected') {
      summary.errors.push({ section: 'health', error: 'Failed to load' });
    }

    res.json(summary);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      error: 'Failed to load dashboard summary',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export default router;