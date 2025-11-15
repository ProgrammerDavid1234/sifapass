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
import { authenticate } from "../middleware/auth.js";
import { requirePlan, requireFeature } from '../middleware/planAccess.js';

const router = express.Router();

// ==================== BASIC ANALYTICS (ALL PLANS) ====================
/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics summary (all plans)
 *     tags: [Analytics]
 */
router.get("/dashboard", 
  authenticate,
  getDashboardAnalytics
);

/**
 * @swagger
 * /api/analytics/recent-activity:
 *   get:
 *     summary: Get recent credential activity (all plans)
 *     tags: [Analytics]
 */
router.get("/recent-activity", 
  authenticate,
  getRecentActivity
);

/**
 * @swagger
 * /api/analytics/issuance-trend:
 *   get:
 *     summary: Get credential issuance trend (all plans)
 *     tags: [Analytics]
 */
router.get("/issuance-trend", 
  authenticate,
  getCredentialIssuanceTrend
);

// ==================== ADVANCED ANALYTICS (STANDARD+ ONLY) ====================
/**
 * @swagger
 * /api/analytics/top-events:
 *   get:
 *     summary: Get top performing events (Standard plan or higher)
 *     tags: [Analytics]
 */
router.get("/top-events", 
  authenticate,
  requirePlan('Standard'),  // ← Only Standard+ plans
  getTopPerformingEvents
);

/**
 * @swagger
 * /api/analytics/verification:
 *   get:
 *     summary: Get verification analytics (Standard plan or higher)
 *     tags: [Analytics]
 */
router.get("/verification", 
  authenticate,
  requirePlan('Standard'),  // ← Only Standard+ plans
  getVerificationAnalytics
);

/**
 * @swagger
 * /api/analytics/detailed-metrics:
 *   get:
 *     summary: Get detailed metrics breakdown (Standard plan or higher)
 *     tags: [Analytics]
 */
router.get("/detailed-metrics", 
  authenticate,
  requirePlan('Standard'),  // ← Only Standard+ plans
  getDetailedMetrics
);

// ==================== DATA EXPORT (BASIC+ PLANS) ====================
/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export analytics report (Basic plan or higher)
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Export format (csv requires Basic+, excel requires Standard+)
 */
router.get("/export", 
  authenticate,
  requireFeature('exportData'),  // ← Only Basic+ plans
  exportAnalyticsReport
);

export default router;