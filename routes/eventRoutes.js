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
  getEventsWithCredentialStats,
  getEventWithParticipants,
  getRegistrationLink,
} from "../controllers/eventController.js";
import { authenticate, authenticateAdminOrParticipant, authenticateUser } from "../middleware/auth.js";
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

// Add these JSDoc comments to your event routes file

/**
 * @swagger
 * /api/events/dashboard/credential-management:
 *   get:
 *     summary: Get events with credential statistics for dashboard
 *     description: Returns all events created by the authenticated admin with participant counts, credential statistics, and event status for the credential management dashboard
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Successfully retrieved events with credential statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 totalEvents:
 *                   type: integer
 *                   example: 3
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
 *                       eventCode:
 *                         type: string
 *                         example: "EVT-2024-001"
 *                       category:
 *                         type: string
 *                         enum: [Technology, Marketing, Business, Education, Healthcare, General]
 *                         example: "Technology"
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-04-15T09:00:00Z"
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-04-15T17:00:00Z"
 *                       location:
 *                         type: string
 *                         example: "Lagos Conference Center"
 *                       participantCount:
 *                         type: integer
 *                         example: 245
 *                       credentialsIssued:
 *                         type: integer
 *                         example: 189
 *                       status:
 *                         type: string
 *                         enum: [active, completed, upcoming]
 *                         example: "active"
 *                       registrationLink:
 *                         type: string
 *                         example: "https://sifapass.vercel.app/events/64f1b0f5c9d3a4a9f7b6c123/register"
 *                 groupedEvents:
 *                   type: object
 *                   properties:
 *                     active:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EventWithStats'
 *                     completed:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EventWithStats'
 *                     upcoming:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EventWithStats'
 *       401:
 *         description: Unauthorized - user not authenticated
 *       500:
 *         description: Server error
 */
router.get("/dashboard/credential-management", authenticate, getEventsWithCredentialStats);



/**
 * @swagger
 * /api/events/{eventId}/participants:
 *   get:
 *     summary: Get event participants with credential details
 *     description: Returns detailed participant list for a specific event with their credential information
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: The event ID
 *         example: "64f1b0f5c9d3a4a9f7b6c123"
 *     responses:
 *       200:
 *         description: Successfully retrieved event participants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 event:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "64f1b0f5c9d3a4a9f7b6c123"
 *                     title:
 *                       type: string
 *                       example: "Tech Innovation Summit 2024"
 *                     description:
 *                       type: string
 *                       example: "Annual technology conference"
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-04-15T09:00:00Z"
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-04-15T17:00:00Z"
 *                     location:
 *                       type: string
 *                       example: "Lagos Conference Center"
 *                     eventCode:
 *                       type: string
 *                       example: "EVT-2024-001"
 *                     registrationLink:
 *                       type: string
 *                       example: "https://sifapass.vercel.app/events/64f1b0f5c9d3a4a9f7b6c123/register"
 *                 participants:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "64f1b0f5c9d3a4a9f7b6c125"
 *                       fullName:
 *                         type: string
 *                         example: "John Doe"
 *                       email:
 *                         type: string
 *                         example: "john.doe@example.com"
 *                       registeredAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-04-01T10:30:00Z"
 *                       credentials:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                               example: "64f1b0f5c9d3a4a9f7b6c126"
 *                             status:
 *                               type: string
 *                               enum: [issued, pending, revoked]
 *                               example: "issued"
 *                             issuedAt:
 *                               type: string
 *                               format: date-time
 *                               example: "2024-04-16T14:00:00Z"
 *                             credentialType:
 *                               type: string
 *                               example: "certificate"
 *                       hasCredential:
 *                         type: boolean
 *                         example: true
 *                 credentialStats:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 245
 *                     issued:
 *                       type: integer
 *                       example: 189
 *                     pending:
 *                       type: integer
 *                       example: 56
 *       404:
 *         description: Event not found or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Event not found or unauthorized"
 *       401:
 *         description: Unauthorized - user not authenticated
 *       500:
 *         description: Server error
 */
router.get("/:eventId/participants", authenticateAdminOrParticipant, getEventWithParticipants);

/**
 * @swagger
 * /api/events/{eventId}/registration-link:
 *   get:
 *     summary: Get event registration link
 *     description: Returns the registration link and QR code for sharing the event
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: The event ID
 *         example: "64f1b0f5c9d3a4a9f7b6c123"
 *     responses:
 *       200:
 *         description: Successfully generated registration link
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 eventId:
 *                   type: string
 *                   example: "64f1b0f5c9d3a4a9f7b6c123"
 *                 eventTitle:
 *                   type: string
 *                   example: "Tech Innovation Summit 2024"
 *                 registrationLink:
 *                   type: string
 *                   example: "https://sifapass.vercel.app/events/64f1b0f5c9d3a4a9f7b6c123/register"
 *                 qrCode:
 *                   type: string
 *                   example: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A//sifapass.vercel.app/events/64f1b0f5c9d3a4a9f7b6c123/register"
 *             examples:
 *               success:
 *                 summary: Successful response
 *                 value:
 *                   success: true
 *                   eventId: "64f1b0f5c9d3a4a9f7b6c123"
 *                   eventTitle: "Tech Innovation Summit 2024"
 *                   registrationLink: "https://sifapass.vercel.app/events/64f1b0f5c9d3a4a9f7b6c123/register"
 *                   qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A//sifapass.vercel.app/events/64f1b0f5c9d3a4a9f7b6c123/register"
 *       404:
 *         description: Event not found or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Event not found or unauthorized"
 *       401:
 *         description: Unauthorized - user not authenticated
 *       500:
 *         description: Server error
 */
router.get("/:eventId/registration-link", authenticate, getRegistrationLink);

/**
 * @swagger
 * components:
 *   schemas:
 *     EventWithStats:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1b0f5c9d3a4a9f7b6c123"
 *         title:
 *           type: string
 *           example: "Tech Innovation Summit 2024"
 *         eventCode:
 *           type: string
 *           example: "EVT-2024-001"
 *         category:
 *           type: string
 *           enum: [Technology, Marketing, Business, Education, Healthcare, General]
 *           example: "Technology"
 *         startDate:
 *           type: string
 *           format: date-time
 *           example: "2024-04-15T09:00:00Z"
 *         endDate:
 *           type: string
 *           format: date-time
 *           example: "2024-04-15T17:00:00Z"
 *         location:
 *           type: string
 *           example: "Lagos Conference Center"
 *         participantCount:
 *           type: integer
 *           example: 245
 *         credentialsIssued:
 *           type: integer
 *           example: 189
 *         status:
 *           type: string
 *           enum: [active, completed, upcoming]
 *           example: "active"
 *         registrationLink:
 *           type: string
 *           example: "https://sifapass.vercel.app/events/64f1b0f5c9d3a4a9f7b6c123/register"
 *     
 *     ParticipantWithCredentials:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1b0f5c9d3a4a9f7b6c125"
 *         fullName:
 *           type: string
 *           example: "John Doe"
 *         email:
 *           type: string
 *           example: "john.doe@example.com"
 *         registeredAt:
 *           type: string
 *           format: date-time
 *           example: "2024-04-01T10:30:00Z"
 *         credentials:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Credential'
 *         hasCredential:
 *           type: boolean
 *           example: true
 *     
 *     Credential:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1b0f5c9d3a4a9f7b6c126"
 *         status:
 *           type: string
 *           enum: [issued, pending, revoked]
 *           example: "issued"
 *         issuedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-04-16T14:00:00Z"
 *         credentialType:
 *           type: string
 *           example: "certificate"
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Add this to your event routes (not participant routes)
router.post("/:eventId/participants/:participantId", authenticate, async (req, res) => {
  const { eventId, participantId } = req.params;

  const event = await Event.findById(eventId);
  const participant = await Participant.findById(participantId);

  if (!event || !participant) {
    return res.status(404).json({ message: "Event or Participant not found" });
  }

  if (event.participants.includes(participantId)) {
    return res.status(400).json({ message: "Already registered" });
  }

  event.participants.push(participantId);
  await event.save();

  participant.events.push(eventId);
  await participant.save();

  res.json({ message: "Participant added to event", participant });
});
export default router;
