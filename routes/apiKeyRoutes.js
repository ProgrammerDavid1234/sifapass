// routes/apiKeyRoutes.js
import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for API key operations
const apiKeyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Very restrictive for API key operations
    message: {
        success: false,
        message: 'Too many API key requests, please try again later.'
    }
});

// Middleware to verify admin/organization access
const verifyAdminAccess = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        
        // Verify admin or organization owner
        if (!req.user.isAdmin && !req.user.organizationId) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

/**
 * @swagger
 * /api/api-keys/generate:
 *   post:
 *     summary: Generate new API key
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the API key
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of permissions for this key
 *               expiresIn:
 *                 type: string
 *                 description: Expiration time (e.g., '30d', '1y')
 *     responses:
 *       201:
 *         description: API key generated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/generate', apiKeyLimiter, verifyAdminAccess, async (req, res) => {
    try {
        const { name, permissions = ['read', 'write'], expiresIn = '1y' } = req.body;
        
        // Generate API key
        const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
        const hashedKey = await bcrypt.hash(apiKey, 10);
        
        // Calculate expiration date
        const expirationDate = new Date();
        if (expiresIn.endsWith('d')) {
            expirationDate.setDate(expirationDate.getDate() + parseInt(expiresIn));
        } else if (expiresIn.endsWith('y')) {
            expirationDate.setFullYear(expirationDate.getFullYear() + parseInt(expiresIn));
        } else if (expiresIn.endsWith('m')) {
            expirationDate.setMonth(expirationDate.getMonth() + parseInt(expiresIn));
        }
        
        // Store in database (you'll need to create an ApiKey model)
        const apiKeyRecord = {
            name,
            keyHash: hashedKey,
            permissions,
            organizationId: req.user.organizationId,
            userId: req.user.id,
            expiresAt: expirationDate,
            isActive: true,
            createdAt: new Date(),
            lastUsed: null,
            usageCount: 0
        };
        
        // Save to database (implement based on your database schema)
        // const savedKey = await ApiKey.create(apiKeyRecord);
        
        res.status(201).json({
            success: true,
            message: 'API key generated successfully',
            data: {
                apiKey, // Only return once during creation
                name,
                permissions,
                expiresAt: expirationDate,
                keyId: 'generated_key_id' // Replace with actual ID from database
            }
        });
        
    } catch (error) {
        console.error('API key generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate API key',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: List all API keys for organization
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 */
router.get('/', verifyAdminAccess, async (req, res) => {
    try {
        // Fetch API keys from database (implement based on your schema)
        const apiKeys = [
            {
                id: 'key_1',
                name: 'Production API Key',
                permissions: ['read', 'write'],
                isActive: true,
                expiresAt: new Date('2025-12-31'),
                createdAt: new Date('2024-01-01'),
                lastUsed: new Date(),
                usageCount: 1250
            }
        ];
        
        res.json({
            success: true,
            data: apiKeys
        });
        
    } catch (error) {
        console.error('API keys fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch API keys',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/api-keys/{keyId}/revoke:
 *   post:
 *     summary: Revoke an API key
 *     tags: [API Keys]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key revoked successfully
 */
router.post('/:keyId/revoke', verifyAdminAccess, async (req, res) => {
    try {
        const { keyId } = req.params;
        
        // Update API key in database to set isActive: false
        // const updatedKey = await ApiKey.findByIdAndUpdate(keyId, { isActive: false });
        
        res.json({
            success: true,
            message: 'API key revoked successfully'
        });
        
    } catch (error) {
        console.error('API key revocation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke API key',
            error: error.message
        });
    }
});

// Middleware to verify API key for external API requests
export const verifyApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                message: 'API key required'
            });
        }
        
        if (!apiKey.startsWith('sk_')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key format'
            });
        }
        
        // Verify API key against database
        // const apiKeyRecord = await ApiKey.findOne({ where: { isActive: true } });
        // const isValid = await bcrypt.compare(apiKey, apiKeyRecord.keyHash);
        
        // For now, we'll simulate validation
        const isValid = true; // Replace with actual validation
        
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }
        
        // Update last used timestamp and usage count
        // await ApiKey.findByIdAndUpdate(apiKeyRecord.id, {
        //     lastUsed: new Date(),
        //     $inc: { usageCount: 1 }
        // });
        
        req.apiKey = {
            id: 'key_id',
            permissions: ['read', 'write'],
            organizationId: 'org_id'
        };
        
        next();
        
    } catch (error) {
        console.error('API key verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid API key'
        });
    }
};

export default router;