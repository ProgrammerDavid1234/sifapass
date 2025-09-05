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

/**
 * Create or Import Credential
 */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const blockchainHash = crypto.randomBytes(32).toString("hex");
const qrCode = await QRCode.toDataURL(`https://sifapass.onrender.com/verify/${blockchainHash}`);


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
        const qrCode = await QRCode.toDataURL(blockchainHash);

        // Save to DB
        const credential = await Credential.create({
            participantId,
            eventId,
            title,
            type,
            downloadLink,
            blockchainHash,
            qrCode,
            issuedBy: req.user.id // ✅ Make sure the logged-in Admin is issuing it

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
 * Edit Credential
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
 * Share Credential with other users
 */
export const shareCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body; // array of users to share with

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
 * Verify Credential (Blockchain + QR)
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
export const editCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, password, description } = req.body;

        const updatedCredential = await Credential.findByIdAndUpdate(
            id,
            { name, username, password, description },
            { new: true } // return updated document
        );

        if (!updatedCredential) {
            return res.status(404).json({ message: 'Credential not found' });
        }

        res.status(200).json({ message: 'Credential updated successfully', data: updatedCredential });
    } catch (error) {
        res.status(500).json({ message: 'Error updating credential', error: error.message });
    }
};
export const getDefaultTemplate = async (req, res) => {
    try {
        // Define your default credential template structure
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

// -------------------- IMPORT CREDENTIAL --------------------
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

        await pool.query(
            "INSERT INTO credentials (user_id, service_name, username, password) VALUES ?",
            [values]
        );

        res.status(201).json({ message: "Credentials imported successfully", count: values.length });
    } catch (error) {
        console.error("Error importing credentials:", error);
        res.status(500).json({ error: "Server error" });
    }
};
// Reconcile certificates
export const reconcileCertificates = async (req, res) => {
    try {
        const { participantId, credentialId } = req.body;

        // check if credential belongs to participant
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
/**
 * Get My Credentials (for participant)
 */
export const getMyCredentials = async (req, res) => {
    try {
        const participantId = req.user.id; // From authentication middleware

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
 * Create Custom Template with Designer Data
 */
export const createTemplate = async (req, res) => {
    try {
        const {
            name,
            type, // 'certificate' or 'badge'
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

// ==================== DESIGNER FUNCTIONALITY ====================

/**
 * Save Design Progress (Auto-save)
 */
export const saveDesignProgress = async (req, res) => {
    try {
        const { templateId, designData } = req.body;

        if (templateId) {
            // Update existing template
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
 * Preview Credential Design
 */
export const previewCredential = async (req, res) => {
    try {
        const { designData, participantData = {} } = req.body;

        // Generate preview HTML
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
 * Export Credential as PNG
 */
export const exportCredentialPNG = async (req, res) => {
    try {
        const { designData, participantData, credentialId } = req.body;

        const html = generateCredentialHTML(designData, participantData);
        const pngBuffer = await generatePNGFromHTML(html);

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: "image", folder: "credentials/exports", format: "png" },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(pngBuffer);
        });

        // Update credential with export link if credentialId provided
        if (credentialId) {
            await Credential.findByIdAndUpdate(credentialId, {
                exportLinks: {
                    png: uploadResult.secure_url
                }
            });
        }

        res.json({
            success: true,
            exportUrl: uploadResult.secure_url,
            message: "PNG exported successfully"
        });
    } catch (error) {
        console.error("PNG Export Error:", error);
        res.status(500).json({
            message: "Failed to export PNG",
            error: error.message
        });
    }
};

/**
 * Export Credential as JPEG
 */
export const exportCredentialJPEG = async (req, res) => {
    try {
        const { designData, participantData, credentialId } = req.body;

        const html = generateCredentialHTML(designData, participantData);
        const jpegBuffer = await generateJPEGFromHTML(html);

        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: "image", folder: "credentials/exports", format: "jpg" },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(jpegBuffer);
        });

        if (credentialId) {
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
            message: "Failed to export JPEG",
            error: error.message
        });
    }
};

/**
 * Export Credential as PDF
 */
export const exportCredentialPDF = async (req, res) => {
    try {
        const { designData, participantData, credentialId } = req.body;

        const html = generateCredentialHTML(designData, participantData);
        const pdfBuffer = await generatePDFFromHTML(html);

        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: "raw", folder: "credentials/exports", format: "pdf" },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(pdfBuffer);
        });

        if (credentialId) {
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
        console.error("PDF Export Error:", error);
        res.status(500).json({
            message: "Failed to export PDF",
            error: error.message
        });
    }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate HTML from Design Data
 */
function generateCredentialHTML(designData, participantData = {}) {
    const { elements = [], canvas = {}, background = {} } = designData;

    let backgroundStyle = '';
    if (background.type === 'gradient') {
        const direction = background.gradientDirection || 'to right';
        const primary = background.primaryColor || '#ffffff';
        const secondary = background.secondaryColor || '#f0f0f0';
        backgroundStyle = `background: linear-gradient(${direction}, ${primary}, ${secondary});`;
    } else if (background.type === 'solid') {
        backgroundStyle = `background-color: ${background.color || '#ffffff'};`;
    } else if (background.type === 'image' && background.imageUrl) {
        backgroundStyle = `background-image: url('${background.imageUrl}'); background-size: cover; background-position: center;`;
    }

    let elementsHtml = '';
    elements.forEach(element => {
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
            font-family: ${element.fontFamily || 'Arial'};
            font-size: ${element.fontSize || 16}px;
            font-weight: ${element.fontWeight || 'normal'};
            color: ${element.color || '#000000'};
            text-align: ${element.textAlign || 'left'};
            z-index: ${element.zIndex || 1};
        `;

        if (element.type === 'text') {
            elementsHtml += `<div style="${elementStyle}">${content}</div>`;
        } else if (element.type === 'image') {
            elementsHtml += `<img src="${element.src}" style="${elementStyle}" alt="${element.alt || ''}" />`;
        } else if (element.type === 'qrcode') {
            elementsHtml += `<div style="${elementStyle}"><img src="${element.qrCodeUrl}" alt="QR Code" /></div>`;
        }
    });

    return `
        <html>
        <head>
            <style>
                body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                .credential-container {
                    position: relative;
                    width: ${canvas.width || 800}px;
                    height: ${canvas.height || 600}px;
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
}

/**
 * Generate PNG from HTML using Puppeteer
 */
async function generatePNGFromHTML(html) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.setContent(html);
    await page.setViewport({ width: 800, height: 600 });

    const screenshot = await page.screenshot({
        type: "png",
        fullPage: true,
        omitBackground: false,
    });

    await browser.close();
    return screenshot;
}
/**
 * Generate JPEG from HTML using Puppeteer
 */
async function generateJPEGFromHTML(html) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.setContent(html);
    await page.setViewport({ width: 800, height: 600 });

    const screenshot = await page.screenshot({
        type: "jpeg",
        quality: 90,
        fullPage: true,
        omitBackground: false,
    });

    await browser.close();
    return screenshot;
}
/**
 * Generate PDF from HTML using Puppeteer
 */
async function generatePDFFromHTML(html) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.setContent(html);

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

    await browser.close();
    return pdf;
}

// ==================== ENHANCED CREDENTIAL CREATION ====================

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
            issuedBy: req.user.id // ✅ Correct placement here

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

export default {
    createCredential,
    getCredentials,
    updateCredential,
    shareCredential,
    verifyCredential,
    customizeCredential,
    editCredential
};