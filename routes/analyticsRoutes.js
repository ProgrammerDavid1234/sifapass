import express from "express";
import {
  getDashboardAnalytics,
  getTopPerformingEvents,
  getRecentActivity,
  getCredentialIssuanceTrend,
  getVerificationAnalytics,
  getDetailedMetrics,
  exportAnalyticsReport
} from "../controllers/analyticsController.js";

// Import your auth middleware
// import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AnalyticsSummary:
 *       type: object
 *       properties:
 *         totalCredentials:
 *           type: integer
 *           description: Total number of credentials issued in the period
 *         credentialGrowth:
 *           type: string
 *           description: Percentage growth compared to previous period
 *         engagementRate:
 *           type: string
 *           description: Percentage of credentials that were verified
 *         activeRecipients:
 *           type: integer
 *           description: Number of unique recipients
 *         verificationViews:
 *           type: integer
 *           description: Total number of verification views
 *         period:
 *           type: integer
 *           description: Analysis period in days
 */

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics summary
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Analysis period in days
 *     responses:
 *       200:
 *         description: Dashboard analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AnalyticsSummary'
 *       500:
 *         description: Server error
 */
router.get("/dashboard", getDashboardAnalytics);

/**
 * @swagger
 * /api/analytics/top-events:
 *   get:
 *     summary: Get top performing events
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of top events to return
 *     responses:
 *       200:
 *         description: Top performing events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       eventName:
 *                         type: string
 *                       credentialsIssued:
 *                         type: integer
 *                       verifications:
 *                         type: integer
 *                       engagementScore:
 *                         type: number
 */
router.get("/top-events", getTopPerformingEvents);

/**
 * @swagger
 * /api/analytics/recent-activity:
 *   get:
 *     summary: Get recent credential activity
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of recent activities to return
 *     responses:
 *       200:
 *         description: Recent activity list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       action:
 *                         type: string
 *                       actor:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       details:
 *                         type: object
 */
router.get("/recent-activity", getRecentActivity);

/**
 * @swagger
 * /api/analytics/issuance-trend:
 *   get:
 *     summary: Get credential issuance trend over time
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Analysis period in days
 *     responses:
 *       200:
 *         description: Credential issuance trend data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 */
router.get("/issuance-trend", getCredentialIssuanceTrend);

/**
 * @swagger
 * /api/analytics/verification:
 *   get:
 *     summary: Get verification analytics
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Analysis period in days
 *     responses:
 *       200:
 *         description: Verification analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hourlyPattern:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: integer
 *                           count:
 *                             type: integer
 *                     methods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 */
router.get("/verification", getVerificationAnalytics);

/**
 * @swagger
 * /api/analytics/detailed-metrics:
 *   get:
 *     summary: Get detailed metrics breakdown
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Analysis period in days
 *     responses:
 *       200:
 *         description: Detailed metrics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     credentialTypes:
 *                       type: array
 *                     deliveryMethods:
 *                       type: array
 *                     verificationStatus:
 *                       type: object
 *                       properties:
 *                         verified:
 *                           type: integer
 *                         unverified:
 *                           type: integer
 */
router.get("/detailed-metrics", getDetailedMetrics);

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export analytics report
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Analysis period in days
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *     responses:
 *       200:
 *         description: Analytics report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get("/export", exportAnalyticsReport);

export default router;