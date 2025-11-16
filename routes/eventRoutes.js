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
import { trackEventUsage } from '../middleware/usageTracking.js';
import { checkEventLimit } from '../middleware/planAccess.js';

const router = express.Router();

// ==================== EVENT CREATION (WITH PLAN LIMITS) ====================
/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event (plan-limited)
 *     tags: [Admin]
 */
router.post("/",
  authenticate,
  checkEventLimit,      // ← Check if user can create more events based on plan
  trackEventUsage,      // ← Track the usage after check passes
  createEvent
);

// Duplicate route cleanup - remove the '/create' duplicate
// router.post('/create', authenticate, trackEventUsage, createEvent); // ← REMOVE THIS

// ==================== PUBLIC ROUTES ====================
/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     tags: [Participants, Admin]
 */
router.get("/", getAllEvents);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Participants]
 */
router.get("/:id", getEventById);
/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Update an existing event
 *     tags: [Admin]
 */
router.put("/:id", authenticate, updateEvent);

// ==================== ADMIN EVENT MANAGEMENT ====================
/**
 * @swagger
 * /api/events/my-events:
 *   get:
 *     summary: Get all events created by the authenticated admin
 *     tags: [Admin]
 */
router.get("/my-events", authenticate, getAdminEvents);


/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Admin]
 */
router.delete("/:id", authenticate, deleteEvent);

// ==================== EVENT INTERACTION ====================
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

// ==================== DASHBOARD & ANALYTICS ====================
/**
 * @swagger
 * /api/events/dashboard/credential-management:
 *   get:
 *     summary: Get events with credential statistics for dashboard
 *     tags: [Admin]
 */
router.get("/dashboard/credential-management", authenticate, getEventsWithCredentialStats);

/**
 * @swagger
 * /api/events/{eventId}/participants:
 *   get:
 *     summary: Get event participants with credential details
 *     tags: [Admin]
 */
router.get("/:eventId/participants", authenticateAdminOrParticipant, getEventWithParticipants);

/**
 * @swagger
 * /api/events/{eventId}/registration-link:
 *   get:
 *     summary: Get event registration link
 *     tags: [Admin]
 */
router.get("/:eventId/registration-link", authenticate, getRegistrationLink);

// ==================== LEGACY ROUTE (CLEANUP NEEDED) ====================
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