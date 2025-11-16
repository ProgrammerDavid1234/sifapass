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
import { authenticate, authenticateAdminOrParticipant } from "../middleware/auth.js";
import { trackEventUsage } from '../middleware/usageTracking.js';
import { checkEventLimit } from '../middleware/planAccess.js';
import Event from "../models/Event.js";
import Participant from "../models/Participant.js";

const router = express.Router();

// ==================== EVENT CREATION (WITH PLAN LIMITS) ====================
router.post("/",
  authenticate,
  checkEventLimit,
  trackEventUsage,
  createEvent
);

// ==================== PUBLIC ROUTES ====================
router.get("/", getAllEvents);

// ==================== ADMIN STATIC ROUTES ====================
router.get("/my-events", authenticate, getAdminEvents);
router.get("/dashboard/credential-management", authenticate, getEventsWithCredentialStats);

// ==================== STATIC EVENT OPERATION ROUTES ====================
router.get("/:eventId/participants", authenticateAdminOrParticipant, getEventWithParticipants);
router.get("/:eventId/registration-link", authenticate, getRegistrationLink);
router.post("/:eventId/register", authenticate, registerViaEvent);
router.post("/:eventId/share", authenticate, shareEvent);

// ==================== LEGACY ROUTE ====================
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

// ==================== DYNAMIC ROUTES (ID-BASED) ====================
router.get("/:id", getEventById);
router.put("/:id", authenticate, updateEvent);
router.delete("/:id", authenticate, deleteEvent);

export default router;
