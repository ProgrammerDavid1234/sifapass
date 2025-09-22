import express from "express";
import {
  registerAdmin,
  loginAdmin,
  getMetrics,
  downloadReport,
  verifyEmail,
  resendVerificationEmail
} from "../controllers/adminController.js";

// Import the new settings controller functions
import {
  getSettings,
  updateProfile,
  updatePassword,
  updateSecuritySettings,
  updateNotificationSettings,
  updateSettings,
  deleteAccount
} from "../controllers/adminController.js";

import * as activityLogCtrl from "../controllers/activityLogController.js";
import * as teamMemberCtrl from "../controllers/teamMemberController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management endpoints
 */

// AUTHENTICATION ROUTES
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
 *                 example: securePassword123
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
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post("/login", loginAdmin);

/**
 * @swagger
 * /api/admin/verify-email:
 *   get:
 *     tags: [Admin]
 *     summary: Verify admin email
 *     description: Confirms an admin's email using a verification token.
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get("/verify-email", verifyEmail);

/**
 * @swagger
 * /api/admin/resend-verification:
 *   post:
 *     tags: [Admin]
 *     summary: Resend verification email
 *     description: Sends a new email verification link to the admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@company.com
 *     responses:
 *       200:
 *         description: Verification email resent successfully
 *       400:
 *         description: Failed to resend email
 */
router.post("/resend-verification", resendVerificationEmail);

// SETTINGS ROUTES

// ===============================
// Get Current Admin ID
// ===============================
/**
 * @swagger
 * /api/admin/settings/current-admin-id:
 *   get:
 *     summary: Get the currently authenticated admin's ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns the admin ID of the logged-in user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 adminId:
 *                   type: string
 *       401:
 *         description: Unauthorized, token missing or invalid
 */
router.get("/settings/current-admin-id", authenticate, (req, res) => {
  res.json({
    success: true,
    adminId: req.admin?._id || req.user?.id || req.user?._id,
  });
});

/**
 * @swagger
 * /api/admin/settings/{adminId}:
 *   get:
 *     summary: Get admin settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin ID
 *     responses:
 *       200:
 *         description: Admin settings retrieved successfully
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
 *                     profile:
 *                       type: object
 *                     security:
 *                       type: object
 *                     notifications:
 *                       type: object
 *                     account:
 *                       type: object
 *       404:
 *         description: Admin not found
 */
router.get("/settings/:adminId", authenticate, getSettings);

/**
 * @swagger
 * /api/admin/settings/{adminId}/profile:
 *   put:
 *     summary: Update admin profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *               fullName:
 *                 type: string
 *               organization:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 *               address:
 *                 type: string
 *               description:
 *                 type: string
 *               logo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Admin not found
 */
router.put("/settings/:adminId/profile", authenticate, updateProfile);

/**
 * @swagger
 * /api/admin/settings/{adminId}/password:
 *   put:
 *     summary: Change admin password
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid password or validation error
 *       404:
 *         description: Admin not found
 */
router.put("/settings/:adminId/password", authenticate, updatePassword);

/**
 * @swagger
 * /api/admin/settings/{adminId}/security:
 *   put:
 *     summary: Update security settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *               twoFactorEnabled:
 *                 type: boolean
 *               sessionTimeout:
 *                 type: number
 *                 minimum: 5
 *                 maximum: 480
 *     responses:
 *       200:
 *         description: Security settings updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Admin not found
 */
router.put("/settings/:adminId/security", authenticate, updateSecuritySettings);

/**
 * @swagger
 * /api/admin/settings/{adminId}/notifications:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *               weeklyReports:
 *                 type: boolean
 *               securityAlerts:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *       404:
 *         description: Admin not found
 */
router.put("/settings/:adminId/notifications", authenticate, updateNotificationSettings);

/**
 * @swagger
 * /api/admin/settings/{adminId}:
 *   put:
 *     summary: Update all admin settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *               profile:
 *                 type: object
 *                 properties:
 *                   fullName:
 *                     type: string
 *                   organization:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   website:
 *                     type: string
 *                   address:
 *                     type: string
 *                   description:
 *                     type: string
 *                   logo:
 *                     type: string
 *               security:
 *                 type: object
 *                 properties:
 *                   twoFactorEnabled:
 *                     type: boolean
 *                   sessionTimeout:
 *                     type: number
 *               notifications:
 *                 type: object
 *                 properties:
 *                   emailNotifications:
 *                     type: boolean
 *                   pushNotifications:
 *                     type: boolean
 *                   weeklyReports:
 *                     type: boolean
 *                   securityAlerts:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Admin not found
 */
router.put("/settings/:adminId", authenticate, updateSettings);

/**
 * @swagger
 * /api/admin/settings/{adminId}/delete-account:
 *   delete:
 *     summary: Delete admin account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *             required:
 *               - password
 *               - confirmDelete
 *             properties:
 *               password:
 *                 type: string
 *               confirmDelete:
 *                 type: string
 *                 example: DELETE
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       400:
 *         description: Invalid password or confirmation
 *       404:
 *         description: Admin not found
 */
router.delete("/settings/:adminId/delete-account", authenticate, deleteAccount);

// DASHBOARD AND ANALYTICS ROUTES
/**
 * @swagger
 * /api/admin/metrics:
 *   get:
 *     summary: Get admin dashboard metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns metrics data
 *       500:
 *         description: Server error
 */
router.get("/metrics", authenticate, getMetrics);

/**
 * @swagger
 * /api/admin/reports/download:
 *   get:
 *     summary: Download report in CSV or JSON format
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
router.get("/reports/download", authenticate, downloadReport);

// ACTIVITY LOG ROUTES
/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Get all activity logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *         description: Number of logs per page
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: List of activity logs
 */
router.get("/logs", authenticate, activityLogCtrl.getLogs);

/**
 * @swagger
 * /api/admin/logs:
 *   post:
 *     summary: Add a new activity log
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - actor
 *             properties:
 *               action:
 *                 type: string
 *                 example: "Updated profile settings"
 *               actor:
 *                 type: string
 *                 example: "admin@company.com"
 *               details:
 *                 type: object
 *                 description: Additional details about the action
 *               ipAddress:
 *                 type: string
 *                 example: "192.168.1.1"
 *     responses:
 *       201:
 *         description: Activity log created successfully
 */
router.post("/logs", authenticate, activityLogCtrl.addLog);

// TEAM MANAGEMENT ROUTES
/**
 * @swagger
 * /api/admin/team:
 *   get:
 *     summary: Get all team members
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, pending, suspended]
 *         description: Filter by member status
 *     responses:
 *       200:
 *         description: List of team members
 */
router.get("/team", authenticate, teamMemberCtrl.getMembers);

/**
 * @swagger
 * /api/admin/team:
 *   post:
 *     summary: Add/Invite a team member
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 example: "member@company.com"
 *               role:
 *                 type: string
 *                 enum: [admin, moderator, event_manager, coordinator]
 *                 example: "event_manager"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["create_events", "manage_participants"]
 *     responses:
 *       201:
 *         description: Team member invited successfully
 *       400:
 *         description: Invalid input data
 */
router.post("/team", authenticate, teamMemberCtrl.addMember);

/**
 * @swagger
 * /api/admin/team/{memberId}:
 *   put:
 *     summary: Update a team member
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
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
 *               role:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [active, suspended]
 *     responses:
 *       200:
 *         description: Team member updated successfully
 *       404:
 *         description: Team member not found
 */
router.put("/team/:memberId", authenticate, teamMemberCtrl.updateMember);

/**
 * @swagger
 * /api/admin/team/{memberId}:
 *   delete:
 *     summary: Remove a team member
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team member removed successfully
 *       404:
 *         description: Team member not found
 */
router.delete("/team/:memberId", authenticate, teamMemberCtrl.deleteMember);

export default router;