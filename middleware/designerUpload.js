// middleware/designerUpload.js
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import path from "path";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Memory storage for processing
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg, webp)'));
    }
};

// Multer configuration for designer uploads
const designerUpload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Maximum 5 files at once
    },
    fileFilter: fileFilter
});

// Middleware to handle single image upload for designer
export const uploadDesignerImage = designerUpload.single('image');

// Middleware to handle multiple image uploads for designer
export const uploadDesignerImages = designerUpload.array('images', 5);

// Middleware to process and upload images to Cloudinary
export const processAndUploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return next();
        }

        const { buffer, mimetype, originalname } = req.file;
        
        // Process image with Sharp if it's not SVG
        let processedBuffer = buffer;
        let format = path.extname(originalname).toLowerCase().replace('.', '');

        if (mimetype !== 'image/svg+xml') {
            // Resize and optimize image
            const sharpImage = sharp(buffer);
            const metadata = await sharpImage.metadata();
            
            // Resize if too large while maintaining aspect ratio
            if (metadata.width > 2000 || metadata.height > 2000) {
                sharpImage.resize(2000, 2000, { 
                    fit: 'inside', 
                    withoutEnlargement: true 
                });
            }
            
            // Convert to appropriate format and optimize
            if (format === 'jpg' || format === 'jpeg') {
                processedBuffer = await sharpImage.jpeg({ quality: 85 }).toBuffer();
                format = 'jpg';
            } else if (format === 'png') {
                processedBuffer = await sharpImage.png({ compressionLevel: 6 }).toBuffer();
            } else if (format === 'webp') {
                processedBuffer = await sharpImage.webp({ quality: 85 }).toBuffer();
            } else {
                // Convert other formats to PNG
                processedBuffer = await sharpImage.png({ compressionLevel: 6 }).toBuffer();
                format = 'png';
            }
        }

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "image",
                    folder: "credential-designer",
                    format: format,
                    transformation: [
                        { quality: "auto" },
                        { fetch_format: "auto" }
                    ]
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            uploadStream.end(processedBuffer);
        });

        // Add upload result to request object
        req.uploadedImage = {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
            bytes: uploadResult.bytes,
            originalName: originalname
        };

        next();
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process and upload image',
            error: error.message
        });
    }
};

// Middleware to process multiple images
export const processAndUploadImages = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return next();
        }

        const uploadPromises = req.files.map(async (file) => {
            const { buffer, mimetype, originalname } = file;
            
            // Process image with Sharp if it's not SVG
            let processedBuffer = buffer;
            let format = path.extname(originalname).toLowerCase().replace('.', '');

            if (mimetype !== 'image/svg+xml') {
                const sharpImage = sharp(buffer);
                const metadata = await sharpImage.metadata();
                
                // Resize if too large
                if (metadata.width > 2000 || metadata.height > 2000) {
                    sharpImage.resize(2000, 2000, { 
                        fit: 'inside', 
                        withoutEnlargement: true 
                    });
                }
                
                // Optimize based on format
                if (format === 'jpg' || format === 'jpeg') {
                    processedBuffer = await sharpImage.jpeg({ quality: 85 }).toBuffer();
                    format = 'jpg';
                } else if (format === 'png') {
                    processedBuffer = await sharpImage.png({ compressionLevel: 6 }).toBuffer();
                } else {
                    processedBuffer = await sharpImage.png({ compressionLevel: 6 }).toBuffer();
                    format = 'png';
                }
            }

            // Upload to Cloudinary
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "image",
                        folder: "credential-designer",
                        format: format,
                        transformation: [
                            { quality: "auto" },
                            { fetch_format: "auto" }
                        ]
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id,
                            width: result.width,
                            height: result.height,
                            format: result.format,
                            bytes: result.bytes,
                            originalName: originalname
                        });
                    }
                );
                uploadStream.end(processedBuffer);
            });
        });

        // Wait for all uploads to complete
        req.uploadedImages = await Promise.all(uploadPromises);
        next();
    } catch (error) {
        console.error('Multiple images upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process and upload images',
            error: error.message
        });
    }
};

// Middleware to handle background image uploads
export const uploadBackgroundImage = [
    designerUpload.single('backgroundImage'),
    processAndUploadImage
];

// Middleware to delete image from Cloudinary
export const deleteCloudinaryImage = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        throw error;
    }
};

// Error handling middleware for multer
export const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    success: false,
                    message: 'File too large. Maximum size is 10MB.'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    message: 'Too many files. Maximum is 5 files.'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    message: 'Unexpected field name for file upload.'
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: 'File upload error.',
                    error: error.message
                });
        }
    } else if (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    next();
};

export default {
    uploadDesignerImage,
    uploadDesignerImages,
    processAndUploadImage,
    processAndUploadImages,
    uploadBackgroundImage,
    deleteCloudinaryImage,
    handleUploadError
};