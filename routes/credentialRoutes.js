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
    getCredentialStats,
    getMyCredentials,
    createTemplate,
    getTemplates,
    getTemplate,
    updateTemplate,
    saveDesignProgress,
    previewCredential,
    exportCredentialPNG,
    exportCredentialJPEG,
    exportCredentialPDF,
    createCredentialWithDesign,
    getAdminCredentialsViaEvents,
    downloadCredentialDirect
} from "../controllers/credentialController.js";

const router = express.Router();
import { authenticate, authenticateUser } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import upload from "../middleware/upload.js";
import {
    trackCredentialIssued,
    trackCredentialVerified,
    trackCredentialDownloaded
} from "../utils/analyticsHelper.js";



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

/**
 * @swagger
 * /api/credentials/stats:
 *   get:
 *     summary: Get credential statistics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Returns credential statistics
 *       500:
 *         description: Server error    
 */
router.get("/stats", authenticate, getCredentialStats);
/**
 * @swagger
 * /api/credentials/my:
 *   get:
 *     summary: Get credentials for the logged-in participant
 *     tags: [Participants]
 *     responses:
 *       200:
 *         description: List of credentials for the participant
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/my", authenticateUser, getMyCredentials);


/**
 * @swagger
 * /api/credentials/templates:
 *   post:
 *     summary: Create a new credential template with designer data
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - designData
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Modern Certificate Template"
 *               type:
 *                 type: string
 *                 enum: [certificate, badge]
 *               designData:
 *                 type: object
 *                 properties:
 *                   elements:
 *                     type: array
 *                   canvas:
 *                     type: object
 *                   background:
 *                     type: object
 *               backgroundSettings:
 *                 type: object
 *               contentSettings:
 *                 type: object
 *               verificationSettings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Template created successfully
 */
router.post("/templates", authenticate, createTemplate);

/**
 * @swagger
 * /api/credentials/templates:
 *   get:
 *     summary: Get all templates (with optional type filter)
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [certificate, badge]
 *         description: Filter by template type
 *     responses:
 *       200:
 *         description: List of templates retrieved successfully
 */
router.get("/templates", authenticate, getTemplates);

/**
 * @swagger
 * /api/credentials/templates/{id}:
 *   get:
 *     summary: Get single template by ID
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *       404:
 *         description: Template not found
 */
router.get("/templates/:id", authenticate, getTemplate);

/**
 * @swagger
 * /api/credentials/templates/{id}:
 *   put:
 *     summary: Update template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Template updated successfully
 */
router.put("/templates/:id", authenticate, updateTemplate);

// ==================== DESIGNER FUNCTIONALITY ROUTES ====================

/**
 * @swagger
 * /api/credentials/designer/save:
 *   post:
 *     summary: Save design progress (auto-save functionality)
 *     tags: [Designer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: Template ID to update (optional for new designs)
 *               designData:
 *                 type: object
 *                 description: Complete design data including elements, canvas, background
 *                 properties:
 *                   elements:
 *                     type: array
 *                     description: Array of design elements
 *                   canvas:
 *                     type: object
 *                     properties:
 *                       width:
 *                         type: number
 *                       height:
 *                         type: number
 *                   background:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [solid, gradient, image]
 *                       primaryColor:
 *                         type: string
 *                       secondaryColor:
 *                         type: string
 *     responses:
 *       200:
 *         description: Design saved successfully
 */
router.post("/designer/save", authenticate, saveDesignProgress);

/**
 * @swagger
 * /api/credentials/designer/preview:
 *   post:
 *     summary: Generate preview of credential design
 *     tags: [Designer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - designData
 *             properties:
 *               designData:
 *                 type: object
 *                 description: Design configuration
 *               participantData:
 *                 type: object
 *                 description: Sample participant data for preview
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "John Doe"
 *                   eventTitle:
 *                     type: string
 *                     example: "Web Development Bootcamp"
 *                   eventDate:
 *                     type: string
 *                     example: "2024-01-15"
 *                   skills:
 *                     type: string
 *                     example: "JavaScript, React, Node.js"
 *     responses:
 *       200:
 *         description: Preview HTML generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 previewHtml:
 *                   type: string
 */
router.post("/designer/preview", authenticate, previewCredential);

// ==================== EXPORT FUNCTIONALITY ROUTES ====================
// Add this middleware before your export routes to debug the issue

const debugExportMiddleware = (req, res, next) => {
    console.log(`Export request started: ${req.method} ${req.path}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('User:', req.user ? req.user.id : 'No user');

    // Set a longer timeout for export operations
    req.setTimeout(120000); // 2 minutes
    res.setTimeout(120000);

    const originalSend = res.send;
    res.send = function (data) {
        console.log(`Export request completed: ${res.statusCode}`);
        originalSend.call(this, data);
    };

    next();
};

/**
 * @swagger
 * /api/credentials/export/png:
 *   post:
 *     summary: Export credential as PNG image
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - designData
 *               - participantData
 *             properties:
 *               designData:
 *                 type: object
 *                 description: Complete design configuration
 *               participantData:
 *                 type: object
 *                 description: Participant information to populate the credential
 *               credentialId:
 *                 type: string
 *                 description: Optional credential ID to update with export link
 *     responses:
 *       200:
 *         description: PNG exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 exportUrl:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.post("/export/png", authenticate, exportCredentialPNG);

/**
 * @swagger
 * /api/credentials/export/jpeg:
 *   post:
 *     summary: Export credential as JPEG image
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - designData
 *               - participantData
 *             properties:
 *               designData:
 *                 type: object
 *               participantData:
 *                 type: object
 *               credentialId:
 *                 type: string
 *     responses:
 *       200:
 *         description: JPEG exported successfully
 */
router.post("/export/jpeg", authenticate, exportCredentialJPEG);

/**
 * @swagger
 * /api/credentials/export/pdf:
 *   post:
 *     summary: Export credential as PDF document
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - designData
 *               - participantData
 *             properties:
 *               designData:
 *                 type: object
 *               participantData:
 *                 type: object
 *               credentialId:
 *                 type: string
 *     responses:
 *       200:
 *         description: PDF exported successfully
 */
router.post("/export/pdf", authenticate, exportCredentialPDF);

// ==================== ENHANCED CREATION ROUTES ====================

/**
 * @swagger
 * /api/credentials/create-with-design:
 *   post:
 *     summary: Create credential with custom design
 *     tags: [Credentials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantId
 *               - eventId
 *               - title
 *               - type
 *             properties:
 *               participantId:
 *                 type: string
 *                 description: ID of the participant
 *               eventId:
 *                 type: string
 *                 description: ID of the event
 *               title:
 *                 type: string
 *                 example: "Certificate of Completion"
 *               type:
 *                 type: string
 *                 enum: [certificate, badge]
 *               templateId:
 *                 type: string
 *                 description: Optional template ID to use
 *               designData:
 *                 type: object
 *                 description: Custom design data (overrides template)
 *               participantData:
 *                 type: object
 *                 description: Participant-specific data for the credential
 *                 properties:
 *                   name:
 *                     type: string
 *                   eventTitle:
 *                     type: string
 *                   eventDate:
 *                     type: string
 *                   skills:
 *                     type: string
 *                   customFields:
 *                     type: object
 *     responses:
 *       201:
 *         description: Credential created successfully with design
 *       400:
 *         description: Invalid input data
 */
router.post("/create-with-design", authenticate, createCredentialWithDesign);

// ==================== BATCH OPERATIONS ====================

/**
 * @swagger
 * /api/credentials/batch/create:
 *   post:
 *     summary: Create multiple credentials at once
 *     tags: [Batch Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - templateId
 *               - participants
 *             properties:
 *               eventId:
 *                 type: string
 *               templateId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [certificate, badge]
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     participantId:
 *                       type: string
 *                     participantData:
 *                       type: object
 *     responses:
 *       201:
 *         description: Batch credentials created successfully
 */
router.post("/batch/create", authenticate, async (req, res) => {
    try {
        const { eventId, templateId, type = 'certificate', participants } = req.body;

        if (!eventId || !participants || !Array.isArray(participants)) {
            return res.status(400).json({ message: "Invalid input data" });
        }

        const results = [];
        const errors = [];

        for (const participant of participants) {
            try {
                const credentialData = {
                    participantId: participant.participantId,
                    eventId,
                    title: participant.title || `${type} of Achievement`,
                    type,
                    templateId,
                    participantData: participant.participantData || {}
                };

                // You would call createCredentialWithDesign here
                // For now, we'll use a simplified approach
                const credential = await createCredentialWithDesign({ body: credentialData });
                results.push(credential);
            } catch (error) {
                errors.push({
                    participantId: participant.participantId,
                    error: error.message
                });
            }
        }

        res.status(201).json({
            success: true,
            message: `Created ${results.length} credentials`,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to create batch credentials",
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/credentials/batch/export:
 *   post:
 *     summary: Export multiple credentials at once
 *     tags: [Batch Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               credentialIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               format:
 *                 type: string
 *                 enum: [png, jpeg, pdf]
 *                 default: pdf
 *     responses:
 *       200:
 *         description: Batch export completed
 */
router.post("/batch/export", authenticate, async (req, res) => {
    try {
        const { credentialIds, format = 'pdf' } = req.body;

        if (!credentialIds || !Array.isArray(credentialIds)) {
            return res.status(400).json({ message: "Invalid credential IDs" });
        }

        const results = [];
        const errors = [];

        for (const credentialId of credentialIds) {
            try {
                // Fetch credential data
                const credential = await Credential.findById(credentialId)
                    .populate('participantId', 'name email')
                    .populate('eventId', 'title');

                if (!credential) {
                    errors.push({ credentialId, error: 'Credential not found' });
                    continue;
                }

                // Export based on format
                let exportFunction;
                switch (format) {
                    case 'png':
                        exportFunction = exportCredentialPNG;
                        break;
                    case 'jpeg':
                        exportFunction = exportCredentialJPEG;
                        break;
                    case 'pdf':
                        exportFunction = exportCredentialPDF;
                        break;
                    default:
                        throw new Error('Invalid export format');
                }

                const exportData = {
                    designData: credential.designData,
                    participantData: credential.participantData,
                    credentialId: credential._id
                };

                // Mock export result
                results.push({
                    credentialId,
                    exportUrl: `https://example.com/exports/${credentialId}.${format}`,
                    participantName: credential.participantId.name
                });

            } catch (error) {
                errors.push({
                    credentialId,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Exported ${results.length} credentials`,
            results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to export credentials",
            error: error.message
        });
    }
});

// ==================== TEMPLATE SHARING AND MARKETPLACE ====================

/**
 * @swagger
 * /api/credentials/templates/{id}/duplicate:
 *   post:
 *     summary: Duplicate an existing template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post("/templates/:id/duplicate", authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const originalTemplate = await CredentialTemplate.findById(id);
        if (!originalTemplate) {
            return res.status(404).json({ message: "Template not found" });
        }

        const duplicatedTemplate = originalTemplate.duplicate(name, req.user.id);
        await duplicatedTemplate.save();

        res.status(201).json({
            success: true,
            message: "Template duplicated successfully",
            template: duplicatedTemplate
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to duplicate template",
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/credentials/templates/public:
 *   get:
 *     summary: Get public templates available for everyone
 *     tags: [Templates]
 */
router.get("/templates/public", async (req, res) => {
    try {
        const { type } = req.query;
        const templates = await CredentialTemplate.getPublicTemplates(type);

        res.json({
            success: true,
            templates
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch public templates",
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/credentials:
 *   get:
 *     summary: Get all credentials created by the authenticated admin
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [certificate, badge]
 *         description: Filter by credential type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Limit number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of credentials retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 credentials:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", authenticate, getAdminCredentialsViaEvents);
// In your routes file
router.get('/participants/:participantId/credentials/:credentialId/download',
    authenticate,
    downloadCredentialDirect
);

export default router;

