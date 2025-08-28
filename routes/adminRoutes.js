import express from "express";
import { registerAdmin, loginAdmin, getMetrics, downloadReport } from "../controllers/adminController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management endpoints
 */

/**
 * @swagger
 * /api/admin/register:
 *   post:
 *     summary: Register a new admin
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - organization
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               organization:
 *                 type: string
 *                 example: My Company
 *               email:
 *                 type: string
 *                 example: admin@company.com
 *               password:
 *                 type: string
 *                 example: MySecret123
 *     responses:
 *       201:
 *         description: Admin registered successfully
 *       400:
 *         description: Bad request
 */
router.post("/register", registerAdmin);

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@company.com
 *               password:
 *                 type: string
 *                 example: MySecret123
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post("/login", loginAdmin);

/**
 * @swagger
 * /api/admin/metrics:
 *   get:
 *     summary: Get admin metrics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Returns metrics data
 *       500:
 *         description: Server error
 */
router.get("/metrics", getMetrics);

/**
 * @swagger
 * /api/admin/reports/download:
 *   get:
 *     summary: Download report in CSV or JSON format
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Format of the report
 *     responses:
 *       200:
 *         description: File download or JSON data
 *       500:
 *         description: Server error
 */
router.get("/reports/download", downloadReport);

export default router;
