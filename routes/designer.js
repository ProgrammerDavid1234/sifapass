// routes/designer.js
import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
    uploadDesignerImage,
    uploadDesignerImages,
    processAndUploadImage,
    processAndUploadImages,
    uploadBackgroundImage,
    handleUploadError
} from "../middleware/designerUpload.js";
import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// ==================== IMAGE UPLOAD ROUTES ====================

/**
 * @swagger
 * /api/designer/upload/image:
 *   post:
 *     summary: Upload a single image for use in credential designer
 *     tags: [Designer Assets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (PNG, JPG, GIF, SVG, WebP - max 10MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 image:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     width:
 *                       type: number
 *                     height:
 *                       type: number
 *                     format:
 *                       type: string
 */
router.post("/upload/image", 
    authenticate, 
    uploadDesignerImage, 
    processAndUploadImage, 
    handleUploadError,
    (req, res) => {
        if (!req.uploadedImage) {
            return res.status(400).json({
                success: false,
                message: "No image uploaded"
            });
        }

        res.json({
            success: true,
            message: "Image uploaded successfully",
            image: req.uploadedImage
        });
    }
);

/**
 * @swagger
 * /api/designer/upload/images:
 *   post:
 *     summary: Upload multiple images for use in credential designer
 *     tags: [Designer Assets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Multiple image files (max 5 files, 10MB each)
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 */
router.post("/upload/images", 
    authenticate, 
    uploadDesignerImages, 
    processAndUploadImages, 
    handleUploadError,
    (req, res) => {
        if (!req.uploadedImages || req.uploadedImages.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No images uploaded"
            });
        }

        res.json({
            success: true,
            message: `${req.uploadedImages.length} images uploaded successfully`,
            images: req.uploadedImages
        });
    }
);

/**
 * @swagger
 * /api/designer/upload/background:
 *   post:
 *     summary: Upload background image for credential
 *     tags: [Designer Assets]
 *     security:
 *       - bearerAuth: []
 */
router.post("/upload/background", 
    authenticate, 
    ...uploadBackgroundImage, 
    handleUploadError,
    (req, res) => {
        if (!req.uploadedImage) {
            return res.status(400).json({
                success: false,
                message: "No background image uploaded"
            });
        }

        res.json({
            success: true,
            message: "Background image uploaded successfully",
            backgroundImage: req.uploadedImage
        });
    }
);

// ==================== QR CODE GENERATION ROUTES ====================

/**
 * @swagger
 * /api/designer/qrcode/generate:
 *   post:
 *     summary: Generate QR code for credential verification
 *     tags: [Designer Tools]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: string
 *                 description: Data to encode in QR code (usually verification URL)
 *                 example: "https://yourapp.com/verify/abc123"
 *               options:
 *                 type: object
 *                 properties:
 *                   size:
 *                     type: number
 *                     default: 200
 *                   margin:
 *                     type: number
 *                     default: 2
 *                   color:
 *                     type: object
 *                     properties:
 *                       dark:
 *                         type: string
 *                         default: "#000000"
 *                       light:
 *                         type: string
 *                         default: "#FFFFFF"
 *     responses:
 *       200:
 *         description: QR code generated successfully
 */
router.post("/qrcode/generate", authenticate, async (req, res) => {
    try {
        const { data, options = {} } = req.body;

        if (!data) {
            return res.status(400).json({
                success: false,
                message: "Data is required to generate QR code"
            });
        }

        const qrOptions = {
            width: options.size || 200,
            margin: options.margin || 2,
            color: {
                dark: options.color?.dark || '#000000',
                light: options.color?.light || '#FFFFFF'
            },
            errorCorrectionLevel: 'M',
            type: 'image/png'
        };

        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(data, qrOptions);

        // Optionally upload to Cloudinary for permanent storage
        if (options.uploadToCloud) {
            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload(qrCodeDataUrl, {
                    folder: "credential-designer/qrcodes",
                    resource_type: "image"
                }, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                });
            });

            res.json({
                success: true,
                message: "QR code generated and uploaded successfully",
                qrCode: {
                    dataUrl: qrCodeDataUrl,
                    cloudUrl: uploadResult.secure_url,
                    publicId: uploadResult.public_id
                }
            });
        } else {
            res.json({
                success: true,
                message: "QR code generated successfully",
                qrCode: {
                    dataUrl: qrCodeDataUrl
                }
            });
        }
    } catch (error) {
        console.error("QR Code generation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate QR code",
            error: error.message
        });
    }
});

// ==================== DESIGN VALIDATION ROUTES ====================

/**
 * @swagger
 * /api/designer/validate/design:
 *   post:
 *     summary: Validate design data structure
 *     tags: [Designer Tools]
 *     security:
 *       - bearerAuth: []
 */
router.post("/validate/design", authenticate, (req, res) => {
    try {
        const { designData } = req.body;

        if (!designData) {
            return res.status(400).json({
                success: false,
                message: "Design data is required"
            });
        }

        const validationErrors = [];
        const validationWarnings = [];

        // Validate canvas
        if (!designData.canvas) {
            validationErrors.push("Canvas configuration is required");
        } else {
            if (!designData.canvas.width || designData.canvas.width < 100) {
                validationErrors.push("Canvas width must be at least 100px");
            }
            if (!designData.canvas.height || designData.canvas.height < 100) {
                validationErrors.push("Canvas height must be at least 100px");
            }
        }

        // Validate elements
        if (!designData.elements || !Array.isArray(designData.elements)) {
            validationWarnings.push("No design elements found");
        } else {
            designData.elements.forEach((element, index) => {
                if (!element.id) {
                    validationErrors.push(`Element ${index} is missing an ID`);
                }
                if (!element.type || !['text', 'image', 'qrcode', 'shape', 'line'].includes(element.type)) {
                    validationErrors.push(`Element ${index} has invalid type`);
                }
                if (element.type === 'text' && !element.content) {
                    validationWarnings.push(`Text element ${index} has no content`);
                }
                if (element.type === 'image' && !element.src) {
                    validationErrors.push(`Image element ${index} has no source URL`);
                }
            });
        }

        // Check for overlapping elements
        if (designData.elements && designData.elements.length > 1) {
            for (let i = 0; i < designData.elements.length - 1; i++) {
                for (let j = i + 1; j < designData.elements.length; j++) {
                    const elem1 = designData.elements[i];
                    const elem2 = designData.elements[j];
                    
                    if (elem1.x === elem2.x && elem1.y === elem2.y) {
                        validationWarnings.push(`Elements ${i} and ${j} are at the same position`);
                    }
                }
            }
        }

        const isValid = validationErrors.length === 0;

        res.json({
            success: true,
            isValid,
            validationErrors,
            validationWarnings,
            message: isValid ? "Design is valid" : "Design has validation errors"
        });
    } catch (error) {
        console.error("Design validation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to validate design",
            error: error.message
        });
    }
});

// ==================== FONT AND ASSET ROUTES ====================

/**
 * @swagger
 * /api/designer/fonts:
 *   get:
 *     summary: Get available fonts for the designer
 *     tags: [Designer Assets]
 *     responses:
 *       200:
 *         description: Available fonts list
 */
router.get("/fonts", (req, res) => {
    const fonts = [
        { name: 'Arial', family: 'Arial, sans-serif', category: 'sans-serif' },
        { name: 'Helvetica', family: 'Helvetica, sans-serif', category: 'sans-serif' },
        { name: 'Times New Roman', family: '"Times New Roman", serif', category: 'serif' },
        { name: 'Georgia', family: 'Georgia, serif', category: 'serif' },
        { name: 'Courier New', family: '"Courier New", monospace', category: 'monospace' },
        { name: 'Verdana', family: 'Verdana, sans-serif', category: 'sans-serif' },
        { name: 'Trebuchet MS', family: '"Trebuchet MS", sans-serif', category: 'sans-serif' },
        { name: 'Comic Sans MS', family: '"Comic Sans MS", cursive', category: 'cursive' },
        { name: 'Impact', family: 'Impact, sans-serif', category: 'sans-serif' },
        { name: 'Lucida Console', family: '"Lucida Console", monospace', category: 'monospace' },
        // Google Fonts
        { name: 'Open Sans', family: '"Open Sans", sans-serif', category: 'sans-serif', google: true },
        { name: 'Roboto', family: 'Roboto, sans-serif', category: 'sans-serif', google: true },
        { name: 'Lato', family: 'Lato, sans-serif', category: 'sans-serif', google: true },
        { name: 'Montserrat', family: 'Montserrat, sans-serif', category: 'sans-serif', google: true },
        { name: 'Oswald', family: 'Oswald, sans-serif', category: 'sans-serif', google: true },
        { name: 'Source Sans Pro', family: '"Source Sans Pro", sans-serif', category: 'sans-serif', google: true },
        { name: 'Raleway', family: 'Raleway, sans-serif', category: 'sans-serif', google: true },
        { name: 'PT Sans', family: '"PT Sans", sans-serif', category: 'sans-serif', google: true },
        { name: 'Roboto Condensed', family: '"Roboto Condensed", sans-serif', category: 'sans-serif', google: true },
        { name: 'Ubuntu', family: 'Ubuntu, sans-serif', category: 'sans-serif', google: true }
    ];

    res.json({
        success: true,
        fonts
    });
});

/**
 * @swagger
 * /api/designer/colors/palettes:
 *   get:
 *     summary: Get predefined color palettes
 *     tags: [Designer Assets]
 */
router.get("/colors/palettes", (req, res) => {
    const palettes = [
        {
            name: 'Professional Blue',
            colors: ['#003f5c', '#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600']
        },
        {
            name: 'Elegant Gray',
            colors: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6', '#bdc3c7', '#ecf0f1', '#ffffff']
        },
        {
            name: 'Academic Green',
            colors: ['#27ae60', '#2ecc71', '#58d68d', '#82e0aa', '#abebc6', '#d5f4e6', '#eafaf1']
        },
        {
            name: 'Corporate Gold',
            colors: ['#b7950b', '#d4ac0d', '#f1c40f', '#f7dc6f', '#fbeaa8', '#fef9e7']
        },
        {
            name: 'Modern Purple',
            colors: ['#6c5ce7', '#a29bfe', '#fd79a8', '#fdcb6e', '#e17055', '#00b894']
        },
        {
            name: 'Warm Sunset',
            colors: ['#fd7f28', '#fc6621', '#eb5757', '#f093fb', '#f5576c', '#4facfe']
        }
    ];

    res.json({
        success: true,
        palettes
    });
});

// ==================== TEMPLATE ELEMENTS LIBRARY ====================

/**
 * @swagger
 * /api/designer/elements/library:
 *   get:
 *     summary: Get predefined design elements library
 *     tags: [Designer Assets]
 */
router.get("/elements/library", (req, res) => {
    const elements = {
        borders: [
            {
                id: 'classic-border',
                name: 'Classic Border',
                type: 'shape',
                properties: {
                    shapeType: 'rectangle',
                    fillColor: 'transparent',
                    strokeColor: '#000000',
                    strokeWidth: 3
                }
            },
            {
                id: 'decorative-border',
                name: 'Decorative Border',
                type: 'shape',
                properties: {
                    shapeType: 'rectangle',
                    fillColor: 'transparent',
                    strokeColor: '#d4af37',
                    strokeWidth: 2
                }
            }
        ],
        shapes: [
            {
                id: 'circle',
                name: 'Circle',
                type: 'shape',
                properties: {
                    shapeType: 'circle',
                    fillColor: '#3498db',
                    strokeColor: '#2980b9',
                    strokeWidth: 1
                }
            },
            {
                id: 'star',
                name: 'Star',
                type: 'shape',
                properties: {
                    shapeType: 'star',
                    fillColor: '#f1c40f',
                    strokeColor: '#f39c12',
                    strokeWidth: 1
                }
            }
        ],
        textTemplates: [
            {
                id: 'title-large',
                name: 'Large Title',
                type: 'text',
                content: 'Certificate Title',
                properties: {
                    fontSize: 36,
                    fontWeight: 'bold',
                    fontFamily: 'Georgia',
                    color: '#2c3e50',
                    textAlign: 'center'
                }
            },
            {
                id: 'participant-name',
                name: 'Participant Name',
                type: 'text',
                content: '{{participantName}}',
                properties: {
                    fontSize: 28,
                    fontWeight: '500',
                    fontFamily: 'Arial',
                    color: '#34495e',
                    textAlign: 'center'
                }
            }
        ]
    };

    res.json({
        success: true,
        elements
    });
});

export default router;