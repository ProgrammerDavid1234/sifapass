import Credential from "../models/Credentials.js";
import CredentialTemplate from "../models/CredentialTemplate.js";
import QRCode from "qrcode";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import mongoose from 'mongoose';

/**
 * Configure Cloudinary
 */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Create or Import Credential
 */
export const createCredential = async (req, res) => {
    try {
        const { participantId, eventId, title, type } = req.body;

        // Validate required fields
        if (!participantId || !eventId || !title || !type) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        if (!["certificate", "badge"].includes(type)) {
            return res
                .status(400)
                .json({ message: "Type must be 'certificate' or 'badge'" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "File upload is required" });
        }

        // Upload to Cloudinary using buffer
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { resource_type: "auto", folder: "credentials" },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        const downloadLink = uploadResult.secure_url;

        // Generate blockchain hash
        const blockchainHash = crypto
            .createHash("sha256")
            .update(
                JSON.stringify({ participantId, eventId, title, type }) + Date.now()
            )
            .digest("hex");

        // Generate QR code from hash
        const qrCode = await QRCode.toDataURL(`https://sifapass.onrender.com/verify/${blockchainHash}`);

        // Save to DB
        const credential = await Credential.create({
            participantId,
            eventId,
            title,
            type,
            downloadLink,
            blockchainHash,
            qrCode,
            issuedBy: req.user.id
        });

        res
            .status(201)
            .json({ message: `${type} created successfully`, credential });
    } catch (error) {
        console.error("CreateCredential Error:", error);
        res
            .status(500)
            .json({ message: "Failed to create credential", error: error.message });
    }
};

/**
 * Create Credential with Custom Design
 */
export const createCredentialWithDesign = async (req, res) => {
    try {
        const {
            participantId,
            eventId,
            title,
            type,
            templateId,
            designData,
            participantData,
        } = req.body;

        // Validate required fields
        if (!participantId || !eventId || !title || !type) {
            return res.status(400).json({
                message: "Missing required fields: participantId, eventId, title, type"
            });
        }

        // Generate blockchain hash
        const blockchainHash = crypto
            .createHash("sha256")
            .update(JSON.stringify({ participantId, eventId, title, type }) + Date.now())
            .digest("hex");

        // Generate QR code
        const verificationUrl = `${process.env.FRONTEND_URL}/verify/${blockchainHash}`;
        const qrCode = await QRCode.toDataURL(verificationUrl);

        // Save credential
        const credential = await Credential.create({
            participantId,
            eventId,
            title,
            type,
            templateId,
            designData: designData || {},
            blockchainHash,
            qrCode,
            verificationUrl,
            participantData: participantData || {},
            issuedBy: req.user.id
        });

        res.status(201).json({
            success: true,
            message: `${type} created successfully`,
            credential
        });
    } catch (error) {
        console.error("Create Credential Error:", error);
        res.status(500).json({
            message: "Failed to create credential",
            error: error.message
        });
    }
};

/**
 * Get All Credentials (for user)
 */
export const getCredentials = async (req, res) => {
    try {
        const credentials = await Credential.find({ userId: req.user.id });
        res.json({ success: true, credentials });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get My Credentials (for participant)
 */
export const getMyCredentials = async (req, res) => {
    try {
        const participantId = req.user.id;

        const credentials = await Credential.find({ participantId })
            .populate("eventId", "title startDate location")
            .sort({ createdAt: -1 });

        res.status(200).json(credentials);
    } catch (error) {
        console.error("Get My Credentials Error:", error);
        res.status(500).json({
            message: "Failed to fetch credentials",
            error: error.message
        });
    }
};

/**
 * Get Admin Credentials
 */
export const getAdminCredentials = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { type, limit = 50, offset = 0 } = req.query;

        console.log('Fetching credentials for admin:', adminId);

        // Build query to find credentials created by this admin
        let query = { createdBy: adminId };

        // Add type filter if specified
        if (type) {
            query.type = type;
        }

        console.log('Query:', query);

        // Find credentials with populated data
        const credentials = await Credential.find(query)
            .populate({
                path: 'participantId',
                select: 'fullName name email'
            })
            .populate({
                path: 'eventId',
                select: 'title name startDate endDate'
            })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        console.log(`Found ${credentials.length} credentials`);

        // Transform the data for frontend consumption
        const transformedCredentials = credentials.map(credential => ({
            _id: credential._id,
            id: credential._id,
            title: credential.title,
            description: credential.description,
            type: credential.type || credential.credentialType,
            status: credential.status,
            participantName: credential.participantId?.fullName || credential.participantId?.name || 'Unknown',
            participantEmail: credential.participantId?.email,
            eventTitle: credential.eventId?.title || credential.eventId?.name || 'Unknown Event',
            eventDate: credential.eventId?.startDate || credential.eventId?.endDate,
            issuedAt: credential.issuedAt,
            createdAt: credential.createdAt,
            updatedAt: credential.updatedAt,
            lastModified: credential.updatedAt || credential.createdAt,
            designData: credential.designData,
            participantData: credential.participantData,
            verificationUrl: credential.verificationUrl,
            downloadUrl: credential.downloadUrl
        }));

        // Get total count for pagination
        const totalCount = await Credential.countDocuments(query);

        res.status(200).json({
            success: true,
            credentials: transformedCredentials,
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + credentials.length) < totalCount
        });

    } catch (error) {
        console.error('Error fetching admin credentials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credentials',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get Credential Statistics
 */
export const getCredentialStats = async (req, res) => {
    try {
        const totalCredentials = await Credential.countDocuments();

        // Group by event
        const perEvent = await Credential.aggregate([
            { $group: { _id: "$eventId", count: { $sum: 1 } } }
        ]);

        res.json({ totalCredentials, perEvent });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch stats", error: err.message });
    }
};

/**
 * Update Credential
 */
export const updateCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const credential = await Credential.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true }
        );

        if (!credential) return res.status(404).json({ success: false, message: "Credential not found" });

        res.json({ success: true, credential });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Edit Credential
 */
export const editCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, password, description } = req.body;

        const updatedCredential = await Credential.findByIdAndUpdate(
            id,
            { name, username, password, description },
            { new: true }
        );

        if (!updatedCredential) {
            return res.status(404).json({ message: 'Credential not found' });
        }

        res.status(200).json({
            message: 'Credential updated successfully',
            data: updatedCredential
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error updating credential',
            error: error.message
        });
    }
};

/**
 * Share Credential
 */
export const shareCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body;

        const credential = await Credential.findByIdAndUpdate(
            id,
            { $addToSet: { sharedWith: { $each: userIds } } },
            { new: true }
        );

        if (!credential) return res.status(404).json({ success: false, message: "Credential not found" });

        res.json({ success: true, credential });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verify Credential
 */
export const verifyCredential = async (req, res) => {
    try {
        const { hash } = req.query;

        const credential = await Credential.findOne({ blockchainHash: hash });
        if (!credential) {
            return res.status(404).json({ success: false, message: "Invalid or tampered credential" });
        }

        res.json({ success: true, message: "Credential verified successfully", credential });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Customize Credential
 */
export const customizeCredential = async (req, res) => {
    try {
        const credential = await Credential.findById(req.params.id);
        if (!credential) return res.status(404).json({ message: "Not found" });

        credential.customData = req.body.customData || credential.customData;
        await credential.save();

        res.status(200).json({ message: "Credential customized", credential });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

/**
 * Get Default Template
 */
export const getDefaultTemplate = async (req, res) => {
    try {
        const defaultTemplate = {
            title: "New Credential",
            description: "Enter your credential details here...",
            fields: [
                { label: "Full Name", type: "text", required: true },
                { label: "Email", type: "email", required: true },
                { label: "Phone Number", type: "text", required: false },
                { label: "Address", type: "text", required: false }
            ],
            createdAt: new Date(),
        };

        return res.status(200).json({
            success: true,
            message: "Default template fetched successfully",
            data: defaultTemplate,
        });
    } catch (error) {
        console.error("Error fetching default template:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch default template",
            error: error.message,
        });
    }
};

/**
 * Import Credential
 */
export const importCredential = async (req, res) => {
    try {
        const { user_id, credentials } = req.body;

        if (!user_id || !Array.isArray(credentials)) {
            return res.status(400).json({ error: "Invalid input format" });
        }

        const values = credentials.map(c => [user_id, c.service_name, c.username, c.password]);

        if (values.length === 0) {
            return res.status(400).json({ error: "No credentials to import" });
        }

        // Note: This seems to be using MySQL syntax. 
        // You may need to adapt this for MongoDB
        await pool.query(
            "INSERT INTO credentials (user_id, service_name, username, password) VALUES ?",
            [values]
        );

        res.status(201).json({
            message: "Credentials imported successfully",
            count: values.length
        });
    } catch (error) {
        console.error("Error importing credentials:", error);
        res.status(500).json({ error: "Server error" });
    }
};

/**
 * Reconcile Certificates
 */
export const reconcileCertificates = async (req, res) => {
    try {
        const { participantId, credentialId } = req.body;

        const cred = await Credential.findById(credentialId);
        if (!cred) return res.status(404).json({ message: "Credential not found" });

        if (String(cred.participant) !== participantId) {
            cred.participant = participantId;
            await cred.save();
        }

        res.json({ message: "Certificate reconciled", credential: cred });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==================== TEMPLATE FUNCTIONALITY ====================

/**
 * Create Template
 */
export const createTemplate = async (req, res) => {
    try {
        const {
            name,
            type,
            designData,
            backgroundSettings,
            contentSettings,
            verificationSettings
        } = req.body;

        if (!name || !type || !designData) {
            return res.status(400).json({
                message: "Missing required fields: name, type, designData"
            });
        }

        const template = await CredentialTemplate.create({
            name,
            type,
            designData: {
                elements: designData.elements || [],
                canvas: designData.canvas || { width: 800, height: 600 },
                background: backgroundSettings || {},
                content: contentSettings || {},
                verification: verificationSettings || {}
            },
            createdBy: req.user.id
        });

        res.status(201).json({
            success: true,
            message: "Template created successfully",
            template
        });
    } catch (error) {
        console.error("Create Template Error:", error);
        res.status(500).json({
            message: "Failed to create template",
            error: error.message
        });
    }
};

/**
 * Get All Templates
 */
export const getTemplates = async (req, res) => {
    try {
        const { type } = req.query;
        const filter = type ? { type } : {};

        const templates = await CredentialTemplate.find(filter)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            templates
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch templates",
            error: error.message
        });
    }
};

/**
 * Get Single Template
 */
export const getTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await CredentialTemplate.findById(id)
            .populate('createdBy', 'name email');

        if (!template) {
            return res.status(404).json({ message: "Template not found" });
        }

        res.json({
            success: true,
            template
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch template",
            error: error.message
        });
    }
};

/**
 * Update Template
 */
export const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const template = await CredentialTemplate.findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: Date.now() },
            { new: true }
        );

        if (!template) {
            return res.status(404).json({ message: "Template not found" });
        }

        res.json({
            success: true,
            message: "Template updated successfully",
            template
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update template",
            error: error.message
        });
    }
};

/**
 * Save Design Progress
 */
export const saveDesignProgress = async (req, res) => {
    try {
        const { templateId, designData } = req.body;

        if (templateId) {
            await CredentialTemplate.findByIdAndUpdate(templateId, {
                designData,
                updatedAt: Date.now()
            });
        }

        res.json({
            success: true,
            message: "Design saved successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to save design",
            error: error.message
        });
    }
};

/**
 * Preview Credential
 */
export const previewCredential = async (req, res) => {
    try {
        const { designData, participantData = {} } = req.body;

        const previewHtml = generateCredentialHTML(designData, participantData);

        res.json({
            success: true,
            previewHtml
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to generate preview",
            error: error.message
        });
    }
};

// ==================== EXPORT FUNCTIONALITY ====================

/**
 * Export Credential as PDF (Enhanced)
 */
export const exportCredentialPDF = async (req, res) => {
    try {
        const { designData, participantData, credentialId, method = 'puppeteer' } = req.body;

        if (!participantData || !participantData.name) {
            return res.status(400).json({
                success: false,
                message: "Participant data is required"
            });
        }

        let pdfBuffer;

        if (method === 'pdfkit') {
            // Use PDFKit for simple layouts
            pdfBuffer = await generatePDFWithPDFKit(designData, participantData, credentialId);
        } else {
            // Use Puppeteer for complex HTML layouts (default)
            const html = generateCredentialHTML(designData, participantData);
            pdfBuffer = await generatePDFFromHTML(html);
        }

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: "raw", folder: "credentials/exports", format: "pdf" },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(pdfBuffer);
        });

        // Update credential with export link
        if (credentialId && mongoose.Types.ObjectId.isValid(credentialId)) {
            await Credential.findByIdAndUpdate(credentialId, {
                $set: { "exportLinks.pdf": uploadResult.secure_url }
            });
        }

        res.json({
            success: true,
            exportUrl: uploadResult.secure_url,
            message: "PDF exported successfully"
        });

    } catch (error) {
        console.error('PDF Export Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export PDF',
            error: error.message
        });
    }
};

/**
 * Export Credential as PNG (Enhanced)
 */
export const exportCredentialPNG = async (req, res) => {
    try {
        console.log('Starting PNG export...');
        const { designData, participantData, credentialId, method = 'canvas' } = req.body;

        if (!designData) {
            return res.status(400).json({
                success: false,
                message: "Design data is required"
            });
        }

        if (!participantData) {
            return res.status(400).json({
                success: false,
                message: "Participant data is required"
            });
        }

        console.log('Export method:', method);
        let pngBuffer;

        try {
            if (method === 'canvas') {
                // Use Canvas for simple layouts - more reliable
                console.log('Using Canvas method for PNG generation...');
                pngBuffer = await generatePNGWithCanvas(designData, participantData, credentialId);
            } else {
                // Use Puppeteer for complex HTML layouts (fallback)
                console.log('Using Puppeteer method for PNG generation...');
                const html = generateCredentialHTML(designData, participantData);
                pngBuffer = await generatePNGFromHTML(html);
            }
        } catch (generationError) {
            console.error('PNG generation failed with method:', method, generationError);

            // Try fallback method if the primary method fails
            if (method === 'puppeteer') {
                console.log('Puppeteer failed, trying Canvas fallback...');
                try {
                    pngBuffer = await generatePNGWithCanvas(designData, participantData, credentialId);
                } catch (canvasError) {
                    console.error('Canvas fallback also failed:', canvasError);
                    throw new Error(`Both PNG generation methods failed. Puppeteer: ${generationError.message}, Canvas: ${canvasError.message}`);
                }
            } else {
                console.log('Canvas failed, trying Puppeteer fallback...');
                try {
                    const html = generateCredentialHTML(designData, participantData);
                    pngBuffer = await generatePNGFromHTML(html);
                } catch (puppeteerError) {
                    console.error('Puppeteer fallback also failed:', puppeteerError);
                    throw new Error(`Both PNG generation methods failed. Canvas: ${generationError.message}, Puppeteer: ${puppeteerError.message}`);
                }
            }
        }

        if (!pngBuffer || pngBuffer.length === 0) {
            throw new Error('Generated PNG buffer is empty');
        }

        console.log('PNG generated successfully, size:', pngBuffer.length, 'bytes');

        // Upload to Cloudinary with timeout handling and retry logic
        let uploadResult;
        const maxRetries = 2;
        let retryCount = 0;

        while (retryCount <= maxRetries) {
            try {
                uploadResult = await Promise.race([
                    new Promise((resolve, reject) => {
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: "image",
                                folder: "credentials/exports",
                                format: "png",
                                timeout: 60000,
                                public_id: `credential_${credentialId}_${Date.now()}`, // Unique identifier
                                overwrite: true
                            },
                            (error, result) => {
                                if (error) {
                                    console.error('Cloudinary upload error:', error);
                                    return reject(error);
                                }
                                resolve(result);
                            }
                        ).end(pngBuffer);
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Cloudinary upload timeout')), 70000)
                    )
                ]);

                console.log('Cloudinary upload successful:', uploadResult.secure_url);
                break; // Success, exit retry loop

            } catch (uploadError) {
                retryCount++;
                console.error(`Cloudinary upload attempt ${retryCount} failed:`, uploadError.message);

                if (retryCount > maxRetries) {
                    // If Cloudinary fails completely, try to return the buffer directly
                    console.log('All Cloudinary upload attempts failed, returning buffer directly');

                    res.set({
                        'Content-Type': 'image/png',
                        'Content-Disposition': `attachment; filename="${participantData.name || 'credential'}.png"`,
                        'Content-Length': pngBuffer.length
                    });

                    return res.send(pngBuffer);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }

        // Update credential with export link if upload was successful
        if (credentialId && mongoose.Types.ObjectId.isValid(credentialId) && uploadResult) {
            try {
                await Credential.findByIdAndUpdate(credentialId, {
                    $set: {
                        "exportLinks.png": uploadResult.secure_url,
                        "lastExported": new Date(),
                        "exportCount": { $inc: 1 }
                    }
                }, { upsert: false });
                console.log('Credential updated with export link');
            } catch (updateError) {
                console.error('Failed to update credential:', updateError);
                // Don't fail the entire request if credential update fails
            }
        }

        res.json({
            success: true,
            exportUrl: uploadResult.secure_url,
            message: "PNG exported successfully",
            fileSize: pngBuffer.length,
            method: method,
            uploadProvider: 'cloudinary'
        });

    } catch (error) {
        console.error("PNG Export Error:", error);

        // Provide more specific error messages
        let errorMessage = "Failed to export PNG";
        let statusCode = 500;

        if (error.message.includes('Design data is required')) {
            statusCode = 400;
        } else if (error.message.includes('Participant data is required')) {
            statusCode = 400;
        } else if (error.message.includes('require is not defined')) {
            errorMessage = "Server configuration error. PNG generation is temporarily unavailable.";
        } else if (error.message.includes('Browser was not found')) {
            errorMessage = "PDF/PNG generation service is temporarily unavailable. Please try again later.";
        } else if (error.message.includes('timeout')) {
            errorMessage = "PNG generation timed out. Please try again with a simpler design.";
        } else if (error.message.includes('Both PNG generation methods failed')) {
            errorMessage = "PNG generation is currently unavailable. Please try again later or contact support.";
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};


/**
 * Export Credential as JPEG (Enhanced)
 */
export const exportCredentialJPEG = async (req, res) => {
    try {
        const { designData, participantData, credentialId, method = 'puppeteer' } = req.body;

        if (!participantData || !participantData.name) {
            return res.status(400).json({
                success: false,
                message: "Participant data is required"
            });
        }

        let jpegBuffer;

        if (method === 'canvas') {
            // Use Canvas for simple layouts
            jpegBuffer = await generateJPEGWithCanvas(designData, participantData, credentialId);
        } else {
            // Use Puppeteer for complex HTML layouts (default)
            const html = generateCredentialHTML(designData, participantData);
            jpegBuffer = await generateJPEGFromHTML(html);
        }

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: "image", folder: "credentials/exports", format: "jpg" },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(jpegBuffer);
        });

        // Update credential with export link
        if (credentialId && mongoose.Types.ObjectId.isValid(credentialId)) {
            await Credential.findByIdAndUpdate(credentialId, {
                $set: { "exportLinks.jpeg": uploadResult.secure_url }
            });
        }

        res.json({
            success: true,
            exportUrl: uploadResult.secure_url,
            message: "JPEG exported successfully"
        });

    } catch (error) {
        console.error("JPEG Export Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export JPEG",
            error: error.message
        });
    }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate HTML from Design Data
 */
function generateCredentialHTML(designData, participantData = {}) {
    try {
        console.log('Generating HTML for credential...');

        if (!designData || typeof designData !== 'object') {
            throw new Error('Invalid design data provided');
        }

        const { elements = [], canvas = {}, background = {} } = designData;
        const canvasWidth = canvas.width || 800;
        const canvasHeight = canvas.height || 600;

        let backgroundStyle = '';
        if (background.type === 'gradient') {
            const direction = background.gradientDirection || 'to right';
            const primary = background.primaryColor || '#ffffff';
            const secondary = background.secondaryColor || '#f0f0f0';
            backgroundStyle = `background: linear-gradient(${direction}, ${primary}, ${secondary});`;
        } else if (background.type === 'solid') {
            backgroundStyle = `background-color: ${background.color || background.primaryColor || '#ffffff'};`;
        } else if (background.type === 'image' && background.imageUrl) {
            backgroundStyle = `background-image: url('${background.imageUrl}'); background-size: cover; background-position: center;`;
        } else {
            backgroundStyle = 'background-color: #ffffff;';
        }

        let elementsHtml = '';
        elements.forEach((element, index) => {
            try {
                let content = element.content || '';

                // Replace placeholders with participant data
                content = content.replace(/\{\{participantName\}\}/g, participantData.name || 'John Doe');
                content = content.replace(/\{\{eventTitle\}\}/g, participantData.eventTitle || 'Sample Event');
                content = content.replace(/\{\{eventDate\}\}/g, participantData.eventDate || new Date().toLocaleDateString());
                content = content.replace(/\{\{skills\}\}/g, participantData.skills || 'Sample Skills');

                const elementStyle = `
                    position: absolute;
                    left: ${element.x || 0}px;
                    top: ${element.y || 0}px;
                    width: ${element.width || 'auto'}px;
                    height: ${element.height || 'auto'}px;
                    font-family: ${element.fontFamily || 'Arial, sans-serif'};
                    font-size: ${element.fontSize || 16}px;
                    font-weight: ${element.fontWeight || 'normal'};
                    color: ${element.color || '#000000'};
                    text-align: ${element.textAlign || 'left'};
                    z-index: ${element.zIndex || 1};
                    box-sizing: border-box;
                `;

                if (element.type === 'text') {
                    elementsHtml += `<div style="${elementStyle}">${content}</div>`;
                } else if (element.type === 'image' && element.src) {
                    elementsHtml += `<img src="${element.src}" style="${elementStyle}" alt="${element.alt || ''}" />`;
                } else if (element.type === 'qrcode' && element.qrCodeUrl) {
                    elementsHtml += `<div style="${elementStyle}"><img src="${element.qrCodeUrl}" alt="QR Code" style="width: 100%; height: 100%;" /></div>`;
                }
            } catch (elementError) {
                console.error(`Error processing element ${index}:`, elementError);
            }
        });

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: Arial, sans-serif;
                        width: ${canvasWidth}px;
                        height: ${canvasHeight}px;
                        overflow: hidden;
                    }
                    .credential-container {
                        position: relative;
                        width: ${canvasWidth}px;
                        height: ${canvasHeight}px;
                        ${backgroundStyle}
                        overflow: hidden;
                    }
                </style>
            </head>
            <body>
                <div class="credential-container">
                    ${elementsHtml}
                </div>
            </body>
            </html>
        `;

        return htmlContent;
    } catch (error) {
        console.error('HTML Generation Error:', error);
        throw new Error(`Failed to generate HTML: ${error.message}`);
    }
}

/**
 * Generate PNG from HTML using Puppeteer
 */
async function generatePNGFromHTML(html) {
    let browser;
    try {
        console.log('Launching Puppeteer browser...');

        const possiblePaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            process.env.PUPPETEER_EXECUTABLE_PATH,
            process.env.CHROME_BIN,
            // Render.com specific paths
            '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome',
            '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux/chrome'
        ].filter(Boolean);

        let executablePath;

        // Check if we can find Chrome
        for (const path of possiblePaths) {
            if (path.includes('*')) {
                // Handle wildcard paths
                const glob = require('glob');
                try {
                    const matches = glob.sync(path);
                    if (matches.length > 0 && fs.existsSync(matches[0])) {
                        executablePath = matches[0];
                        break;
                    }
                } catch (e) {
                    continue;
                }
            } else if (fs.existsSync(path)) {
                executablePath = path;
                break;
            }
        }

        // Configure Puppeteer options
        const puppeteerOptions = {
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-web-security",
                "--disable-features=VizDisplayCompositor"
            ],
            timeout: 30000,
            dumpio: false
        };

        if (executablePath) {
            puppeteerOptions.executablePath = executablePath;
            console.log('Using Chrome at:', executablePath);
        } else {
            console.log('No Chrome executable found, using Puppeteer default');
        }

        browser = await puppeteer.launch(puppeteerOptions);
        console.log('Browser launched successfully');

        const page = await browser.newPage();
        page.setDefaultTimeout(15000);

        console.log('Setting page content...');
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 });

        console.log('Setting viewport...');
        await page.setViewport({ width: 800, height: 600 });

        // Wait for fonts and styles
        await page.waitForTimeout(1000);

        console.log('Taking screenshot...');
        const screenshot = await page.screenshot({
            type: "png",
            fullPage: true,
            omitBackground: false,
            timeout: 10000
        });

        console.log('Screenshot taken successfully');
        return screenshot;

    } catch (error) {
        console.error('Puppeteer Error:', error);
        throw new Error(`Failed to generate PNG: ${error.message}`);
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
    }
}

/**
 * Generate JPEG from HTML using Puppeteer
 */
async function generateJPEGFromHTML(html) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.setViewport({ width: 800, height: 600 });

        const screenshot = await page.screenshot({
            type: "jpeg",
            quality: 90,
            fullPage: true,
            omitBackground: false,
        });

        return screenshot;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Generate PDF from HTML using Puppeteer
 */
async function generatePDFFromHTML(html) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdf = await page.pdf({
            format: "A4",
            landscape: true,
            printBackground: true,
            margin: {
                top: "0.5in",
                right: "0.5in",
                bottom: "0.5in",
                left: "0.5in",
            },
        });

        return pdf;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Generate PDF using PDFKit (Alternative method for simple layouts)
 */
async function generatePDFWithPDFKit(designData, participantData, credentialId) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });

            // Add background color or gradient
            if (designData?.background?.type === 'gradient') {
                doc.linearGradient(0, 0, doc.page.width, doc.page.height)
                    .stop(0, designData.background.primaryColor || '#3498db')
                    .stop(1, designData.background.secondaryColor || '#e74c3c');
                doc.rect(0, 0, doc.page.width, doc.page.height).fill();
            } else if (designData?.background?.type === 'solid') {
                doc.rect(0, 0, doc.page.width, doc.page.height)
                    .fill(designData.background.primaryColor || '#ffffff');
            }

            // Add title
            doc.fillColor('#000000')
                .fontSize(36)
                .font('Helvetica-Bold')
                .text(designData?.content?.titleText || 'Certificate of Achievement', 50, 150, {
                    width: doc.page.width - 100,
                    align: 'center'
                });

            // Add participant name
            doc.fontSize(24)
                .font('Helvetica')
                .text(`This is to certify that`, 50, 220, {
                    width: doc.page.width - 100,
                    align: 'center'
                });

            doc.fontSize(32)
                .font('Helvetica-Bold')
                .fillColor('#2c3e50')
                .text(participantData.name, 50, 260, {
                    width: doc.page.width - 100,
                    align: 'center'
                });

            // Add event description
            doc.fontSize(18)
                .font('Helvetica')
                .fillColor('#000000')
                .text(designData?.content?.eventDescription || `has successfully completed ${participantData.eventTitle || 'the event'}`, 50, 320, {
                    width: doc.page.width - 100,
                    align: 'center'
                });

            // Add date
            const date = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            doc.fontSize(14)
                .text(`Issued on ${date}`, 50, 400, {
                    width: doc.page.width - 100,
                    align: 'center'
                });

            // Add QR code if available
            if (designData?.verification?.includeQRCode !== false && credentialId) {
                QRCode.toBuffer(`Credential ID: ${credentialId}\nParticipant: ${participantData.name}\nEvent: ${participantData.eventTitle || 'N/A'}`, { width: 100 })
                    .then(qrCodeBuffer => {
                        doc.image(qrCodeBuffer, doc.page.width - 150, doc.page.height - 150, { width: 100, height: 100 });

                        // Add border
                        doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
                            .stroke('#cccccc');

                        doc.end();
                    })
                    .catch(qrError => {
                        console.error('QR code generation failed:', qrError);

                        // Add border
                        doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
                            .stroke('#cccccc');

                        doc.end();
                    });
            } else {
                // Add border
                doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
                    .stroke('#cccccc');

                doc.end();
            }

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate PNG using Canvas (Alternative method for simple layouts)
 */
const generatePNGWithCanvas = async (designData, participantData, credentialId) => {
    try {
        const { createCanvas, loadImage, registerFont } = require('canvas');

        const width = designData.canvas?.width || 1200;
        const height = designData.canvas?.height || 800;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Set high quality rendering
        ctx.antialias = 'subpixel';
        ctx.quality = 'best';

        // Clear canvas with white background first
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Apply background
        if (designData.background) {
            if (designData.background.type === 'solid') {
                ctx.fillStyle = designData.background.primaryColor || '#ffffff';
                ctx.fillRect(0, 0, width, height);
            } else if (designData.background.type === 'gradient') {
                const direction = designData.background.gradientDirection || 'to right';
                let gradient;

                // Parse gradient direction
                if (direction.includes('right')) {
                    gradient = ctx.createLinearGradient(0, 0, width, 0);
                } else if (direction.includes('left')) {
                    gradient = ctx.createLinearGradient(width, 0, 0, 0);
                } else if (direction.includes('top')) {
                    gradient = ctx.createLinearGradient(0, height, 0, 0);
                } else if (direction.includes('bottom')) {
                    gradient = ctx.createLinearGradient(0, 0, 0, height);
                } else {
                    gradient = ctx.createLinearGradient(0, 0, width, 0); // default to right
                }

                gradient.addColorStop(0, designData.background.primaryColor || '#3498db');
                gradient.addColorStop(1, designData.background.secondaryColor || '#e74c3c');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
            } else if (designData.background.type === 'image' && designData.background.backgroundImage) {
                try {
                    const bgImage = await loadImage(designData.background.backgroundImage);
                    ctx.drawImage(bgImage, 0, 0, width, height);
                } catch (imageError) {
                    console.warn('Failed to load background image:', imageError.message);
                    // Fallback to solid color
                    ctx.fillStyle = designData.background.primaryColor || '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                }
            }
        }

        // Apply text content
        const content = designData.content || {};
        const textColor = content.textColor || '#000000';
        const fontFamily = content.fontFamily?.split(',')[0]?.trim() || 'Arial';
        const baseFontSize = content.fontSize || 24;

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Title
        if (content.titleText) {
            ctx.font = `bold ${baseFontSize * 1.5}px ${fontFamily}`;
            ctx.fillText(content.titleText, width / 2, height * 0.25);
        }

        // Participant name (larger, prominent)
        if (participantData.name) {
            ctx.font = `bold ${baseFontSize * 1.2}px ${fontFamily}`;
            ctx.fillText(participantData.name, width / 2, height * 0.45);
        }

        // Event description
        if (content.eventDescription) {
            ctx.font = `${baseFontSize * 0.8}px ${fontFamily}`;
            // Word wrap for long descriptions
            const words = content.eventDescription.split(' ');
            let line = '';
            const lineHeight = baseFontSize;
            let y = height * 0.65;

            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const testWidth = ctx.measureText(testLine).width;

                if (testWidth > width * 0.8 && i > 0) {
                    ctx.fillText(line, width / 2, y);
                    line = words[i] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, width / 2, y);
        }

        // Date
        if (participantData.eventDate) {
            ctx.font = `${baseFontSize * 0.7}px ${fontFamily}`;
            const date = new Date(participantData.eventDate).toLocaleDateString();
            ctx.fillText(`Date: ${date}`, width / 2, height * 0.85);
        }

        // Add credential hash if available
        if (credentialId) {
            ctx.font = `${baseFontSize * 0.5}px monospace`;
            ctx.fillStyle = '#666666';
            ctx.fillText(`ID: ${credentialId.substring(0, 16)}...`, width / 2, height * 0.95);
        }

        // Render any custom elements
        if (designData.elements && Array.isArray(designData.elements)) {
            for (const element of designData.elements) {
                try {
                    await renderElement(ctx, element, width, height);
                } catch (elementError) {
                    console.warn('Failed to render element:', element.type, elementError.message);
                }
            }
        }

        return canvas.toBuffer('image/png');

    } catch (error) {
        console.error('Canvas PNG generation error:', error);
        throw new Error(`Canvas PNG generation failed: ${error.message}`);
    }
};
const renderElement = async (ctx, element, canvasWidth, canvasHeight) => {
    const x = element.x || 0;
    const y = element.y || 0;
    const width = element.width || 100;
    const height = element.height || 50;

    switch (element.type) {
        case 'text':
            ctx.fillStyle = element.color || '#000000';
            ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
            ctx.textAlign = element.textAlign || 'left';
            ctx.fillText(element.content || '', x, y);
            break;

        case 'image':
            if (element.src) {
                try {
                    const { loadImage } = require('canvas');
                    const image = await loadImage(element.src);
                    ctx.drawImage(image, x, y, width, height);
                } catch (imageError) {
                    console.warn('Failed to load element image:', imageError.message);
                }
            }
            break;

        case 'shape':
            ctx.fillStyle = element.color || '#000000';
            if (element.shape === 'rectangle') {
                ctx.fillRect(x, y, width, height);
            } else if (element.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, 2 * Math.PI);
                ctx.fill();
            }
            break;

        case 'qr-code':
            // QR code rendering would require a QR code library
            // For now, just draw a placeholder
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, width, height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('QR', x + width / 2, y + height / 2);
            break;

        default:
            console.warn('Unknown element type:', element.type);
    }
};
/**
 * Generate JPEG using Canvas (Alternative method for simple layouts)
 */
async function generateJPEGWithCanvas(designData, participantData, credentialId) {
    const canvas = createCanvas(1200, 800);
    const ctx = canvas.getContext('2d');

    // Add white background first (JPEG doesn't support transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add background
    if (designData?.background?.type === 'gradient') {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, designData.background.primaryColor || '#3498db');
        gradient.addColorStop(1, designData.background.secondaryColor || '#e74c3c');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = designData?.background?.primaryColor || '#ffffff';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Add title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(designData?.content?.titleText || 'Certificate of Achievement', canvas.width / 2, 150);

    // Add participant name
    ctx.font = '24px Arial';
    ctx.fillText('This is to certify that', canvas.width / 2, 250);

    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#2c3e50';
    ctx.fillText(participantData.name, canvas.width / 2, 320);

    // Add event description
    ctx.font = '20px Arial';
    ctx.fillStyle = '#000000';
    ctx.fillText(designData?.content?.eventDescription || `has successfully completed ${participantData.eventTitle || 'the event'}`, canvas.width / 2, 400);

    // Add date
    const date = new Date().toLocaleDateString();
    ctx.font = '16px Arial';
    ctx.fillText(`Issued on ${date}`, canvas.width / 2, 450);

    return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

// ==================== BATCH OPERATIONS ====================

/**
 * Batch Export Credentials
 */
export const batchExportCredentials = async (req, res) => {
    try {
        const { credentialIds, format = 'png', zipFileName } = req.body;

        if (!Array.isArray(credentialIds) || credentialIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Credential IDs array is required"
            });
        }

        const credentials = await Credential.find({ _id: { $in: credentialIds } })
            .populate('participantId', 'name fullName')
            .populate('eventId', 'title name');

        if (credentials.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No credentials found"
            });
        }

        const exportResults = [];
        const errors = [];

        for (const credential of credentials) {
            try {
                const participantData = {
                    name: credential.participantId?.fullName || credential.participantId?.name || 'Unknown',
                    eventTitle: credential.eventId?.title || credential.eventId?.name || 'Unknown Event'
                };

                let exportUrl;
                if (format === 'pdf') {
                    const html = generateCredentialHTML(credential.designData, participantData);
                    const buffer = await generatePDFFromHTML(html);
                    const uploadResult = await uploadToCloudinary(buffer, 'raw', 'pdf');
                    exportUrl = uploadResult.secure_url;
                } else if (format === 'jpeg') {
                    const html = generateCredentialHTML(credential.designData, participantData);
                    const buffer = await generateJPEGFromHTML(html);
                    const uploadResult = await uploadToCloudinary(buffer, 'image', 'jpg');
                    exportUrl = uploadResult.secure_url;
                } else {
                    const html = generateCredentialHTML(credential.designData, participantData);
                    const buffer = await generatePNGFromHTML(html);
                    const uploadResult = await uploadToCloudinary(buffer, 'image', 'png');
                    exportUrl = uploadResult.secure_url;
                }

                exportResults.push({
                    credentialId: credential._id,
                    participantName: participantData.name,
                    exportUrl
                });

            } catch (error) {
                console.error(`Error exporting credential ${credential._id}:`, error);
                errors.push({
                    credentialId: credential._id,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Batch export completed. ${exportResults.length} succeeded, ${errors.length} failed.`,
            exports: exportResults,
            errors
        });

    } catch (error) {
        console.error("Batch Export Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to batch export credentials",
            error: error.message
        });
    }
};

/**
 * Helper function to upload to Cloudinary
 */
async function uploadToCloudinary(buffer, resourceType, format) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                folder: "credentials/exports",
                format: format,
                timeout: 60000
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        ).end(buffer);
    });
}
// Alternative implementation if credentials are linked through events
export const getAdminCredentialsViaEvents = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { type, limit = 50, offset = 0 } = req.query;

        console.log('Fetching credentials via events for admin:', adminId);

        // First, get all events created by this admin
        const adminEvents = await Event.find({ createdBy: adminId }).select('_id title startDate');
        const eventIds = adminEvents.map(event => event._id);

        if (eventIds.length === 0) {
            return res.status(200).json({
                success: true,
                credentials: [],
                total: 0
            });
        }

        // Build query
        let query = { eventId: { $in: eventIds } };
        if (type) {
            query.type = type;
        }

        // Find credentials for these events
        const credentials = await Credential.find(query)
            .populate({
                path: 'participantId',
                select: 'fullName name email'
            })
            .populate({
                path: 'eventId',
                select: 'title name startDate endDate'
            })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        // Transform data same as above...
        const transformedCredentials = credentials.map(credential => ({
            _id: credential._id,
            id: credential._id,
            title: credential.title,
            description: credential.description,
            type: credential.type || credential.credentialType,
            status: credential.status,
            participantName: credential.participantId?.fullName || credential.participantId?.name || 'Unknown',
            participantEmail: credential.participantId?.email,
            eventTitle: credential.eventId?.title || credential.eventId?.name || 'Unknown Event',
            eventDate: credential.eventId?.startDate || credential.eventId?.endDate,
            issuedAt: credential.issuedAt,
            createdAt: credential.createdAt,
            updatedAt: credential.updatedAt,
            lastModified: credential.updatedAt || credential.createdAt,
            designData: credential.designData,
            participantData: credential.participantData
        }));

        const totalCount = await Credential.countDocuments(query);

        res.status(200).json({
            success: true,
            credentials: transformedCredentials,
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + credentials.length) < totalCount
        });

    } catch (error) {
        console.error('Error fetching credentials via events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credentials',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};



// Export all functions
export default {
    // Basic CRUD
    createCredential,
    createCredentialWithDesign,
    getCredentials,
    getMyCredentials,
    getAdminCredentials,
    getCredentialStats,
    updateCredential,
    editCredential,
    shareCredential,
    verifyCredential,
    customizeCredential,


    // Template management
    createTemplate,
    getTemplates,
    getTemplate,
    updateTemplate,
    getDefaultTemplate,

    // Design functionality
    saveDesignProgress,
    previewCredential,

    // Export functionality
    exportCredentialPDF,
    exportCredentialPNG,
    exportCredentialJPEG,
    batchExportCredentials,

    // Import and reconcile
    importCredential,
    reconcileCertificates
};
'/usr/bin/chromium'
