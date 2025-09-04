import express from "express";
import bcrypt from "bcryptjs";
import Participant from "../models/Participant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// At the top of participant.js
import sendEmail from "../utils/sendEmail.js";
import Credential from "../models/Credentials.js";
import Event from "../models/Event.js";
import { exportParticipants } from "../controllers/participantController.js";
const router = express.Router();
import { authenticate } from "../middleware/auth.js";
/**
 * @swagger
 * /api/participants/register:
 *   post:
 *     summary: Register a new participant
 *     tags: [Participants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: David John
 *               email:
 *                 type: string
 *                 example: participant@example.com
 *               password:
 *                 type: string
 *                 example: 12345678
 *               confirmPassword:
 *                 type: string
 *                 example: 12345678
 *     responses:
 *       201:
 *         description: Participant registered successfully
 *       400:
 *         description: Validation error
 */
router.post("/register", async (req, res) => {
    try {
        const { fullName, email, password, confirmPassword } = req.body;

        if (!fullName || !email || !password || !confirmPassword)
            return res.status(400).json({ message: "All fields are required" });

        if (password !== confirmPassword)
            return res.status(400).json({ message: "Passwords do not match" });

        const existingUser = await Participant.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newParticipant = new Participant({
            fullName,
            email,
            password: hashedPassword,
        });

        await newParticipant.save();

        res.status(201).json({
            message: "Participant registered successfully",
            participant: {
                id: newParticipant._id,
                fullName: newParticipant.fullName,
                email: newParticipant.email,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @swagger
 * /api/participants/login:
 *   post:
 *     summary: Login a participant
 *     tags: [Participants]
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
 *                 example: participant@example.com
 *               password:
 *                 type: string
 *                 example: 12345678
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: "Email and password are required" });

        const participant = await Participant.findOne({ email });
        if (!participant) return res.status(400).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, participant.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: participant._id, email: participant.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            participant: {
                id: participant._id,
                fullName: participant.fullName,
                email: participant.email,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @swagger
 * /api/participants/reset-password-request:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Participants]
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
 *                 example: participant@example.com
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       400:
 *         description: Email not found
 */
router.post("/reset-password-request", async (req, res) => {
    const { email } = req.body;
    const participant = await Participant.findOne({ email });
    if (!participant) return res.status(400).json({ message: "Email not found" });

    const token = crypto.randomBytes(20).toString("hex");
    participant.resetToken = token;
    participant.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await participant.save();

    // Implement sendEmail function to send the email
    await sendEmail({
        to: email,
        subject: "Password Reset Request",
        html: `<p>Click the link to reset your password:</p>
           <a href="http://localhost:3000/reset-password/${token}">Reset Password</a>`,
    });

    res.json({ message: "Password reset email sent" });
});

/**
 * @swagger
 * /api/participants/reset-password/{token}:
 *   post:
 *     summary: Reset password using token
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post("/reset-password/:token", async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const participant = await Participant.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: Date.now() },
    });
    if (!participant) return res.status(400).json({ message: "Invalid or expired token" });

    participant.password = await bcrypt.hash(password, 10);
    participant.resetToken = undefined;
    participant.resetTokenExpiry = undefined;
    await participant.save();

    res.json({ message: "Password reset successful" });
});


/**
 * @swagger
 * /api/participants/search:
 *   get:
 *     summary: Search participants by name or email
 *     tags: [Participants]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query (name or email)
 *     responses:
 *       200:
 *         description: List of matching participants
 */
router.get("/search", async (req, res) => {
    try {
        const { q } = req.query;
        const participants = await Participant.find({
            $or: [
                { name: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
            ],
        });
        res.json(participants);
    } catch (err) {
        res.status(500).json({ error: "Failed to search participants" });
    }
});

/**
 * @swagger
 * /api/participants/{id}:
 *   get:
 *     summary: Get a participant by ID
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Participant ID
 *     responses:
 *       200:
 *         description: Participant data
 *       404:
 *         description: Not found
 */
router.get("/:id", async (req, res) => {
    try {
        const participant = await Participant.findById(req.params.id);
        if (!participant) return res.status(404).json({ error: "Not found" });
        res.json(participant);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch participant" });
    }
});

/**
 * @swagger
 * /api/participants/{id}:
 *   put:
 *     summary: Edit participant details
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Participant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Participant updated
 */
router.put("/:id", authenticate, async (req, res) => {
    try {
        const participant = await Participant.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(participant);
    } catch (err) {
        res.status(500).json({ error: "Failed to update participant" });
    }
});

/**
 * @swagger
 * /api/participants/export/all:
 *   get:
 *     summary: Export all participants (CSV/Excel)
 *     tags: [Participants]
 *     responses:
 *       200:
 *         description: Exported data
 */
router.get("/export/all", async (req, res) => {
    try {
        const participants = await Participant.find();
        // TODO: convert to CSV/Excel
        res.json({ message: "Export successful", data: participants });
    } catch (err) {
        res.status(500).json({ error: "Failed to export participants" });
    }
});

/**
 * @swagger
 * /api/participants/share:
 *   post:
 *     summary: Share event with participants
 *     tags: [Participants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventId:
 *                 type: string
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Event shared successfully
 */
router.post("/share", authenticate, async (req, res) => {
    try {
        const { eventId, participantIds } = req.body;
        await Participant.updateMany(
            { _id: { $in: participantIds } },
            { $addToSet: { events: eventId } }
        );
        res.json({ message: "Event shared successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to share event" });
    }
});

/**
 * @swagger
 * /api/participants/reconcile:
 *   put:
 *     summary: Reconcile participant data
 *     tags: [Participants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Participants reconciled successfully
 */
router.put("/reconcile", authenticate, async (req, res) => {
    try {
        const { participantIds } = req.body;
        await Participant.updateMany(
            { _id: { $in: participantIds } },
            { reconciled: true }
        );
        res.json({ message: "Participants reconciled successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to reconcile participants" });
    }
});
/**
 * @swagger
 * /api/participants/dashboard/{id}:
 *   get:
 *     summary: Get participant dashboard
 *     tags: [Participants]
 */
router.get("/participants/dashboard/:id", async (req, res) => {
    try {
        const participant = await Participant.findById(req.params.id)
            .populate("credentials")
            .populate("events");

        if (!participant) return res.status(404).json({ error: "Participant not found" });

        res.json({
            profile: {
                name: participant.name,
                email: participant.email,
                preferences: participant.preferences,
            },
            credentials: participant.credentials,
            events: participant.events,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/{id}/credentials:
 *   get:
 *     summary: Get participant credentials
 *     tags: [Participants]
 */
router.get("/participants/:id/credentials", async (req, res) => {
    try {
        const creds = await Credential.find({ participant: req.params.id });
        res.json(creds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/{id}/credentials/{credId}/download:
 *   get:
 *     summary: Download a credential
 *     tags: [Participants]
 */
router.get("/participants/:id/credentials/:credId/download", async (req, res) => {
    try {
        const cred = await Credential.findById(req.params.credId);
        if (!cred) return res.status(404).json({ error: "Credential not found" });

        res.setHeader("Content-Disposition", `attachment; filename=${cred.title}.pdf`);
        res.send("PDF file binary would go here");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/{id}/credentials/{credId}/share:
 *   post:
 *     summary: Share a credential
 *     tags: [Participants]
 */
router.post("/participants/:id/credentials/:credId/share", authenticate, async (req, res) => {
    try {
        const { email } = req.body;
        // TODO: Implement email sending
        res.json({ message: `Credential shared with ${email}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/{id}/settings:
 *   get:
 *     summary: Get participant settings
 *     tags: [Participants]
 *   put:
 *     summary: Update participant settings
 *     tags: [Participants]
 */
router.get("/participants/:id/settings", async (req, res) => {
    try {
        const participant = await Participant.findById(req.params.id);
        if (!participant) return res.status(404).json({ error: "Participant not found" });

        res.json(participant.settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/participants/:id/settings", authenticate, async (req, res) => {
    try {
        const updated = await Participant.findByIdAndUpdate(
            req.params.id,
            { settings: req.body },
            { new: true }
        );
        res.json(updated.settings);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/{id}/events:
 *   get:
 *     summary: Get participant events
 *     description: Retrieve all events a participant has registered for using their participant ID.
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The participant's unique ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of events the participant is registered for
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "64eafbc52171d2e546be8738"
 *                   name:
 *                     type: string
 *                     example: "Tech Conference 2025"
 *                   date:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-09-04T09:00:00.000Z"
 *                   location:
 *                     type: string
 *                     example: "Lagos, Nigeria"
 *                   description:
 *                     type: string
 *                     example: "A global tech conference focused on AI and Cloud Computing."
 *       404:
 *         description: Participant not found or no events available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No events found for this participant"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/:id/events", async (req, res) => {
    try {
        const events = await Event.find({ participants: req.params.id });
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/{id}/events/{eventId}:
 *   get:
 *     summary: Get event details
 *     tags: [Participants]
 */
router.get("/participants/:id/events/:eventId", async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/{id}/events/{eventId}/interact:
 *   post:
 *     summary: Interact with event
 *     tags: [Participants]
 */
router.post("/participants/:id/events/:eventId/interact", authenticate, async (req, res) => {
    try {
        const { action, comment } = req.body;
        // TODO: Save to DB
        res.json({ message: `Interaction recorded: ${action}`, comment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/participants/export/all:
 *   get:
 *     summary: Export all participants to CSV
 *     description: Retrieve all participants from the database and export them in CSV format.
 *     tags: [Participants]
 *     responses:
 *       200:
 *         description: CSV file successfully generated and downloaded.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Failed to export participants
 */
router.get("/export/all", exportParticipants);
/**
 * @swagger
 * /api/participants/{participantId}/events/{eventId}/register:
 *   post:
 *     summary: Register participant for an event
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: string
 *         description: Participant ID
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Successfully registered for event
 *       400:
 *         description: Already registered
 */
router.post("/:participantId/events/:eventId/register", authenticate, async (req, res) => {
    try {
        const { participantId, eventId } = req.params;

        const participant = await Participant.findById(participantId);
        const event = await Event.findById(eventId);

        if (!participant || !event) {
            return res.status(404).json({ message: "Participant or Event not found" });
        }

        // Check if already registered
        if (event.participants.includes(participantId)) {
            return res.status(400).json({ message: "Already registered for this event" });
        }

        // Add participant to event
        event.participants.push(participantId);
        await event.save();

        // Add event to participant
        participant.events.push(eventId);
        await participant.save();

        res.json({ message: "Successfully registered for event" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
