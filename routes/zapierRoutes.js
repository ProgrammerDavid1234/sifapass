// routes/zapierRoutes.js
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for Zapier operations
const zapierLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        message: 'Too many Zapier requests, please try again later.'
    }
});

/**
 * @swagger
 * /api/zapier/auth:
 *   post:
 *     summary: Authenticate Zapier connection
 *     tags: [Zapier Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: SifaPass API key
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Invalid API key
 */
router.post('/auth', zapierLimiter, async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        if (!apiKey) {
            return res.status(400).json({
                success: false,
                message: 'API key is required'
            });
        }
        
        // Validate API key (implement your API key validation logic)
        // const isValid = await validateApiKey(apiKey);
        const isValid = apiKey.startsWith('sk_'); // Simple validation for demo
        
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }
        
        // Get organization/user details for the API key
        // const organization = await getOrganizationByApiKey(apiKey);
        const organization = {
            id: 'org_123',
            name: 'SifaPass Academy',
            email: 'admin@sifapass.com'
        };
        
        res.json({
            success: true,
            message: 'Authentication successful',
            data: {
                organizationId: organization.id,
                organizationName: organization.name,
                email: organization.email
            }
        });
        
    } catch (error) {
        console.error('Zapier auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/zapier/hooks/credential-issued:
 *   post:
 *     summary: Subscribe to credential issued events (Zapier webhook)
 *     tags: [Zapier Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - target_url
 *             properties:
 *               target_url:
 *                 type: string
 *                 format: uri
 *                 description: Zapier webhook URL
 *               event:
 *                 type: string
 *                 default: credential.issued
 *     responses:
 *       201:
 *         description: Webhook subscription created
 */
router.post('/hooks/credential-issued', zapierLimiter, async (req, res) => {
    try {
        const { target_url, event = 'credential.issued' } = req.body;
        
        if (!target_url) {
            return res.status(400).json({
                success: false,
                message: 'target_url is required'
            });
        }
        
        // Create webhook subscription
        const subscription = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            target_url,
            event,
            provider: 'zapier',
            created_at: new Date(),
            is_active: true
        };
        
        // Save subscription to database
        // await ZapierSubscription.create(subscription);
        
        res.status(201).json({
            success: true,
            message: 'Webhook subscription created',
            data: {
                id: subscription.id,
                target_url: subscription.target_url,
                event: subscription.event
            }
        });
        
    } catch (error) {
        console.error('Zapier webhook subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create webhook subscription',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/zapier/hooks/credential-issued/{subscriptionId}:
 *   delete:
 *     summary: Unsubscribe from credential issued events
 *     tags: [Zapier Integration]
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook subscription deleted
 */
router.delete('/hooks/credential-issued/:subscriptionId', zapierLimiter, async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        
        // Delete subscription from database
        // await ZapierSubscription.findByIdAndDelete(subscriptionId);
        
        res.json({
            success: true,
            message: 'Webhook subscription deleted'
        });
        
    } catch (error) {
        console.error('Zapier webhook unsubscribe error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete webhook subscription',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/zapier/triggers/credential-issued/poll:
 *   get:
 *     summary: Poll for recent credential issued events
 *     tags: [Zapier Integration]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Recent credential events
 */
router.get('/triggers/credential-issued/poll', zapierLimiter, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // Fetch recent credential events from database
        // const credentials = await Credential.find()
        //     .sort({ issuedAt: -1 })
        //     .limit(parseInt(limit));
        
        // Mock response for now
        const credentials = [
            {
                id: 'cred_123',
                recipientEmail: 'john@example.com',
                recipientName: 'John Doe',
                templateId: 'template_123',
                templateName: 'Course Completion Certificate',
                status: 'issued',
                issuedAt: new Date(),
                credentialData: {
                    courseName: 'Web Development Basics',
                    completionDate: '2024-01-15'
                }
            },
            {
                id: 'cred_124',
                recipientEmail: 'jane@example.com',
                recipientName: 'Jane Smith',
                templateId: 'template_456',
                templateName: 'Event Attendance Badge',
                status: 'issued',
                issuedAt: new Date(Date.now() - 3600000), // 1 hour ago
                credentialData: {
                    eventName: 'Tech Conference 2024',
                    attendanceDate: '2024-01-14'
                }
            }
        ];
        
        // Transform data for Zapier
        const zapierData = credentials.map(credential => ({
            id: credential.id,
            recipient_email: credential.recipientEmail,
            recipient_name: credential.recipientName,
            template_id: credential.templateId,
            template_name: credential.templateName,
            status: credential.status,
            issued_at: credential.issuedAt.toISOString(),
            credential_data: credential.credentialData,
            verification_url: `${process.env.BASE_URL}/verify/${credential.id}`
        }));
        
        res.json(zapierData);
        
    } catch (error) {
        console.error('Zapier poll error:', error);
        res.status(500).json([]);
    }
});

/**
 * @swagger
 * /api/zapier/triggers/credential-verified/poll:
 *   get:
 *     summary: Poll for recent credential verified events
 *     tags: [Zapier Integration]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Recent credential verification events
 */
router.get('/triggers/credential-verified/poll', zapierLimiter, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // Mock verification events
        const verifications = [
            {
                id: 'verify_123',
                credentialId: 'cred_123',
                recipientEmail: 'john@example.com',
                verifiedAt: new Date(),
                verifierIP: '192.168.1.1',
                templateName: 'Course Completion Certificate'
            }
        ];
        
        // Transform data for Zapier
        const zapierData = verifications.map(verification => ({
            id: verification.id,
            credential_id: verification.credentialId,
            recipient_email: verification.recipientEmail,
            verified_at: verification.verifiedAt.toISOString(),
            verifier_ip: verification.verifierIP,
            template_name: verification.templateName
        }));
        
        res.json(zapierData);
        
    } catch (error) {
        console.error('Zapier verification poll error:', error);
        res.status(500).json([]);
    }
});

/**
 * @swagger
 * /api/zapier/actions/create-credential:
 *   post:
 *     summary: Create credential action for Zapier
 *     tags: [Zapier Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient_email
 *               - template_id
 *             properties:
 *               recipient_email:
 *                 type: string
 *                 format: email
 *               recipient_name:
 *                 type: string
 *               template_id:
 *                 type: string
 *               credential_data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Credential created successfully
 */
router.post('/actions/create-credential', zapierLimiter, async (req, res) => {
    try {
        const { 
            recipient_email, 
            recipient_name, 
            template_id, 
            credential_data = {} 
        } = req.body;
        
        if (!recipient_email || !template_id) {
            return res.status(400).json({
                success: false,
                message: 'recipient_email and template_id are required'
            });
        }
        
        // Create credential
        const credential = {
            id: `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            recipientEmail: recipient_email,
            recipientName: recipient_name || recipient_email.split('@')[0],
            templateId: template_id,
            credentialData: credential_data,
            status: 'issued',
            issuedAt: new Date(),
            verificationId: `verify_${Math.random().toString(36).substr(2, 16)}`
        };
        
        // Save credential to database
        // const savedCredential = await Credential.create(credential);
        
        // Transform response for Zapier
        const zapierResponse = {
            id: credential.id,
            recipient_email: credential.recipientEmail,
            recipient_name: credential.recipientName,
            template_id: credential.templateId,
            status: credential.status,
            issued_at: credential.issuedAt.toISOString(),
            verification_url: `${process.env.BASE_URL}/verify/${credential.verificationId}`,
            credential_data: credential.credentialData
        };
        
        res.status(201).json(zapierResponse);
        
    } catch (error) {
        console.error('Zapier create credential error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create credential',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/zapier/lists/templates:
 *   get:
 *     summary: List templates for Zapier dropdown
 *     tags: [Zapier Integration]
 *     responses:
 *       200:
 *         description: List of templates formatted for Zapier
 */
router.get('/lists/templates', zapierLimiter, async (req, res) => {
    try {
        // Fetch templates from database
        // const templates = await Template.find({ isActive: true });
        
        // Mock templates
        const templates = [
            {
                id: 'template_123',
                name: 'Course Completion Certificate'
            },
            {
                id: 'template_456',
                name: 'Event Attendance Badge'
            },
            {
                id: 'template_789',
                name: 'Skills Assessment Certificate'
            }
        ];
        
        // Format for Zapier dropdown
        const zapierOptions = templates.map(template => ({
            id: template.id,
            name: template.name
        }));
        
        res.json(zapierOptions);
        
    } catch (error) {
        console.error('Zapier templates list error:', error);
        res.status(500).json([]);
    }
});

export default router;

