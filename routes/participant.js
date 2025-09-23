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
import { authenticateUser } from "../middleware/auth.js";

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

        // Split fullName into firstName and lastName for frontend compatibility
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const newParticipant = new Participant({
            fullName,
            firstName,
            lastName,
            email,
            password: hashedPassword,
            // Initialize settings for frontend compatibility
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
                { fullName: { $regex: q, $options: "i" } },
                { firstName: { $regex: q, $options: "i" } },
                { lastName: { $regex: q, $options: "i" } },
                { email: { $regex: q, $options: "i" } },
            ],
        }).select('-password'); // Exclude password from results
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
        const participant = await Participant.findById(req.params.id).select('-password');
        if (!participant) return res.status(404).json({ error: "Participant not found" });
        
        // Return data in format expected by frontend
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
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               bio:
 *                 type: string
 *               profilePicture:
 *                 type: string
 *     responses:
 *       200:
 *         description: Participant updated
 */
router.put("/:id", authenticateUser, async (req, res) => {
    try {
        const { firstName, lastName, email, phone, bio, profilePicture } = req.body;
        
        // Build update object
        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (bio !== undefined) updateData.bio = bio;
        if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
        
        // Update fullName if firstName or lastName changed
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

/**
 * @swagger
 * /api/participants/{id}/change-password:
 *   put:
 *     summary: Change participant password
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
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password or validation error
 *       404:
 *         description: Participant not found
 */
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

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, participant.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Hash and save new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        participant.password = hashedNewPassword;
        await participant.save();

        res.json({ message: "Password changed successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to change password" });
    }
});

/**
 * @swagger
 * /api/participants/{id}/settings:
 *   get:
 *     summary: Get participant settings
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
 *         description: Participant settings retrieved successfully
 *   put:
 *     summary: Update participant settings
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
 *             properties:
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *               eventReminders:
 *                 type: boolean
 *               credentialUpdates:
 *                 type: boolean
 *               twoFactorEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
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

        // Add preferences if provided
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
        const participants = await Participant.find().select('-password');
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

/**
 * @swagger
 * /api/participants/dashboard/{id}:
 *   get:
 *     summary: Get participant dashboard
 *     tags: [Participants]
 */
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

/**
 * @swagger
 * /api/participants/{id}/credentials:
 *   get:
 *     summary: Get participant credentials
 *     description: Retrieve all credentials (certificates, badges, etc.) issued to a participant using their ID.
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
 *         description: A list of credentials associated with the participant
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
 *                     example: "Certificate of Completion"
 *                   type:
 *                     type: string
 *                     example: "Certificate"
 *                   event:
 *                     type: string
 *                     example: "Tech Innovation Summit 2025"
 *                   issueDate:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-09-04T09:00:00.000Z"
 *                   status:
 *                     type: string
 *                     example: "Issued"
 *       404:
 *         description: Participant not found or no credentials available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No credentials found for this participant"
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

/**
 * @swagger
 * /api/participants/{id}/credentials/{credId}/download:
 *   get:
 *     summary: Download a credential
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Participant ID
 *       - in: path
 *         name: credId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, png, jpeg]
 *           default: pdf
 *         description: Download format
 *     responses:
 *       200:
 *         description: File download started
 *       404:
 *         description: Credential not found
 */
router.get("/:id/credentials/:credId/download", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, credId } = req.params;
        const { format = 'pdf' } = req.query;

        // Find the credential and verify it belongs to the participant
        const credential = await Credential.findOne({
            _id: credId,
            participantId: participantId
        }).populate('eventId', 'title startDate');

        if (!credential) {
            return res.status(404).json({ error: "Credential not found" });
        }

        // Method 1: If credential has export links, redirect to them
        if (credential.exportLinks && credential.exportLinks[format]) {
            return res.redirect(credential.exportLinks[format]);
        }

        // Method 2: If credential has a direct downloadLink (for PDF)
        if (credential.downloadLink && format === 'pdf') {
            return res.redirect(credential.downloadLink);
        }

        // Method 3: Generate download using export API
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

            // Make internal API call to export endpoint
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

        // Method 4: Fallback - return credential data as JSON for now
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

/**
 * @swagger
 * /api/participants/{id}/credentials/{credId}/share:
 *   post:
 *     summary: Share a credential
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Participant ID
 *       - in: path
 *         name: credId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credential shared successfully
 */
router.post("/:id/credentials/:credId/share", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, credId } = req.params;
        const { email, message } = req.body;

        // Find the credential and verify it belongs to the participant
        const credential = await Credential.findOne({
            _id: credId,
            participantId: participantId
        }).populate('eventId', 'title');

        if (!credential) {
            return res.status(404).json({ error: "Credential not found" });
        }

        // Add to shared list if not already shared with this email
        if (!credential.sharedWith.find(share => share.user === email)) {
            credential.sharedWith.push({
                user: email,
                sharedAt: new Date(),
                permissions: 'view'
            });
            await credential.save();
        }

        // Increment share count
        await credential.incrementShare();

        // TODO: Implement actual email sending with credential details
        // For now, return success message
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
 *     parameters:
 *       - in: path
 *         name: id
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
 */
router.get("/:id/events/:eventId", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, eventId } = req.params;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        // Check if participant is registered for this event
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

/**
 * @swagger
 * /api/participants/{id}/events/{eventId}/interact:
 *   post:
 *     summary: Interact with event
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
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
 */
router.post("/:id/events/:eventId/interact", authenticateUser, async (req, res) => {
    try {
        const { id: participantId, eventId } = req.params;
        const { action, comment, rating } = req.body;

        // Find the event
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        // Verify participant is registered
        if (!event.participants.includes(participantId)) {
            return res.status(403).json({ error: "Not registered for this event" });
        }

        // Save interaction (you might want to create an EventInteraction model)
        const interaction = {
            participantId,
            eventId,
            action,
            comment,
            rating,
            timestamp: new Date()
        };

        // For now, just return success - implement actual storage as needed
        res.json({
            message: `Interaction recorded: ${action}`,
            interaction
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
router.post("/:participantId/events/:eventId/register", authenticateUser, async (req, res) => {
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