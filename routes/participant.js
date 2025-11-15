import express from "express";
import bcrypt from "bcryptjs";
import Participant from "../models/Participant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";
import Credential from "../models/Credentials.js";
import Event from "../models/Event.js";
import { exportParticipants } from "../controllers/participantController.js";
const router = express.Router();
import { authenticateUser } from "../middleware/auth.js";
import { downloadCredentialForParticipant } from "../controllers/credentialController.js";
import { checkParticipantLimit } from '../middleware/planAccess.js';
import { trackParticipantUsage } from '../middleware/usageTracking.js';
import { authenticate } from "../middleware/auth.js";

// ==================== PUBLIC ROUTES (NO AUTH) ====================
/**
 * @swagger
 * /api/participants/register:
 *   post:
 *     summary: Register a new participant
 *     tags: [Participants]
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

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const newParticipant = new Participant({
            fullName,
            firstName,
            lastName,
            email,
            password: hashedPassword,
            settings: {
                emailNotifications: true,
                pushNotifications: true,
                eventReminders: true,
                credentialUpdates: true,
                twoFactorEnabled: false
            },
            preferences: {}
        });

        await newParticipant.save();

        res.status(201).json({
            message: "Participant registered successfully",
            participant: {
                id: newParticipant._id,
                fullName: newParticipant.fullName,
                firstName: newParticipant.firstName,
                lastName: newParticipant.lastName,
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
                firstName: participant.firstName,
                lastName: participant.lastName,
                email: participant.email,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/reset-password-request", async (req, res) => {
    const { email } = req.body;
    const participant = await Participant.findOne({ email });
    if (!participant) return res.status(400).json({ message: "Email not found" });

    const token = crypto.randomBytes(20).toString("hex");
    participant.resetToken = token;
    participant.resetTokenExpiry = Date.now() + 3600000;
    await participant.save();

    await sendEmail({
        to: email,
        subject: "Password Reset Request",
        html: `<p>Click the link to reset your password:</p>
           <a href="http://localhost:3000/reset-password/${token}">Reset Password</a>`,
    });

    res.json({ message: "Password reset email sent" });
});

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

// ==================== ADMIN ROUTES - ADDING PARTICIPANTS (WITH PLAN LIMITS) ====================
/**
 * @swagger
 * /api/participants/{participantId}/events/{eventId}/register:
 *   post:
 *     summary: Register participant for an event (checks plan limits)
 *     tags: [Participants]
 */
router.post("/:participantId/events/:eventId/register", 
    authenticate,  // Admin authentication
    checkParticipantLimit,  // ← Check if under plan participant limit
    trackParticipantUsage,  // ← Track the usage
    async (req, res) => {
        try {
            const { participantId, eventId } = req.params;

            const participant = await Participant.findById(participantId);
            const event = await Event.findById(eventId);

            if (!participant || !event) {
                return res.status(404).json({ message: "Participant or Event not found" });
            }

            if (event.participants.includes(participantId)) {
                return res.status(400).json({ message: "Already registered for this event" });
            }

            event.participants.push(participantId);
            await event.save();

            participant.events.push(eventId);
            await participant.save();

            res.json({ message: "Successfully registered for event" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// ==================== SEARCH & VIEWING ====================
router.get("/search", async (req, res) => {
    try {
        const { q } = req.query;
        const participants = await Participant.find({
            $or: [
                { fullName: { $regex: q, $options: "i" } },
                { firstName: { $regex: q, $options: "i" } },
                { lastName: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
            ],
        }).select('-password');
        res.json(participants);
    } catch (err) {
        res.status(500).json({ error: "Failed to search participants" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const participant = await Participant.findById(req.params.id).select('-password');
        if (!participant) return res.status(404).json({ error: "Participant not found" });
        
        res.json({
            id: participant._id,
            firstName: participant.firstName || '',
            lastName: participant.lastName || '',
            fullName: participant.fullName || `${participant.firstName} ${participant.lastName}`.trim(),
            email: participant.email || '',
            phone: participant.phone || '',
            bio: participant.bio || '',
            profilePicture: participant.profilePicture || '',
            settings: participant.settings || {
                emailNotifications: true,
                pushNotifications: true,
                eventReminders: true,
                credentialUpdates: true,
                twoFactorEnabled: false
            },
            preferences: participant.preferences || {},
            events: participant.events || [],
            credentials: participant.credentials || [],
            createdAt: participant.createdAt,
            updatedAt: participant.updatedAt
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch participant" });
    }
});

// ==================== PARTICIPANT PROFILE MANAGEMENT ====================
router.put("/:id", authenticateUser, async (req, res) => {
    try {
        const { firstName, lastName, email, phone, bio, profilePicture } = req.body;
        
        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (bio !== undefined) updateData.bio = bio;
        if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
        
        if (firstName !== undefined || lastName !== undefined) {
            const participant = await Participant.findById(req.params.id);
            const newFirstName = firstName !== undefined ? firstName : participant.firstName;
            const newLastName = lastName !== undefined ? lastName : participant.lastName;
            updateData.fullName = `${newFirstName} ${newLastName}`.trim();
        }

        const participant = await Participant.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, select: '-password' }
        );

        if (!participant) {
            return res.status(404).json({ error: "Participant not found" });
        }

        res.json({
            message: "Profile updated successfully",
            participant: {
                id: participant._id,
                firstName: participant.firstName,
                lastName: participant.lastName,
                fullName: participant.fullName,
                email: participant.email,
                phone: participant.phone,
                bio: participant.bio,
                profilePicture: participant.profilePicture
            }
        });
    } catch (err) {
        if (err.code === 11000 && err.keyPattern?.email) {
            return res.status(400).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: "Failed to update participant" });
    }
});

router.put("/:id/change-password", authenticateUser, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current password and new password are required" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "New password must be at least 8 characters long" });
        }

        const participant = await Participant.findById(req.params.id);
        if (!participant) {
            return res.status(404).json({ message: "Participant not found" });
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, participant.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        participant.password = hashedNewPassword;
        await participant.save();

        res.json({ message: "Password changed successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to change password" });
    }
});

router.get("/:id/settings", authenticateUser, async (req, res) => {
    try {
        const participant = await Participant.findById(req.params.id).select('settings preferences');
        if (!participant) return res.status(404).json({ error: "Participant not found" });

        const defaultSettings = {
            emailNotifications: true,
            pushNotifications: true,
            eventReminders: true,
            credentialUpdates: true,
            twoFactorEnabled: false
        };

        res.json({
            ...defaultSettings,
            ...participant.settings,
            preferences: participant.preferences || {}
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/:id/settings", authenticateUser, async (req, res) => {
    try {
        const { 
            emailNotifications, 
            pushNotifications, 
            eventReminders, 
            credentialUpdates, 
            twoFactorEnabled,
            ...preferences 
        } = req.body;

        const settingsUpdate = {
            settings: {
                emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
                pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
                eventReminders: eventReminders !== undefined ? eventReminders : true,
                credentialUpdates: credentialUpdates !== undefined ? credentialUpdates : true,
                twoFactorEnabled: twoFactorEnabled !== undefined ? twoFactorEnabled : false
            }
        };

        if (Object.keys(preferences).length > 0) {
            settingsUpdate.preferences = preferences;
        }

        const updated = await Participant.findByIdAndUpdate(
            req.params.id,
            settingsUpdate,
            { new: true, select: 'settings preferences' }
        );

        if (!updated) {
            return res.status(404).json({ error: "Participant not found" });
        }

        res.json({
            message: "Settings updated successfully",
            settings: updated.settings,
            preferences: updated.preferences
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==================== REMAINING ROUTES ====================
router.get("/export/all", async (req, res) => {
    try {
        const participants = await Participant.find().select('-password');
        res.json({ message: "Export successful", data: participants });
    } catch (err) {
        res.status(500).json({ error: "Failed to export participants" });
    }
});

router.post("/share", authenticateUser, async (req, res) => {
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

router.put("/reconcile", authenticateUser, async (req, res) => {
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

router.get("/dashboard/:id", async (req, res) => {
    try {
        const participant = await Participant.findById(req.params.id)
            .populate("credentials")
            .populate("events")
            .select('-password');

        if (!participant) return res.status(404).json({ error: "Participant not found" });

        res.json({
            profile: {
                name: participant.fullName || `${participant.firstName} ${participant.lastName}`.trim(),
                firstName: participant.firstName,
                lastName: participant.lastName,
                email: participant.email,
                phone: participant.phone,
                bio: participant.bio,
                profilePicture: participant.profilePicture,
                preferences: participant.preferences,
            },
            credentials: participant.credentials,
            events: participant.events,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id/credentials", async (req, res) => {
    try {
        const creds = await Credential.find({ participant: req.params.id });
        if (!creds || creds.length === 0) {
            return res.status(404).json({ message: "No credentials found for this participant" });
        }
        res.json(creds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id/credentials/:credId/download", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, credId } = req.params;
        const { format = 'pdf' } = req.query;

        const credential = await Credential.findOne({
            _id: credId,
            participantId: participantId
        }).populate('eventId', 'title startDate');

        if (!credential) {
            return res.status(404).json({ error: "Credential not found" });
        }

        if (credential.exportLinks && credential.exportLinks[format]) {
            return res.redirect(credential.exportLinks[format]);
        }

        if (credential.downloadLink && format === 'pdf') {
            return res.redirect(credential.downloadLink);
        }

        try {
            const exportData = {
                designData: credential.designData || {
                    canvas: { width: 1200, height: 800 },
                    background: { type: 'gradient', primaryColor: '#3498db', secondaryColor: '#e74c3c' },
                    elements: []
                },
                participantData: {
                    name: credential.participantData?.name || 'Participant Name',
                    eventTitle: credential.eventId?.title || 'Event Title',
                    eventDate: credential.eventId?.startDate || credential.createdAt,
                    email: credential.participantData?.email || '',
                    skills: credential.participantData?.skills || ''
                },
                credentialId: credential._id
            };

            const exportResponse = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/credentials/export/${format}`, {
                method: 'POST',
                headers: {
                    'Authorization': req.headers.authorization,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(exportData)
            });

            if (exportResponse.ok) {
                const exportResult = await exportResponse.json();
                if (exportResult.success && (exportResult.exportUrl || exportResult.downloadUrl)) {
                    return res.redirect(exportResult.exportUrl || exportResult.downloadUrl);
                }
            }
        } catch (exportError) {
            console.error('Export API error:', exportError);
        }

        res.setHeader("Content-Disposition", `attachment; filename=${credential.title || 'credential'}.json`);
        res.setHeader("Content-Type", "application/json");
        res.json({
            message: "Direct download not available. Please use the export feature from the credential designer.",
            credential: {
                title: credential.title,
                type: credential.type,
                eventTitle: credential.eventId?.title,
                participantName: credential.participantData?.name,
                issuedDate: credential.createdAt,
                blockchainHash: credential.blockchainHash,
                qrCode: credential.qrCode
            }
        });

    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/:id/credentials/:credId/share", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, credId } = req.params;
        const { email, message } = req.body;

        const credential = await Credential.findOne({
            _id: credId,
            participantId: participantId
        }).populate('eventId', 'title');

        if (!credential) {
            return res.status(404).json({ error: "Credential not found" });
        }

        if (!credential.sharedWith.find(share => share.user === email)) {
            credential.sharedWith.push({
                user: email,
                sharedAt: new Date(),
                permissions: 'view'
            });
            await credential.save();
        }

        await credential.incrementShare();

        res.json({
            message: `Credential "${credential.title}" shared with ${email}`,
            sharedCredential: {
                title: credential.title,
                type: credential.type,
                eventTitle: credential.eventId?.title,
                qrCode: credential.qrCode,
                verificationUrl: credential.verificationUrl
            }
        });
    } catch (err) {
        console.error('Share error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id/events", async (req, res) => {
    try {
        const events = await Event.find({ participants: req.params.id });
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id/events/:eventId", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, eventId } = req.params;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        const isRegistered = event.participants.includes(participantId);

        res.json({
            ...event.toObject(),
            isRegistered,
            canViewDetails: isRegistered || event.isPublic
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/:id/events/:eventId/interact", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, eventId } = req.params;
        const { action, comment, rating } = req.body;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        if (!event.participants.includes(participantId)) {
            return res.status(403).json({ error: "Not registered for this event" });
        }

        const interaction = {
            participantId,
            eventId,
            action,
            comment,
            rating,
            timestamp: new Date()
        };

        res.json({
            message: `Interaction recorded: ${action}`,
            interaction
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/credentials/:credentialId/download', authenticateUser, downloadCredentialForParticipant);

export default router;