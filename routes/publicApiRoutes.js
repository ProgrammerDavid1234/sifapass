// routes/publicApiRoutes.js
import express from "express";
import rateLimit from "express-rate-limit";
import { verifyApiKey } from "./apiKeyRoutes.js";
import { triggerWebhook, WEBHOOK_EVENTS } from "./webhookRoutes.js";

const router = express.Router();

// Rate limiting for public API
const publicApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Higher limit for API users
    message: {
        success: false,
        message: 'API rate limit exceeded, please try again later.'
    },
    keyGenerator: (req) => {
        // Use API key for rate limiting if available
        return req.headers['authorization']?.replace('Bearer ', '') || req.ip;
    }
});

// Apply API key verification and rate limiting to all public API routes
router.use(publicApiLimiter);
router.use(verifyApiKey);

/**
 * @swagger
 * /api/v1/credentials:
 *   post:
 *     summary: Create a new credential
 *     tags: [Public API - Credentials]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientEmail
 *               - templateId
 *             properties:
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 description: Email of the credential recipient
 *               templateId:
 *                 type: string
 *                 description: ID of the credential template to use
 *               recipientName:
 *                 type: string
 *                 description: Full name of the recipient
 *               credentialData:
 *                 type: object
 *                 description: Additional data to populate in the credential
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Credential expiration date
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for organizing credentials
 *     responses:
 *       201:
 *         description: Credential created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     credentialId:
 *                       type: string
 *                     recipientEmail:
 *                       type: string
 *                     status:
 *                       type: string
 *                     verificationUrl:
 *                       type: string
 *                     qrCode:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Invalid API key
 */
router.post('/credentials', async (req, res) => {
    try {
        const { 
            recipientEmail, 
            templateId, 
            recipientName,
            credentialData = {},
            expiresAt,
            tags = []
        } = req.body;
        
        // Validate required fields
        if (!recipientEmail || !templateId) {
            return res.status(400).json({
                success: false,
                message: 'recipientEmail and templateId are required'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }
        
        // Create credential record
        const credential = {
            id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            recipientEmail,
            recipientName: recipientName || recipientEmail.split('@')[0],
            templateId,
            organizationId: req.apiKey.organizationId,
            credentialData,
            status: 'issued',
            issuedAt: new Date(),
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            tags,
            verificationId: `verify_${Math.random().toString(36).substr(2, 16)}`,
            qrCode: `https://verify.sifapass.com/${Math.random().toString(36).substr(2, 16)}`
        };
        
        // Save credential to database
        // const savedCredential = await Credential.create(credential);
        
        // Generate verification URL
        const verificationUrl = `${process.env.BASE_URL}/verify/${credential.verificationId}`;
        
        // Trigger webhook
        await triggerWebhook(WEBHOOK_EVENTS.CREDENTIAL_ISSUED, {
            credentialId: credential.id,
            recipientEmail: credential.recipientEmail,
            templateId: credential.templateId,
            status: credential.status,
            issuedAt: credential.issuedAt
        }, req.apiKey.organizationId);
        
        res.status(201).json({
            success: true,
            message: 'Credential created successfully',
            data: {
                credentialId: credential.id,
                recipientEmail: credential.recipientEmail,
                status: credential.status,
                verificationUrl,
                qrCode: credential.qrCode,
                issuedAt: credential.issuedAt,
                expiresAt: credential.expiresAt
            }
        });
        
    } catch (error) {
        console.error('Credential creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create credential',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/credentials/{credentialId}:
 *   get:
 *     summary: Get credential details
 *     tags: [Public API - Credentials]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential details retrieved successfully
 *       404:
 *         description: Credential not found
 */
router.get('/credentials/:credentialId', async (req, res) => {
    try {
        const { credentialId } = req.params;
        
        // Fetch credential from database
        // const credential = await Credential.findOne({
        //     id: credentialId,
        //     organizationId: req.apiKey.organizationId
        // });
        
        // Mock response for now
        const credential = {
            id: credentialId,
            recipientEmail: 'user@example.com',
            recipientName: 'John Doe',
            templateId: 'template_123',
            status: 'issued',
            issuedAt: new Date(),
            verificationUrl: `${process.env.BASE_URL}/verify/verify_123`,
            qrCode: 'https://verify.sifapass.com/verify_123'
        };
        
        if (!credential) {
            return res.status(404).json({
                success: false,
                message: 'Credential not found'
            });
        }
        
        res.json({
            success: true,
            data: credential
        });
        
    } catch (error) {
        console.error('Credential fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credential',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/credentials/{credentialId}/revoke:
 *   post:
 *     summary: Revoke a credential
 *     tags: [Public API - Credentials]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for revocation
 *     responses:
 *       200:
 *         description: Credential revoked successfully
 */
router.post('/credentials/:credentialId/revoke', async (req, res) => {
    try {
        const { credentialId } = req.params;
        const { reason = 'Revoked via API' } = req.body;
        
        // Update credential status in database
        // const credential = await Credential.findOneAndUpdate(
        //     { id: credentialId, organizationId: req.apiKey.organizationId },
        //     { 
        //         status: 'revoked', 
        //         revokedAt: new Date(),
        //         revocationReason: reason
        //     },
        //     { new: true }
        // );
        
        // Mock response for now
        const credential = {
            id: credentialId,
            status: 'revoked',
            revokedAt: new Date(),
            revocationReason: reason
        };
        
        if (!credential) {
            return res.status(404).json({
                success: false,
                message: 'Credential not found'
            });
        }
        
        // Trigger webhook
        await triggerWebhook(WEBHOOK_EVENTS.CREDENTIAL_REVOKED, {
            credentialId: credential.id,
            status: credential.status,
            revokedAt: credential.revokedAt,
            reason: credential.revocationReason
        }, req.apiKey.organizationId);
        
        res.json({
            success: true,
            message: 'Credential revoked successfully',
            data: {
                credentialId: credential.id,
                status: credential.status,
                revokedAt: credential.revokedAt,
                reason: credential.revocationReason
            }
        });
        
    } catch (error) {
        console.error('Credential revocation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke credential',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/credentials:
 *   get:
 *     summary: List credentials
 *     tags: [Public API - Credentials]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of credentials per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [issued, revoked, expired]
 *         description: Filter by credential status
 *       - in: query
 *         name: recipientEmail
 *         schema:
 *           type: string
 *         description: Filter by recipient email
 *     responses:
 *       200:
 *         description: List of credentials
 */
router.get('/credentials', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status, 
            recipientEmail 
        } = req.query;
        
        const skip = (page - 1) * limit;
        
        // Build query filters
        const filters = {
            organizationId: req.apiKey.organizationId
        };
        
        if (status) filters.status = status;
        if (recipientEmail) filters.recipientEmail = recipientEmail;
        
        // Fetch credentials from database
        // const credentials = await Credential.find(filters)
        //     .skip(skip)
        //     .limit(parseInt(limit))
        //     .sort({ issuedAt: -1 });
        // 
        // const total = await Credential.countDocuments(filters);
        
        // Mock response for now
        const credentials = [
            {
                id: 'cred_123',
                recipientEmail: 'user@example.com',
                recipientName: 'John Doe',
                templateId: 'template_123',
                status: 'issued',
                issuedAt: new Date(),
                verificationUrl: `${process.env.BASE_URL}/verify/verify_123`
            }
        ];
        const total = 1;
        
        res.json({
            success: true,
            data: {
                credentials,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('Credentials list error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credentials',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/verify/{verificationId}:
 *   get:
 *     summary: Verify a credential
 *     tags: [Public API - Verification]
 *     parameters:
 *       - in: path
 *         name: verificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credential verification result
 */
router.get('/verify/:verificationId', async (req, res) => {
    try {
        const { verificationId } = req.params;
        
        // Fetch credential by verification ID
        // const credential = await Credential.findOne({
        //     verificationId,
        //     status: { $ne: 'revoked' }
        // }).populate('templateId organizationId');
        
        // Mock response for now
        const credential = {
            id: 'cred_123',
            recipientName: 'John Doe',
            recipientEmail: 'user@example.com',
            templateName: 'Course Completion Certificate',
            organizationName: 'SifaPass Academy',
            issuedAt: new Date('2024-01-15'),
            status: 'issued',
            credentialData: {
                courseName: 'Advanced Web Development',
                completionDate: '2024-01-15',
                grade: 'A'
            }
        };
        
        if (!credential) {
            return res.status(404).json({
                success: false,
                message: 'Credential not found or has been revoked'
            });
        }
        
        // Check if credential is expired
        const isExpired = credential.expiresAt && new Date() > credential.expiresAt;
        
        // Trigger webhook for verification
        await triggerWebhook(WEBHOOK_EVENTS.CREDENTIAL_VERIFIED, {
            credentialId: credential.id,
            recipientEmail: credential.recipientEmail,
            verifiedAt: new Date(),
            verifierIP: req.ip
        }, req.apiKey.organizationId);
        
        res.json({
            success: true,
            data: {
                credentialId: credential.id,
                recipientName: credential.recipientName,
                recipientEmail: credential.recipientEmail,
                templateName: credential.templateName,
                organizationName: credential.organizationName,
                issuedAt: credential.issuedAt,
                status: isExpired ? 'expired' : credential.status,
                isValid: !isExpired && credential.status === 'issued',
                credentialData: credential.credentialData
            }
        });
        
    } catch (error) {
        console.error('Credential verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify credential',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/templates:
 *   get:
 *     summary: List available templates
 *     tags: [Public API - Templates]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of available templates
 */
router.get('/templates', async (req, res) => {
    try {
        // Fetch templates from database
        // const templates = await Template.find({
        //     organizationId: req.apiKey.organizationId,
        //     isActive: true
        // });
        
        // Mock response for now
        const templates = [
            {
                id: 'template_123',
                name: 'Course Completion Certificate',
                description: 'Certificate awarded for completing online courses',
                category: 'education',
                fields: ['courseName', 'completionDate', 'grade'],
                createdAt: new Date('2024-01-01')
            },
            {
                id: 'template_456',
                name: 'Event Attendance Badge',
                description: 'Badge for event participation',
                category: 'events',
                fields: ['eventName', 'attendanceDate', 'role'],
                createdAt: new Date('2024-01-05')
            }
        ];
        
        res.json({
            success: true,
            data: {
                templates
            }
        });
        
    } catch (error) {
        console.error('Templates fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch templates',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/batch/credentials:
 *   post:
 *     summary: Create multiple credentials in batch
 *     tags: [Public API - Batch Operations]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - recipients
 *             properties:
 *               templateId:
 *                 type: string
 *               recipients:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - recipientEmail
 *                   properties:
 *                     recipientEmail:
 *                       type: string
 *                       format: email
 *                     recipientName:
 *                       type: string
 *                     credentialData:
 *                       type: object
 *     responses:
 *       202:
 *         description: Batch operation accepted
 */
router.post('/batch/credentials', async (req, res) => {
    try {
        const { templateId, recipients } = req.body;
        
        if (!templateId || !recipients || !Array.isArray(recipients)) {
            return res.status(400).json({
                success: false,
                message: 'templateId and recipients array are required'
            });
        }
        
        if (recipients.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 100 recipients allowed per batch'
            });
        }
        
        // Validate all recipients
        const errors = [];
        recipients.forEach((recipient, index) => {
            if (!recipient.recipientEmail) {
                errors.push(`Recipient ${index + 1}: recipientEmail is required`);
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.recipientEmail)) {
                errors.push(`Recipient ${index + 1}: invalid email format`);
            }
        });
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors
            });
        }
        
        // Create batch operation record
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Process batch in background (you might want to use a job queue)
        setTimeout(async () => {
            try {
                const results = [];
                for (const recipient of recipients) {
                    // Create credential for each recipient
                    const credential = {
                        id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        recipientEmail: recipient.recipientEmail,
                        recipientName: recipient.recipientName || recipient.recipientEmail.split('@')[0],
                        templateId,
                        organizationId: req.apiKey.organizationId,
                        credentialData: recipient.credentialData || {},
                        status: 'issued',
                        issuedAt: new Date(),
                        batchId
                    };
                    
                    results.push(credential);
                    
                    // Trigger webhook for each credential
                    await triggerWebhook(WEBHOOK_EVENTS.CREDENTIAL_ISSUED, {
                        credentialId: credential.id,
                        recipientEmail: credential.recipientEmail,
                        templateId: credential.templateId,
                        status: credential.status,
                        batchId
                    }, req.apiKey.organizationId);
                }
                
                console.log(`Batch ${batchId} completed: ${results.length} credentials created`);
                
            } catch (error) {
                console.error(`Batch ${batchId} failed:`, error);
            }
        }, 1000);
        
        res.status(202).json({
            success: true,
            message: 'Batch operation accepted',
            data: {
                batchId,
                recipientCount: recipients.length,
                status: 'processing',
                estimatedCompletion: new Date(Date.now() + recipients.length * 1000)
            }
        });
        
    } catch (error) {
        console.error('Batch credentials error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process batch credentials',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/v1/batch/{batchId}/status:
 *   get:
 *     summary: Get batch operation status
 *     tags: [Public API - Batch Operations]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Batch operation status
 */
router.get('/batch/:batchId/status', async (req, res) => {
    try {
        const { batchId } = req.params;
        
        // Fetch batch status from database
        // const batchOperation = await BatchOperation.findOne({
        //     id: batchId,
        //     organizationId: req.apiKey.organizationId
        // });
        
        // Mock response for now
        const batchOperation = {
            id: batchId,
            status: 'completed',
            totalRecipients: 50,
            processedRecipients: 50,
            successfulCredentials: 48,
            failedCredentials: 2,
            startedAt: new Date(Date.now() - 300000), // 5 minutes ago
            completedAt: new Date(Date.now() - 60000), // 1 minute ago
            errors: [
                'Invalid email format for recipient 15',
                'Template not found for recipient 32'
            ]
        };
        
        if (!batchOperation) {
            return res.status(404).json({
                success: false,
                message: 'Batch operation not found'
            });
        }
        
        res.json({
            success: true,
            data: batchOperation
        });
        
    } catch (error) {
        console.error('Batch status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch batch status',
            error: error.message
        });
    }
});

export default router;