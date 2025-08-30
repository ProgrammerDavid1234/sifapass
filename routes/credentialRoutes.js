import express from "express";
import {
    createCredential,
    editCredential,
    shareCredential,
    importCredential,
    getDefaultTemplate,
    customizeCredential,
    verifyCredential,
    reconcileCertificates,
} from "../controllers/credentialController.js";

const router = express.Router();
import { authenticate } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import upload from "../middleware/upload.js";




/**
 * @swagger
 * /api/credentials/{id}/edit:
 *   put:
 *     summary: Edit a credential
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Credential ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               name: "Blockchain Certificate"
 *               issuer: "University X"
 *     responses:
 *       200:
 *         description: Credential updated successfully
 */
router.put("/:id/edit", authenticate, editCredential);

/**
 * @swagger
 * /api/credentials/{id}/share:
 *   post:
 *     summary: Share a credential with others
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Credential ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential shared successfully
 */
router.post("/:id/share", authenticate, shareCredential);

/**
 * @swagger
 * /api/credentials/import:
 *   post:
 *     summary: Import credentials from a file or external system
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Credentials imported successfully
 */
router.post("/import", authenticate, importCredential);

/**
 * @swagger
 * /api/credentials/template/default:
 *   get:
 *     summary: Get default credential template
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Default template retrieved
 */
router.get("/template/default", getDefaultTemplate);

/**
 * @swagger
 * /api/credentials/{id}/customize:
 *   put:
 *     summary: Customize credential using editor
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Credential ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             example:
 *               color: "blue"
 *               font: "Roboto"
 *     responses:
 *       200:
 *         description: Credential customized successfully
 */
router.put("/:id/customize", authenticate, customizeCredential);

/**
 * @swagger
 * /api/credentials/{id}/verify:
 *   get:
 *     summary: Verify credential via blockchain or QR code
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Credential ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential is valid
 *       400:
 *         description: Credential is invalid
 */
router.get("/:id/verify", verifyCredential);

/**
 * @swagger
 * /api/credentials/reconcile:
 *   post:
 *     summary: Reconcile participant certificates
 *     tags: [Admin]
 */
router.post("/reconcile", authenticate, reconcileCertificates);
/**
 * @swagger
 * /api/credentials/create:
 *   post:
 *     summary: Create Participant Credential (Certificate or Badge)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - participantId
 *               - eventId
 *               - title
 *               - type
 *               - file
 *             properties:
 *               participantId:
 *                 type: string
 *               eventId:
 *                 type: string
 *               title:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [certificate, badge]
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Credential created successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Failed to create credential
 */

router.post("/create", authenticate, upload.single("file"), createCredential);

export default router;
