/**
 * @swagger
 * tags:
 *   name: Certificates
 *   description: Certificate management
 */

/**
 * @swagger
 * /certificates:
 *   post:
 *     summary: Create a new certificate for event participants
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventId:
 *                 type: string
 *               participantId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Certificate created successfully
 *       400:
 *         description: Invalid input
 *
 *   get:
 *     summary: Get all certificates
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of certificates
 */
/**
 * @swagger
 * /api/certificates/my:
 *   get:
 *     summary: Get certificates for the logged-in participant
 *     tags: [Participants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of certificates for the participant
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   eventId:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date
 *                   downloadLink:
 *                     type: string
 *                   issuedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized, participant must be logged in
 *       500:
 *         description: Server error
 */

import express from "express";
import { createCertificate, getCertificates, getParticipantCertificates } from "../controllers/certificateController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, createCertificate);
router.get("/", authenticate, getCertificates);
router.get("/my", authenticate, getParticipantCertificates);

export default router;
