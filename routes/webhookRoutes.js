// routes/webhookRoutes.js
import express from "express";
import crypto from "crypto";
import axios from "axios";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for webhook operations
const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: {
        success: false,
        message: 'Too many webhook requests, please try again later.'
    }
});

// Available webhook events
export const WEBHOOK_EVENTS = {
    CREDENTIAL_ISSUED: 'credential.issued',
    CREDENTIAL_VERIFIED: 'credential.verified',
    CREDENTIAL_REVOKED: 'credential.revoked',
    EVENT_CREATED: 'event.created',
    PARTICIPANT_REGISTERED: 'participant.registered'
};

/**
 * @swagger
 * /api/webhooks/configure:
 *   post:
 *     summary: Configure webhook settings
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 description: The webhook endpoint URL
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [credential.issued, credential.verified, credential.revoked, event.created, participant.registered]
 *                 description: Events to subscribe to
 *               secret:
 *                 type: string
 *                 description: Secret for webhook signature verification
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Webhook configured successfully
 */
router.post('/configure', webhookLimiter, async (req, res) => {
    try {
        const { webhookUrl, events = [], secret, isActive = true } = req.body;
        
        // Validate webhook URL
        if (!webhookUrl || !isValidUrl(webhookUrl)) {
            return res.status(400).json({
                success: false,
                message: 'Valid webhook URL is required'
            });
        }
        
        // Validate events
        const validEvents = Object.values(WEBHOOK_EVENTS);
        const invalidEvents = events.filter(event => !validEvents.includes(event));
        if (invalidEvents.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid events: ${invalidEvents.join(', ')}`,
                validEvents
            });
        }
        
        // Generate secret if not provided
        const webhookSecret = secret || crypto.randomBytes(32).toString('hex');
        
        // Save webhook configuration to database
        const webhookConfig = {
            organizationId: req.user.organizationId,
            webhookUrl,
            events,
            secret: webhookSecret,
            isActive,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastTriggered: null,
            successCount: 0,
            failureCount: 0
        };
        
        // Save to database (implement based on your schema)
        // const savedWebhook = await WebhookConfig.findOneAndUpdate(
        //     { organizationId: req.user.organizationId },
        //     webhookConfig,
        //     { upsert: true, new: true }
        // );
        
        res.json({
            success: true,
            message: 'Webhook configured successfully',
            data: {
                webhookUrl,
                events,
                secret: webhookSecret,
                isActive
            }
        });
        
    } catch (error) {
        console.error('Webhook configuration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to configure webhook',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/webhooks/test:
 *   post:
 *     summary: Test webhook endpoint
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Webhook test successful
 */
router.post('/test', webhookLimiter, async (req, res) => {
    try {
        const { webhookUrl } = req.body;
        
        if (!webhookUrl || !isValidUrl(webhookUrl)) {
            return res.status(400).json({
                success: false,
                message: 'Valid webhook URL is required'
            });
        }
        
        const testPayload = {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            data: {
                message: 'This is a test webhook from SifaPass',
                organizationId: req.user.organizationId
            }
        };
        
        // Send test webhook
        const response = await sendWebhook(webhookUrl, testPayload, 'test_secret');
        
        res.json({
            success: true,
            message: 'Webhook test completed',
            data: {
                status: response.status,
                statusText: response.statusText,
                responseTime: response.responseTime
            }
        });
        
    } catch (error) {
        console.error('Webhook test error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook test failed',
            error: error.response?.data || error.message
        });
    }
});

/**
 * @swagger
 * /api/webhooks/status:
 *   get:
 *     summary: Get webhook configuration status
 *     tags: [Webhooks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Webhook status retrieved successfully
 */
router.get('/status', async (req, res) => {
    try {
        // Fetch webhook configuration from database
        // const webhookConfig = await WebhookConfig.findOne({
        //     organizationId: req.user.organizationId
        // });
        
        // Mock response for now
        const webhookConfig = {
            webhookUrl: 'https://example.com/webhook',
            events: ['credential.issued', 'credential.verified'],
            isActive: true,
            lastTriggered: new Date('2024-01-15'),
            successCount: 45,
            failureCount: 2
        };
        
        res.json({
            success: true,
            data: webhookConfig
        });
        
    } catch (error) {
        console.error('Webhook status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get webhook status',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/webhooks/events:
 *   get:
 *     summary: Get available webhook events
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: Available webhook events
 */
router.get('/events', (req, res) => {
    const eventDescriptions = {
        [WEBHOOK_EVENTS.CREDENTIAL_ISSUED]: 'Triggered when a new credential is issued to a recipient',
        [WEBHOOK_EVENTS.CREDENTIAL_VERIFIED]: 'Triggered when a credential is verified by a third party',
        [WEBHOOK_EVENTS.CREDENTIAL_REVOKED]: 'Triggered when a credential is revoked or cancelled',
        [WEBHOOK_EVENTS.EVENT_CREATED]: 'Triggered when a new event is created',
        [WEBHOOK_EVENTS.PARTICIPANT_REGISTERED]: 'Triggered when a new participant registers for an event'
    };
    
    res.json({
        success: true,
        data: {
            events: Object.keys(eventDescriptions).map(event => ({
                event,
                description: eventDescriptions[event]
            }))
        }
    });
});

// Function to send webhook notifications
export const sendWebhook = async (webhookUrl, payload, secret) => {
    const startTime = Date.now();
    
    try {
        // Create signature for webhook verification
        const signature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        const response = await axios.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-SifaPass-Signature': `sha256=${signature}`,
                'X-SifaPass-Event': payload.event,
                'User-Agent': 'SifaPass-Webhook/1.0'
            },
            timeout: 10000 // 10 second timeout
        });
        
        return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            responseTime: Date.now() - startTime
        };
        
    } catch (error) {
        throw {
            success: false,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseTime: Date.now() - startTime,
            error: error.response?.data || error.message
        };
    }
};

// Function to trigger webhooks for specific events
export const triggerWebhook = async (eventType, data, organizationId) => {
    try {
        // Fetch webhook configuration from database
        // const webhookConfig = await WebhookConfig.findOne({
        //     organizationId,
        //     isActive: true,
        //     events: { $in: [eventType] }
        // });
        
        // Mock configuration for now
        const webhookConfig = {
            webhookUrl: 'https://example.com/webhook',
            events: ['credential.issued', 'credential.verified'],
            secret: 'test_secret',
            isActive: true
        };
        
        if (!webhookConfig || !webhookConfig.events.includes(eventType)) {
            return; // No webhook configured for this event
        }
        
        const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            organizationId,
            data
        };
        
        const result = await sendWebhook(webhookConfig.webhookUrl, payload, webhookConfig.secret);
        
        // Update webhook statistics
        // await WebhookConfig.findByIdAndUpdate(webhookConfig._id, {
        //     lastTriggered: new Date(),
        //     $inc: { successCount: 1 }
        // });
        
        console.log('Webhook sent successfully:', eventType);
        
    } catch (error) {
        console.error('Webhook trigger error:', error);
        
        // Update failure count
        // await WebhookConfig.findOneAndUpdate(
        //     { organizationId, isActive: true },
        //     { $inc: { failureCount: 1 } }
        // );
    }
};

// Helper function to validate URLs
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

export default router;