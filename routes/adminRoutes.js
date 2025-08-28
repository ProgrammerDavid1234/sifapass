import express from "express";
import { registerAdmin, loginAdmin, getMetrics, downloadReport } from "../controllers/adminController.js";

const router = express.Router();
import * as activityLogCtrl from "../controllers/activityLogController.js";
import * as teamMemberCtrl from "../controllers/teamMemberController.js";
import * as adminSettingsCtrl from "../controllers/adminSettingsController.js";
import { authenticate } from "../middleware/auth.js";
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

/**
 * @swagger
 * /logs:
 *   get:
 *     summary: Get all activity logs
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of logs
 */
router.get("/logs", activityLogCtrl.getLogs);

/**
 * @swagger
 * /logs:
 *   post:
 *     summary: Add a new activity log
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *               actor:
 *                 type: string
 *     responses:
 *       201:
 *         description: Log created
 */
router.post("/logs", authenticate,activityLogCtrl.addLog);


/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Manage Admin
 */

/**
 * @swagger
 * /team:
 *   get:
 *     summary: Get all Admin
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of Admin
 */
router.get("/team", teamMemberCtrl.getMembers);

/**
 * @swagger
 * /team:
 *   post:
 *     summary: Add a team member
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Member created
 */
router.post("/team", authenticate,teamMemberCtrl.addMember);

/**
 * @swagger
 * /team/{id}:
 *   put:
 *     summary: Update a team member
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Member updated
 */
router.put("/team/:id", authenticate,teamMemberCtrl.updateMember);

/**
 * @swagger
 * /team/{id}:
 *   delete:
 *     summary: Delete a team member
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member deleted
 */
router.delete("/team/:id", authenticate,teamMemberCtrl.deleteMember);




/**
 * @swagger
 * /settings/{adminId}:
 *   get:
 *     summary: Get admin settings
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin settings retrieved
 */
router.get("/settings/:adminId", adminSettingsCtrl.getSettings);

/**
 * @swagger
 * /settings/{adminId}:
 *   put:
 *     summary: Update admin settings
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               uiPreferences:
 *                 type: object
 *               security:
 *                 type: object
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put("/settings/:adminId", authenticate,adminSettingsCtrl.updateSettings);

export default router;
