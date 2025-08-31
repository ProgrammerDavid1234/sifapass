import express from "express";
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerViaEvent,
  shareEvent,
  getAdminEvents,
} from "../controllers/eventController.js";
import { authenticate } from "../middleware/auth.js";
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin-only event management endpoints
 *   - name: Participants
 *     description: Participant endpoints for viewing events
 */

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - date
 *               - location
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *                 example: Annual Meetup
 *               description:
 *                 type: string
 *                 example: Company-wide meetup
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2025-09-01
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-09-01
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-09-03
 *               location:
 *                 type: string
 *                 example: Lagos, Nigeria
 *     responses:
 *       201:
 *         description: Event created successfully
 *       400:
 *         description: Bad request
 */
router.post("/", authenticate, createEvent);

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     tags: [Participants, Admin]
 *     responses:
 *       200:
 *         description: List of events
 *       500:
 *         description: Server error
 */
router.get("/", getAllEvents);
/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Update an existing event
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       404:
 *         description: Event not found
 */
router.put("/:id", authenticate, updateEvent);

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       404:
 *         description: Event not found
 */
router.delete("/:id", authenticate, deleteEvent);

/**
 * @swagger
 * /api/events/{eventId}/register:
 *   post:
 *     summary: Register participant via event link
 *     tags: [Admin, Participants]
 */
router.post("/:eventId/register", authenticate, registerViaEvent);

/**
 * @swagger
 * /api/events/{eventId}/share:
 *   post:
 *     summary: Share event with participants
 *     tags: [Admin, Participants]
 */
router.post("/:eventId/share", authenticate, shareEvent);

/**
 * @swagger
 * /api/events/my-events:
 *   get:
 *     summary: Get all events created by the authenticated admin
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of events created by the admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "64f1b0f5c9d3a4a9f7b6c123"
 *                       title:
 *                         type: string
 *                         example: "Tech Innovation Summit 2024"
 *                       description:
 *                         type: string
 *                         example: "Company-wide tech meetup"
 *                       date:
 *                         type: string
 *                         example: "2025-09-01"
 *                       location:
 *                         type: string
 *                         example: "Lagos, Nigeria"
 *                       createdBy:
 *                         type: string
 *                         example: "64f0ff0a9c3d8a1234567890"
 *       401:
 *         description: Unauthorized – user not authenticated
 *       500:
 *         description: Server error
 */
router.get("/my-events", authenticate, getAdminEvents);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event details
 *       404:
 *         description: Event not found
 */
router.get("/:id", getEventById);


export default router;
