import Credential from "../models/Credentials.js";
import CredentialTemplate from "../models/CredentialTemplate.js";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
    trackCredentialIssued,
    trackCredentialVerified,
    trackCredentialDownloaded
} from "../utils/analyticsHelper.js";
import Admin from '../models/Admin.js';
import Participant from '../models/Participant.js'
import Event from '../models/Event.js'
import { createCanvas, loadImage, registerFont } from 'canvas';
import QRCode from 'qrcode';
/**
 * Configure Cloudinary
 */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// credentialController.js - Replace the generateCertificateImage function with this
const generateCredentialImage = async (designData, participantData, credentialId) => {
    console.log('Generating credential image with Canvas...');

    try {
        // Validate input data
        if (!designData || typeof designData !== 'object') {
            console.warn('Invalid design data, using defaults');
            designData = {};
        }

        if (!participantData || typeof participantData !== 'object') {
            console.warn('Invalid participant data, using defaults');
            participantData = {};
        }

        // Get canvas dimensions from design data with fallbacks
        const width = designData?.canvasSettings?.width ||
            designData?.canvas?.width || 1200;
        const height = designData?.canvasSettings?.height ||
            designData?.canvas?.height || 800;

        console.log('Canvas dimensions:', { width, height });

        // Create canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Set high quality rendering
        ctx.antialias = 'subpixel';
        ctx.quality = 'best';
        if (ctx.textRenderingOptimization) {
            ctx.textRenderingOptimization = 'optimizeQuality';
        }

        // Clear canvas and set default background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Apply background from design data
        await applyBackground(ctx, designData.canvasSettings || designData.background, width, height);

        // Render elements from design data
        if (designData.elements && Array.isArray(designData.elements) && designData.elements.length > 0) {
            console.log('Rendering', designData.elements.length, 'elements');

            for (const element of designData.elements) {
                try {
                    await renderElementOnCanvas(ctx, element, participantData, width, height);
                } catch (elementError) {
                    console.error('Error rendering element:', element, elementError);
                    // Continue with other elements
                }
            }
        } else {
            // If no elements, create default certificate content
            console.log('No elements found, creating default content');
            await renderDefaultContent(ctx, participantData, width, height);
        }

        // Add QR code if verification is enabled
        try {
            if (participantData.verificationUrl || participantData.blockchainHash) {
                await addQRCodeToCanvas(ctx, participantData, width, height);
            }
        } catch (qrError) {
            console.warn('QR code generation failed, continuing without QR code:', qrError);
        }

        console.log('Canvas rendering complete, converting to buffer...');

        // Convert to PNG buffer
        const buffer = canvas.toBuffer('image/png');
        console.log('PNG buffer created, size:', buffer.length);

        // Validate buffer
        if (!buffer || buffer.length === 0) {
            throw new Error('Generated buffer is empty');
        }

        return buffer;

    } catch (error) {
        console.error('Canvas generation error:', error);
        throw new Error(`Failed to generate image: ${error.message}`);
    }
};



// Helper function to generate HTML from design data
const generateHTMLFromDesign = (designData, participantData, qrCodeDataUrl) => {
    const canvasWidth = designData.canvas?.width || 1200;
    const canvasHeight = designData.canvas?.height || 800;

    // Generate background CSS
    let backgroundCSS = 'background: #ffffff;';
    if (designData.background) {
        if (designData.background.type === 'gradient') {
            const primary = designData.background.primaryColor || '#3498db';
            const secondary = designData.background.secondaryColor || '#e74c3c';
            backgroundCSS = `background: linear-gradient(135deg, ${primary}, ${secondary});`;
        } else {
            backgroundCSS = `background: ${designData.background.color || '#ffffff'};`;
        }
    }

    // Generate elements HTML
    let elementsHTML = '';
    if (designData.elements && Array.isArray(designData.elements)) {
        elementsHTML = designData.elements.map(element => {
            if (element.type === 'text') {
                // Replace placeholders with actual data
                let text = element.text || '';
                text = text.replace('{{participantName}}', participantData.name || 'Participant');
                text = text.replace('{{eventTitle}}', participantData.eventTitle || 'Event');
                text = text.replace('{{eventDate}}', participantData.eventDate || new Date().toDateString());
                text = text.replace('{{skills}}', participantData.skills || '');

                // Handle multiline text
                const formattedText = text.split('\n').join('<br>');

                return `
          <div style="
            position: absolute;
            left: ${element.x || 0}px;
            top: ${element.y || 0}px;
            width: ${element.width || 'auto'}px;
            height: ${element.height || 'auto'}px;
            font-size: ${element.fontSize || 24}px;
            font-family: ${element.fontFamily || 'Arial, sans-serif'};
            font-weight: ${element.fontWeight || 'normal'};
            color: ${element.color || '#000000'};
            text-align: ${element.textAlign || 'left'};
            line-height: 1.2;
            overflow: hidden;
          ">
            ${formattedText}
          </div>
        `;
            }
            return '';
        }).join('');
    }

    // Add QR code if available
    let qrCodeHTML = '';
    if (qrCodeDataUrl) {
        qrCodeHTML = `
      <div style="
        position: absolute;
        bottom: 50px;
        right: 50px;
        width: 100px;
        height: 100px;
      ">
        <img src="${qrCodeDataUrl}" style="width: 100%; height: 100%;" alt="QR Code">
      </div>
    `;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: ${canvasWidth}px;
          height: ${canvasHeight}px;
          ${backgroundCSS}
          position: relative;
          font-family: Arial, sans-serif;
          overflow: hidden;
        }
      </style>
    </head>
    <body>
      ${elementsHTML}
      ${qrCodeHTML}
    </body>
    </html>
  `;
};

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

        // Get participant and event details for analytics
        const participant = await Participant.findById(participantId);
        const event = await Event.findById(eventId);

        if (!participant || !event) {
            return res.status(400).json({ message: "Invalid participant or event ID" });
        }

        // Upload to Cloudinary using buffer
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
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
            issuedBy: req.user.id,
            issuedAt: new Date()
        });

        // Track the credential issuance
        await trackCredentialIssued({
            id: credential._id,
            type: credential.type,
            eventId: credential.eventId,
            eventName: event.title,
            recipientEmail: participant.email,
            credentialType: type
        }, req.user.email || req.user.id);
        // In your credential creation endpoint
        await ActivityLog.create({
            action: 'credential_issued',
            actor: participantId,
            timestamp: new Date(),
            details: {
                credentialId: credential._id,
                eventId: credential.eventId,
                eventName: credential.participantData.eventTitle
            }
        });
        res
            .status(201)
            .json({
                success: true,
                message: `${type} created successfully`,
                credential: {
                    id: credential._id,
                    title: credential.title,
                    type: credential.type,
                    downloadLink: credential.downloadLink,
                    blockchainHash: credential.blockchainHash,
                    qrCode: credential.qrCode,
                    issuedAt: credential.issuedAt
                }
            });
    } catch (error) {
        console.error("CreateCredential Error:", error);
        res
            .status(500)
            .json({
                success: false,
                message: "Failed to create credential",
                error: error.message
            });
    }
};

/**
 * Create Credential with Custom Design
 */
// credentialController.js - Debug version with detailed error logging

// credentialController.js - Updated createCredentialWithDesign function

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

        console.log('Creating credential with design...', { participantId, eventId, type });

        // Validate required fields
        if (!participantId || !eventId || !title || !type) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: participantId, eventId, title, type"
            });
        }

        // Validate participant and event exist
        const participant = await Participant.findById(participantId);
        const event = await Event.findById(eventId);

        if (!participant) {
            return res.status(400).json({
                success: false,
                message: "Participant not found"
            });
        }

        if (!event) {
            return res.status(400).json({
                success: false,
                message: "Event not found"
            });
        }

        // Generate blockchain hash for verification
        const blockchainHash = crypto
            .createHash("sha256")
            .update(JSON.stringify({ participantId, eventId, title, type }) + Date.now())
            .digest("hex");

        // Generate verification URL and QR code
        const verificationUrl = `${process.env.FRONTEND_URL || 'https://sifapass.onrender.com'}/verify/${blockchainHash}`;
        const qrCode = await QRCode.toDataURL(verificationUrl);

        console.log('Generated blockchain hash and QR code');

        // Prepare participant data for rendering
        const renderData = {
            name: participantData?.name || participant.fullName || participant.name,
            eventTitle: participantData?.eventTitle || event.title || event.name,
            eventDate: participantData?.eventDate || (event.startDate ? new Date(event.startDate).toLocaleDateString() : new Date().toLocaleDateString()),
            skills: participantData?.skills || participant.skills || '',
            issueDate: new Date().toLocaleDateString(),
            participantEmail: participant.email,
            verificationUrl: verificationUrl,
            blockchainHash: blockchainHash
        };

        console.log('Render data prepared:', renderData);

        // Create credential record first (so we have an ID for image generation)
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
            participantData: renderData,
            issuedBy: req.user.id,
            createdBy: req.user.id, // Add this for admin queries
            status: 'generating', // Temporary status while generating
            issuedAt: new Date()
        });

        console.log('Credential record created:', credential._id);

        // Now generate the certificate image
        let credentialImageUrl = null;
        let exportLinks = {};

        try {
            console.log('Starting image generation...');

            // Use Canvas method (more reliable than Puppeteer)
            const pngBuffer = await generateCredentialImage(designData, renderData, credential._id);

            console.log('Image generated, buffer size:', pngBuffer.length);

            // Upload to Cloudinary
            const uploadResult = await new Promise((resolve, reject) => {
                const uploadOptions = {
                    resource_type: "image",
                    folder: "credentials/generated",
                    format: "png",
                    public_id: `credential_${credential._id}`,
                    overwrite: true,
                    timeout: 60000 // 60 seconds timeout
                };

                console.log('Uploading to Cloudinary with options:', uploadOptions);

                const uploadStream = cloudinary.v2.uploader.upload_stream(
                    uploadOptions,
                    (error, result) => {
                        if (error) {
                            console.error('Cloudinary upload error:', error);
                            return reject(error);
                        }
                        console.log('Cloudinary upload successful:', result.secure_url);
                        resolve(result);
                    }
                );

                uploadStream.end(pngBuffer);
            });

            credentialImageUrl = uploadResult.secure_url;
            exportLinks.png = uploadResult.secure_url;

            console.log('Certificate image uploaded successfully:', credentialImageUrl);

            // Update credential with the generated image URLs and mark as complete
            await Credential.findByIdAndUpdate(credential._id, {
                downloadLink: credentialImageUrl,
                exportLinks: exportLinks,
                status: 'issued' // Mark as complete
            });

            // Track the credential issuance
            await trackCredentialIssued({
                id: credential._id,
                type: credential.type,
                eventId: credential.eventId,
                eventName: event.title || event.name,
                recipientEmail: participant.email,
                credentialType: type
            }, req.user.email || req.user.id);

            console.log('Credential creation completed successfully');

            res.status(201).json({
                success: true,
                message: `${type} created successfully`,
                credential: {
                    id: credential._id,
                    title: credential.title,
                    type: credential.type,
                    status: 'issued',
                    participantName: renderData.name,
                    eventTitle: renderData.eventTitle,
                    blockchainHash: credential.blockchainHash,
                    verificationUrl: credential.verificationUrl,
                    qrCode: credential.qrCode,
                    downloadLink: credentialImageUrl,
                    credentialImageUrl: credentialImageUrl, // Include for frontend
                    exportLinks: exportLinks,
                    issuedAt: credential.issuedAt,
                    hasGeneratedImage: true
                }
            });

        } catch (imageError) {
            console.error('Image generation failed:', imageError);

            // Mark credential as failed but keep the record
            await Credential.findByIdAndUpdate(credential._id, {
                status: 'failed',
                errorMessage: imageError.message
            });

            // Still return success but indicate image generation failed
            res.status(201).json({
                success: true,
                message: `${type} record created but image generation failed`,
                credential: {
                    id: credential._id,
                    title: credential.title,
                    type: credential.type,
                    status: 'failed',
                    participantName: renderData.name,
                    eventTitle: renderData.eventTitle,
                    blockchainHash: credential.blockchainHash,
                    verificationUrl: credential.verificationUrl,
                    qrCode: credential.qrCode,
                    issuedAt: credential.issuedAt,
                    hasGeneratedImage: false,
                    error: 'Image generation failed. Can be retried later.'
                }
            });
        }

    } catch (error) {
        console.error("Create Credential Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create credential",
            error: error.message
        });
    }
};

// Helper function to generate SVG
const generateSVGCertificate = (designData, participantData, width, height) => {
    // Generate background
    let backgroundDef = '';
    let backgroundRect = `<rect width="${width}" height="${height}" fill="#ffffff"/>`;

    if (designData.background?.type === 'gradient') {
        const primary = designData.background.primaryColor || '#3498db';
        const secondary = designData.background.secondaryColor || '#e74c3c';
        backgroundDef = `
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${secondary};stop-opacity:1" />
        </linearGradient>
      </defs>
    `;
        backgroundRect = `<rect width="${width}" height="${height}" fill="url(#bgGrad)"/>`;
    } else if (designData.background?.color) {
        backgroundRect = `<rect width="${width}" height="${height}" fill="${designData.background.color}"/>`;
    }

    // Generate text elements
    let textElements = '';
    if (designData.elements && Array.isArray(designData.elements)) {
        textElements = designData.elements
            .filter(element => element.type === 'text')
            .map(element => {
                // Replace placeholders
                let text = element.text || '';
                text = text.replace('{{participantName}}', participantData.name || 'Participant');
                text = text.replace('{{eventTitle}}', participantData.eventTitle || 'Event');
                text = text.replace('{{eventDate}}', participantData.eventDate || new Date().toDateString());
                text = text.replace('{{skills}}', participantData.skills || '');

                const fontSize = element.fontSize || 24;
                const fontFamily = element.fontFamily || 'Arial, sans-serif';
                const fontWeight = element.fontWeight || 'normal';
                const color = element.color || '#000000';
                const x = element.x || 0;
                const y = (element.y || 0) + fontSize; // Adjust y for SVG text baseline

                // Handle multiline text
                if (text.includes('\n')) {
                    const lines = text.split('\n');
                    const lineHeight = fontSize * 1.2;
                    return lines.map((line, index) => `
            <text x="${x}" y="${y + (index * lineHeight)}" 
                  font-family="${fontFamily}" 
                  font-size="${fontSize}" 
                  font-weight="${fontWeight}" 
                  fill="${color}"
                  text-anchor="start">
              ${escapeXml(line)}
            </text>
          `).join('');
                } else {
                    return `
            <text x="${x}" y="${y}" 
                  font-family="${fontFamily}" 
                  font-size="${fontSize}" 
                  font-weight="${fontWeight}" 
                  fill="${color}"
                  text-anchor="start">
              ${escapeXml(text)}
            </text>
          `;
                }
            }).join('');
    }

    // Create the complete SVG
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${backgroundDef}
      ${backgroundRect}
      ${textElements}
    </svg>
  `;

    return svg;
};

// Helper to escape XML characters
const escapeXml = (text) => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};


const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    try {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth > maxWidth && i > 0) {
                ctx.fillText(line.trim(), x, currentY);
                line = words[i] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }

        if (line.trim()) {
            ctx.fillText(line.trim(), x, currentY);
        }
    } catch (error) {
        console.error('Text wrapping error:', error);
        // Fallback to simple text rendering
        ctx.fillText(text, x, y);
    }
};


const renderElementOnCanvas = async (ctx, element, participantData, canvasWidth, canvasHeight) => {
    try {
        if (!element || !element.type) {
            console.warn('Invalid element:', element);
            return;
        }

        console.log('Rendering element:', element.type, element);

        if (element.type === 'text') {
            // Replace placeholders in text content
            let content = element.content || element.text || '';

            // Enhanced placeholder replacement with fallbacks
            content = content.replace(/\{\{participantName\}\}/g, participantData.name || 'Participant Name');
            content = content.replace(/\{\{eventTitle\}\}/g, participantData.eventTitle || 'Event Title');
            content = content.replace(/\{\{eventDate\}\}/g, participantData.eventDate || new Date().toLocaleDateString());
            content = content.replace(/\{\{skills\}\}/g, participantData.skills || '');
            content = content.replace(/\{\{issueDate\}\}/g, participantData.issueDate || new Date().toLocaleDateString());

            // Set text properties with fallbacks
            const fontSize = element.fontSize || 16;
            const fontFamily = (element.fontFamily || 'Arial').split(',')[0].trim();
            const fontWeight = element.fontWeight || 'normal';
            const color = element.color || '#000000';
            const textAlign = element.textAlign || 'left';

            // Apply text styling
            ctx.fillStyle = color;
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.textAlign = textAlign;
            ctx.textBaseline = 'top';

            // Position and draw text
            const x = element.x || 0;
            const y = element.y || 0;
            const maxWidth = element.width || (canvasWidth - x - 20); // Leave some margin

            // Handle multiline text
            if (content.includes('\n')) {
                const lines = content.split('\n');
                const lineHeight = fontSize + 5;
                lines.forEach((line, index) => {
                    if (maxWidth > 0) {
                        ctx.fillText(line, x, y + (index * lineHeight), maxWidth);
                    } else {
                        ctx.fillText(line, x, y + (index * lineHeight));
                    }
                });
            } else if (content.length > 50 && maxWidth > 0) {
                wrapText(ctx, content, x, y, maxWidth, fontSize + 5);
            } else {
                if (maxWidth > 0) {
                    ctx.fillText(content, x, y, maxWidth);
                } else {
                    ctx.fillText(content, x, y);
                }
            }

        } else if (element.type === 'image' && element.src) {
            try {
                const img = await loadImage(element.src);
                const x = element.x || 0;
                const y = element.y || 0;
                const width = element.width || 100;
                const height = element.height || 100;

                ctx.drawImage(img, x, y, width, height);
            } catch (imgError) {
                console.warn('Failed to load element image:', element.src, imgError.message);
                // Draw placeholder rectangle
                const x = element.x || 0;
                const y = element.y || 0;
                const width = element.width || 100;
                const height = element.height || 100;

                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(x, y, width, height);
                ctx.strokeStyle = '#cccccc';
                ctx.strokeRect(x, y, width, height);
            }
        } else if (element.type === 'shape') {
            ctx.fillStyle = element.color || '#000000';
            const x = element.x || 0;
            const y = element.y || 0;
            const width = element.width || 100;
            const height = element.height || 50;

            if (element.shape === 'rectangle') {
                ctx.fillRect(x, y, width, height);
            } else if (element.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

    } catch (error) {
        console.error('Error rendering element:', error);
        // Don't throw, just continue with other elements
    }
};


const applyBackground = async (ctx, backgroundSettings, width, height) => {
    try {
        if (!backgroundSettings) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        const bgType = backgroundSettings.backgroundType || backgroundSettings.type || 'solid';

        if (bgType === 'gradient') {
            try {
                const gradient = ctx.createLinearGradient(0, 0, width, 0);
                const primaryColor = backgroundSettings.gradientFrom ||
                    backgroundSettings.primaryColor || '#3498db';
                const secondaryColor = backgroundSettings.gradientTo ||
                    backgroundSettings.secondaryColor || '#e74c3c';

                gradient.addColorStop(0, primaryColor);
                gradient.addColorStop(1, secondaryColor);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
            } catch (gradientError) {
                console.warn('Gradient creation failed, using solid color:', gradientError);
                ctx.fillStyle = backgroundSettings.primaryColor || '#ffffff';
                ctx.fillRect(0, 0, width, height);
            }
        } else if (bgType === 'solid') {
            ctx.fillStyle = backgroundSettings.backgroundColor ||
                backgroundSettings.primaryColor ||
                backgroundSettings.color || '#ffffff';
            ctx.fillRect(0, 0, width, height);
        } else if (bgType === 'image' && backgroundSettings.backgroundImage) {
            try {
                const bgImage = await loadImage(backgroundSettings.backgroundImage);
                ctx.drawImage(bgImage, 0, 0, width, height);
            } catch (imgError) {
                console.warn('Failed to load background image, using fallback:', imgError);
                ctx.fillStyle = backgroundSettings.primaryColor || '#ffffff';
                ctx.fillRect(0, 0, width, height);
            }
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }
    } catch (error) {
        console.error('Background application error:', error);
        // Fallback to white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
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

        // Transform credentials to include the correct download URLs
        const transformedCredentials = credentials.map(credential => ({
            ...credential.toJSON(),
            // Prioritize the generated image over export links
            mainImageUrl: credential.downloadLink || credential.exportLinks?.png,
            // Provide all available download options
            availableFormats: {
                png: credential.exportLinks?.png || credential.downloadLink,
                pdf: credential.exportLinks?.pdf,
                jpeg: credential.exportLinks?.jpeg
            },
            // Indicate if image was pre-generated
            hasGeneratedImage: !!(credential.downloadLink || credential.exportLinks?.png)
        }));

        res.status(200).json(transformedCredentials);
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
export const downloadCredentialDirect = async (req, res) => {
    try {
        const { participantId, credentialId } = req.params;

        // Verify the credential belongs to the participant
        const credential = await Credential.findOne({
            _id: credentialId,
            participantId: participantId,
            status: { $ne: 'revoked' }
        }).populate('eventId', 'title startDate')
            .populate('participantId', 'name email');

        if (!credential) {
            return res.status(404).json({
                success: false,
                message: "Credential not found or access denied"
            });
        }

        // Check if we have a pre-generated image
        const imageUrl = credential.downloadLink || credential.exportLinks?.png;

        if (imageUrl) {
            // Update download count
            credential.downloadCount += 1;
            credential.lastDownloaded = new Date();
            await credential.save();

            // Track the download
            await trackCredentialDownloaded(
                credential._id,
                'png', // format
                credential.participantId?.email || 'anonymous'
            );

            // Return the direct URL for download
            res.json({
                success: true,
                downloadUrl: imageUrl,
                credential: {
                    title: credential.title,
                    type: credential.type,
                    eventTitle: credential.eventId?.title,
                    participantName: credential.participantData?.name || credential.participantId?.name,
                    issuedDate: credential.issuedAt,
                    blockchainHash: credential.blockchainHash,
                    qrCode: credential.qrCode
                }
            });
        } else {
            // If no pre-generated image, try to generate on-demand
            console.log('No pre-generated image found, generating on-demand...');

            try {
                const pngBuffer = await generatePNGWithCanvas(
                    credential.designData,
                    credential.participantData,
                    credential._id
                );

                // Upload the generated image
                const uploadResult = await new Promise((resolve, reject) => {
                    cloudinary.v2.uploader.upload_stream(
                        {
                            resource_type: "image",
                            folder: "credentials/on-demand",
                            format: "png",
                            public_id: `credential_${credential._id}_${Date.now()}`,
                        },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result);
                        }
                    ).end(pngBuffer);
                });

                // Update credential with the new URL
                credential.exportLinks = credential.exportLinks || {};
                credential.exportLinks.png = uploadResult.secure_url;
                if (!credential.downloadLink) {
                    credential.downloadLink = uploadResult.secure_url;
                }
                credential.downloadCount += 1;
                credential.lastDownloaded = new Date();
                await credential.save();

                // Track the download
                await trackCredentialDownloaded(
                    credential._id,
                    'png',
                    credential.participantId?.email || 'anonymous'
                );

                res.json({
                    success: true,
                    downloadUrl: uploadResult.secure_url,
                    credential: {
                        title: credential.title,
                        type: credential.type,
                        eventTitle: credential.eventId?.title,
                        participantName: credential.participantData?.name || credential.participantId?.name,
                        issuedDate: credential.issuedAt,
                        blockchainHash: credential.blockchainHash,
                        qrCode: credential.qrCode
                    }
                });

            } catch (generationError) {
                console.error('On-demand generation failed:', generationError);
                res.status(500).json({
                    success: false,
                    message: "Direct download not available. Please use the export feature from the credential designer.",
                    credential: {
                        title: credential.title,
                        type: credential.type,
                        eventTitle: credential.eventId?.title,
                        participantName: credential.participantData?.name || credential.participantId?.name,
                        issuedDate: credential.issuedAt,
                        blockchainHash: credential.blockchainHash,
                        qrCode: credential.qrCode
                    }
                });
            }
        }

    } catch (error) {
        console.error("Direct Download Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to download credential",
            error: error.message
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

        const credential = await Credential.findOne({ blockchainHash: hash })
            .populate('eventId', 'title')
            .populate('participantId', 'name email');

        if (!credential) {
            return res.status(404).json({
                success: false,
                message: "Invalid or tampered credential"
            });
        }

        // Track the verification
        await trackCredentialVerified(
            credential._id,
            'blockchain_hash', // verification method
            req.ip || 'anonymous' // Use IP as identifier for anonymous verification
        );

        res.json({
            success: true,
            message: "Credential verified successfully",
            credential: {
                id: credential._id,
                title: credential.title,
                type: credential.type,
                participantName: credential.participantId?.name,
                eventTitle: credential.eventId?.title,
                issuedAt: credential.issuedAt,
                blockchainHash: credential.blockchainHash,
                qrCode: credential.qrCode
            }
        });
    } catch (error) {
        console.error("Verify Credential Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify credential",
            error: error.message
        });
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
            cloudinary.v2.uploader.upload_stream(
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
        console.log('PNG export requested...');
        const { designData, participantData, credentialId } = req.body;

        // Verify user has access to this credential
        if (credentialId && mongoose.Types.ObjectId.isValid(credentialId)) {
            const credential = await Credential.findById(credentialId);

            if (!credential) {
                return res.status(404).json({
                    success: false,
                    message: 'Credential not found'
                });
            }

            // Check if user has access to this credential
            if (req.userType === 'participant') {
                if (credential.participantId.toString() !== req.user._id.toString()) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied to this credential'
                    });
                }
            } else if (req.userType === 'admin') {
                // Admin can access credentials they created or for their events
                if (credential.createdBy && credential.createdBy.toString() !== req.user._id.toString()) {
                    // Check if admin owns the event
                    const event = await Event.findById(credential.eventId);
                    if (!event || event.createdBy.toString() !== req.user._id.toString()) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied to this credential'
                        });
                    }
                }
            }

            // Check for existing generated image
            if (credential.downloadLink || credential.exportLinks?.png) {
                console.log('Using existing generated PNG image');
                const existingUrl = credential.downloadLink || credential.exportLinks.png;

                return res.json({
                    success: true,
                    exportUrl: existingUrl,
                    message: "PNG export successful (using existing image)",
                    method: 'existing'
                });
            }
        }

        // Continue with the rest of your existing PNG generation logic
        console.log('No existing image found, generating new PNG...');

        const method = req.body.method || 'canvas';
        let pngBuffer;

        if (method === 'canvas') {
            pngBuffer = await generatePNGWithCanvas(designData, participantData, credentialId);
        } else {
            const html = generateCredentialHTML(designData, participantData);
            pngBuffer = await generatePNGFromHTML(html);
        }

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.v2.uploader.upload_stream(
                {
                    resource_type: "image",
                    folder: "credentials/exports",
                    format: "png",
                    public_id: `credential_${credentialId}_${Date.now()}`,
                    overwrite: true
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(pngBuffer);
        });

        // Update credential with export link
        if (credentialId && mongoose.Types.ObjectId.isValid(credentialId)) {
            await Credential.findByIdAndUpdate(credentialId, {
                $set: {
                    "exportLinks.png": uploadResult.secure_url,
                    "downloadLink": uploadResult.secure_url
                }
            });
        }

        res.json({
            success: true,
            exportUrl: uploadResult.secure_url,
            message: "PNG exported successfully",
            fileSize: pngBuffer.length,
            method: method
        });

    } catch (error) {
        console.error("PNG Export Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export PNG",
            error: error.message
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
            cloudinary.v2.uploader.upload_stream(
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
        console.log('Generating credential image with Canvas...');

        // Get canvas dimensions from design data
        const width = designData?.canvasSettings?.width || designData?.canvas?.width || 1200;
        const height = designData?.canvasSettings?.height || designData?.canvas?.height || 800;

        console.log('Canvas dimensions:', { width, height });

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Set high quality rendering
        ctx.antialias = 'subpixel';
        ctx.quality = 'best';
        ctx.textRenderingOptimization = 'optimizeQuality';

        // Clear canvas and set background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Apply background from design data
        await applyBackground(ctx, designData.canvasSettings || designData.background, width, height);

        // Render elements from design data
        if (designData.elements && Array.isArray(designData.elements)) {
            console.log('Rendering', designData.elements.length, 'elements');

            for (const element of designData.elements) {
                await renderElementOnCanvas(ctx, element, participantData, width, height);
            }
        } else {
            // If no elements, create default certificate content
            console.log('No elements found, creating default content');
            await renderDefaultContent(ctx, participantData, width, height);
        }

        // Add QR code if verification is enabled
        if (participantData.verificationUrl || participantData.blockchainHash) {
            await addQRCodeToCanvas(ctx, participantData, width, height);
        }

        console.log('Canvas rendering complete, converting to buffer...');

        // Convert to PNG buffer
        const buffer = canvas.toBuffer('image/png');
        console.log('PNG buffer created, size:', buffer.length);

        return buffer;

    } catch (error) {
        console.error('Canvas generation error:', error);
        throw new Error(`Failed to generate PNG with Canvas: ${error.message}`);
    }
};
// Enhanced renderDefaultContent function
const renderDefaultContent = async (ctx, participantData, width, height) => {
    try {
        // Set default styling
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add border first
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, width - 40, height - 40);

        // Title
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText('Certificate of Achievement', width / 2, height * 0.25);

        // "This is to certify that" text
        ctx.font = '24px Arial';
        ctx.fillStyle = '#000000';
        ctx.fillText('This is to certify that', width / 2, height * 0.4);

        // Participant name (larger, prominent)
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#e74c3c';
        const participantName = participantData.name || 'Participant Name';
        ctx.fillText(participantName, width / 2, height * 0.5);

        // Event description
        ctx.font = '20px Arial';
        ctx.fillStyle = '#000000';
        const eventText = `has successfully completed ${participantData.eventTitle || 'the event'}`;
        ctx.fillText(eventText, width / 2, height * 0.65);

        // Date
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666666';
        const dateText = participantData.eventDate ?
            new Date(participantData.eventDate).toLocaleDateString() :
            new Date().toLocaleDateString();
        ctx.fillText(`Date: ${dateText}`, width / 2, height * 0.8);

    } catch (error) {
        console.error('Error rendering default content:', error);
        // Draw minimal fallback
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Certificate', width / 2, height / 2);
    }
};

const addQRCodeToCanvas = async (ctx, participantData, canvasWidth, canvasHeight) => {
    try {
        const verificationText = participantData.verificationUrl ||
            `Verification: ${participantData.blockchainHash}` ||
            'Certificate Verification';

        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(verificationText, {
            width: 120,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Load QR code image
        const qrImage = await loadImage(qrCodeDataUrl);

        // Position QR code in bottom right corner
        const qrSize = 120;
        const margin = 30;
        const x = canvasWidth - qrSize - margin;
        const y = canvasHeight - qrSize - margin;

        // Draw white background for QR code
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 5, y - 5, qrSize + 10, qrSize + 10);

        // Draw QR code
        ctx.drawImage(qrImage, x, y, qrSize, qrSize);

        // Add border around QR code
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 5, y - 5, qrSize + 10, qrSize + 10);

    } catch (error) {
        console.warn('QR code generation failed:', error);
        // Don't throw, QR code is optional
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
        cloudinary.v2.uploader.upload_stream(
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
export const viewCredential = async (req, res) => {
    try {
        const { participantId, credentialId } = req.params;

        const credential = await Credential.findOne({
            _id: credentialId,
            participantId: participantId,
            status: { $ne: 'revoked' }
        }).populate('eventId', 'title')
            .populate('participantId', 'name email');

        if (!credential) {
            return res.status(404).json({
                success: false,
                message: "Credential not found"
            });
        }

        // Track credential view (different from verification)
        await trackCredentialVerified(
            credential._id,
            'credential_view',
            credential.participantId?.email || 'anonymous'
        );

        res.json({
            success: true,
            credential: {
                title: credential.title,
                type: credential.type,
                eventTitle: credential.eventId?.title,
                participantName: credential.participantId?.name,
                issuedDate: credential.issuedAt,
                blockchainHash: credential.blockchainHash,
                qrCode: credential.qrCode,
                downloadLink: credential.downloadLink
            }
        });

    } catch (error) {
        console.error("View Credential Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to view credential",
            error: error.message
        });
    }
};

export const downloadCredentialForParticipant = async (req, res) => {
    try {
        const { credentialId } = req.params;
        const { format = 'png' } = req.query;

        // Get participant ID from token
        const participantId = req.user.id; // This should be set by participant auth middleware

        console.log('Participant download request:', { participantId, credentialId, format });

        // Find the credential and verify ownership
        const credential = await Credential.findOne({
            _id: credentialId,
            participantId: participantId,
            status: { $ne: 'revoked' }
        }).populate('eventId', 'title name startDate')
            .populate('participantId', 'name fullName email');

        if (!credential) {
            return res.status(404).json({
                success: false,
                message: "Credential not found or access denied"
            });
        }

        // Check if we have a pre-generated image
        let downloadUrl = null;

        if (format === 'png') {
            downloadUrl = credential.exportLinks?.png || credential.downloadLink;
        } else if (format === 'pdf') {
            downloadUrl = credential.exportLinks?.pdf;
        } else if (format === 'jpeg') {
            downloadUrl = credential.exportLinks?.jpeg;
        }

        if (downloadUrl) {
            // Update download tracking
            credential.downloadCount = (credential.downloadCount || 0) + 1;
            credential.lastDownloaded = new Date();
            await credential.save();

            return res.json({
                success: true,
                downloadUrl: downloadUrl,
                message: `${format.toUpperCase()} download ready`,
                credential: {
                    title: credential.title,
                    type: credential.type,
                    eventTitle: credential.eventId?.title || credential.eventId?.name,
                    participantName: credential.participantData?.name || credential.participantId?.name || credential.participantId?.fullName,
                    issuedDate: credential.issuedAt,
                    blockchainHash: credential.blockchainHash
                }
            });
        }

        // If no pre-generated file, generate on demand
        console.log('No pre-generated file found, generating on demand...');

        const participantData = {
            name: credential.participantData?.name || credential.participantId?.name || credential.participantId?.fullName || 'Participant',
            eventTitle: credential.participantData?.eventTitle || credential.eventId?.title || credential.eventId?.name || 'Event',
            eventDate: credential.participantData?.eventDate || credential.eventId?.startDate || credential.createdAt,
            skills: credential.participantData?.skills || '',
            issueDate: credential.issuedAt || credential.createdAt,
            participantEmail: credential.participantId?.email || '',
            verificationUrl: credential.verificationUrl || `${process.env.FRONTEND_URL}/verify/${credential.blockchainHash}`,
            blockchainHash: credential.blockchainHash
        };

        let buffer;
        let mimeType;
        let fileExtension;

        if (format === 'pdf') {
            const html = generateCredentialHTML(credential.designData || {}, participantData);
            buffer = await generatePDFFromHTML(html);
            mimeType = 'application/pdf';
            fileExtension = 'pdf';
        } else if (format === 'jpeg') {
            buffer = await generateJPEGWithCanvas(credential.designData || {}, participantData, credentialId);
            mimeType = 'image/jpeg';
            fileExtension = 'jpeg';
        } else {
            // Default to PNG
            buffer = await generatePNGWithCanvas(credential.designData || {}, participantData, credentialId);
            mimeType = 'image/png';
            fileExtension = 'png';
        }

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.v2.uploader.upload_stream(
                {
                    resource_type: format === 'pdf' ? "raw" : "image",
                    folder: "credentials/participant-downloads",
                    format: fileExtension,
                    public_id: `credential_${credentialId}_${Date.now()}`,
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(buffer);
        });

        // Save the generated URL for future use
        const updateData = {};
        updateData[`exportLinks.${format}`] = uploadResult.secure_url;
        if (!credential.downloadLink && format === 'png') {
            updateData.downloadLink = uploadResult.secure_url;
        }
        updateData.downloadCount = (credential.downloadCount || 0) + 1;
        updateData.lastDownloaded = new Date();

        await Credential.findByIdAndUpdate(credentialId, { $set: updateData });

        res.json({
            success: true,
            downloadUrl: uploadResult.secure_url,
            message: `${format.toUpperCase()} generated and ready for download`,
            generated: true,
            credential: {
                title: credential.title,
                type: credential.type,
                eventTitle: credential.eventId?.title || credential.eventId?.name,
                participantName: participantData.name,
                issuedDate: credential.issuedAt,
                blockchainHash: credential.blockchainHash
            }
        });

    } catch (error) {
        console.error("Participant Download Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to download credential",
            error: error.message
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
    reconcileCertificates,
    generateCredentialImage,
    applyBackground,
    renderElementOnCanvas,
    renderDefaultContent,
    addQRCodeToCanvas,
    wrapText
};
'/usr/bin/chromium'
