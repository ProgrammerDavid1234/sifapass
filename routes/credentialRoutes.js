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
import { trackCredentialUsage } from '../middleware/usageTracking.js';
import { requireFeature, attachPlanInfo } from '../middleware/planAccess.js';

const router = express.Router();
import { authenticate, authenticateUser } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import upload from "../middleware/upload.js";

// ==================== CREDENTIAL CREATION (WITH PLAN CHECKS) ====================
/**
 * @swagger
 * /api/credentials/create:
 *   post:
 *     summary: Create Participant Credential (deducts credits or checks limits)
 *     tags: [Admin]
 */
router.post("/create", 
  authenticate, 
  trackCredentialUsage,  // ← Deducts credit or checks subscription limit
  upload.single("file"), 
  createCredential
);

/**
 * @swagger
 * /api/credentials/create-with-design:
 *   post:
 *     summary: Create credential with custom design
 *     tags: [Credentials]
 */
router.post("/create-with-design", 
  authenticate, 
  trackCredentialUsage,  // ← Deducts credit or checks subscription limit
  createCredentialWithDesign
);

// ==================== BULK OPERATIONS (STANDARD+ ONLY) ====================
/**
 * @swagger
 * /api/credentials/batch/create:
 *   post:
 *     summary: Create multiple credentials at once (Standard plan or higher)
 *     tags: [Batch Operations]
 */
router.post("/batch/create", 
  authenticate, 
  requireFeature('bulkGeneration'),  // ← Only Standard+ plans
  async (req, res) => {
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
 *     summary: Export multiple credentials at once (Standard plan or higher)
 *     tags: [Batch Operations]
 */
router.post("/batch/export", 
  authenticate, 
  requireFeature('bulkGeneration'),  // ← Only Standard+ plans
  async (req, res) => {
    try {
        const { credentialIds, format = 'pdf' } = req.body;

        if (!credentialIds || !Array.isArray(credentialIds)) {
            return res.status(400).json({ message: "Invalid credential IDs" });
        }

        const results = [];
        const errors = [];

        for (const credentialId of credentialIds) {
            try {
                const credential = await Credential.findById(credentialId)
                    .populate('participantId', 'name email')
                    .populate('eventId', 'title');

                if (!credential) {
                    errors.push({ credentialId, error: 'Credential not found' });
                    continue;
                }

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

// ==================== IMPORT (STANDARD+ ONLY) ====================
/**
 * @swagger
 * /api/credentials/import:
 *   post:
 *     summary: Import credentials from a file (Standard plan or higher)
 *     tags: [Admin]
 */
router.post("/import", 
  authenticate, 
  requireFeature('bulkGeneration'),  // ← Only Standard+ plans
  importCredential
);

// ==================== TEMPLATES (FILTERED BY PLAN) ====================
/**
 * @swagger
 * /api/credentials/templates:
 *   get:
 *     summary: Get all templates (filtered by plan tier)
 *     tags: [Templates]
 */
router.get("/templates", 
  authenticate, 
  attachPlanInfo,  // ← Attach plan info for filtering
  getTemplates
);

/**
 * @swagger
 * /api/credentials/templates:
 *   post:
 *     summary: Create a new credential template
 *     tags: [Templates]
 */
router.post("/templates", 
  authenticate, 
  requireFeature('customTemplates'),  // ← Only Standard+ can create custom templates
  createTemplate
);

router.get("/templates/:id", authenticate, getTemplate);
router.put("/templates/:id", authenticate, updateTemplate);

/**
 * @swagger
 * /api/credentials/templates/{id}/duplicate:
 *   post:
 *     summary: Duplicate an existing template (Standard+ only)
 *     tags: [Templates]
 */
router.post("/templates/:id/duplicate", 
  authenticate, 
  requireFeature('customTemplates'),  // ← Only Standard+ plans
  async (req, res) => {
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

// ==================== DESIGNER & CUSTOMIZATION ====================
router.post("/designer/save", authenticate, saveDesignProgress);
router.post("/designer/preview", authenticate, previewCredential);
router.get("/template/default", getDefaultTemplate);

/**
 * @swagger
 * /api/credentials/{id}/customize:
 *   put:
 *     summary: Customize credential (Professional plan for advanced branding)
 *     tags: [Admin]
 */
router.put("/:id/customize", 
  authenticate, 
  // Note: Basic customization allowed for all, but custom branding checked in controller
  customizeCredential
);

// ==================== EXPORT FUNCTIONS ====================
const debugExportMiddleware = (req, res, next) => {
    console.log(`Export request started: ${req.method} ${req.path}`);
    req.setTimeout(120000);
    res.setTimeout(120000);
    next();
};

router.post("/export/png", authenticateUser, exportCredentialPNG);
router.post("/export/jpeg", authenticate, exportCredentialJPEG);
router.post("/export/pdf", authenticate, exportCredentialPDF);

// ==================== BASIC CREDENTIAL OPERATIONS ====================
router.put("/:id/edit", authenticate, editCredential);
router.post("/:id/share", authenticate, shareCredential);
router.get("/:id/verify", verifyCredential);
router.post("/reconcile", authenticate, reconcileCertificates);
router.get("/stats", authenticate, getCredentialStats);
router.get("/my", authenticateUser, getMyCredentials);
router.get("/", authenticate, getAdminCredentialsViaEvents);

router.get('/participants/:participantId/credentials/:credentialId/download',
    authenticate,
    downloadCredentialDirect
);

router.get("/test-cloudinary", async (req, res) => {
    try {
        const uploadResult = await cloudinary.v2.uploader.upload(
            "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            { folder: "test" }
        );
        res.json({
            success: true,
            url: uploadResult.secure_url,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;