import express from "express";
import {
  registerOrganization,
  loginOrganization,
  getMetrics,
  downloadReport,
} from "../controllers/organizationController.js";
import * as activityLogCtrl from "../controllers/activityLogController.js";
import * as teamMemberCtrl from "../controllers/teamMemberController.js";
import * as adminSettingsCtrl from "../controllers/adminSettingsController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin organization management
 *   - name: Organization
 *     description: Organization-wide operations
 *   - name: TeamMember
 *     description: Manage team members within an organization
 */

/**
 * @swagger
 * /api/organization/register:
 *   post:
 *     summary: Register a new organization admin
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, organization, email, password]
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
 */
router.post("/register", registerOrganization);

/**
 * @swagger
 * /api/organization/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post("/login", loginOrganization);

/**
 * @swagger
 * /api/organization/metrics:
 *   get:
 *     summary: Get organization metrics
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns metrics data
 */
router.get("/metrics", authenticate, getMetrics);

/**
 * @swagger
 * /api/organization/reports/download:
 *   get:
 *     summary: Download report in CSV or JSON format
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *     responses:
 *       200:
 *         description: File download
 */
router.get("/reports/download", authenticate, downloadReport);

/**
 * @swagger
 * /api/organization/logs:
 *   get:
 *     summary: Get all activity logs
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of logs
 */
router.get("/logs", authenticate, activityLogCtrl.getLogs);

/**
 * @swagger
 * /api/organization/logs:
 *   post:
 *     summary: Add a new activity log
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 */
router.post("/logs", authenticate, activityLogCtrl.addLog);

/**
 * @swagger
 * /api/organization/team:
 *   get:
 *     summary: Get all team members
 *     tags: [TeamMember]
 *     security:
 *       - bearerAuth: []
 */
router.get("/team", authenticate, teamMemberCtrl.getMembers);

/**
 * @swagger
 * /api/organization/team:
 *   post:
 *     summary: Add a team member
 *     tags: [TeamMember]
 *     security:
 *       - bearerAuth: []
 */
router.post("/team", authenticate, teamMemberCtrl.addMember);

/**
 * @swagger
 * /api/organization/team/{id}:
 *   put:
 *     summary: Update a team member
 *     tags: [TeamMember]
 *     security:
 *       - bearerAuth: []
 */
router.put("/team/:id", authenticate, teamMemberCtrl.updateMember);

/**
 * @swagger
 * /api/organization/team/{id}:
 *   delete:
 *     summary: Delete a team member
 *     tags: [TeamMember]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/team/:id", authenticate, teamMemberCtrl.deleteMember);

/**
 * @swagger
 * /api/organization/settings/{adminId}:
 *   get:
 *     summary: Get admin settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get("/settings/:adminId", authenticate, adminSettingsCtrl.getSettings);

/**
 * @swagger
 * /api/organization/settings/{adminId}:
 *   put:
 *     summary: Update admin settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.put("/settings/:adminId", authenticate, adminSettingsCtrl.updateSettings);

export default router;
