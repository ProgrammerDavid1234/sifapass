import express from "express";
import { getMetrics } from "../controllers/dashboardController.js";

const router = express.Router();

/**
 * @swagger
 * /api/dashboard/metrics:
 *   get:
 *     summary: Get dashboard metrics
 *     tags: [Admin]
 */
router.get("/metrics", getMetrics);

export default router;
