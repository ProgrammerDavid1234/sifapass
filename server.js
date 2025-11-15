// server.js - CRITICAL FIX: Load dotenv FIRST before ANY imports
import dotenv from "dotenv";

// MUST BE FIRST - Load environment variables before anything else
dotenv.config();

// Verify critical env vars are loaded
console.log('🔍 Environment Variables Check:');
console.log('   PAYSTACK_SECRET_KEY:', process.env.PAYSTACK_SECRET_KEY ? '✅ Loaded' : '❌ Missing');
console.log('   PAYSTACK_PUBLIC_KEY:', process.env.PAYSTACK_PUBLIC_KEY ? '✅ Loaded' : '❌ Missing');
console.log('   MONGO_URI:', process.env.MONGO_URI ? '✅ Loaded' : '❌ Missing');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Loaded' : '❌ Missing');
console.log('');

// NOW import everything else
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// Import your existing routes
import analyticsRoutes from "./routes/analyticsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import participantRoutes from "./routes/participant.js";
import eventRoutes from "./routes/eventRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import credentialRoutes from "./routes/credentialRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import organizationRoutes from "./routes/Organization.js";
import designerRoutes from "./routes/designer.js";
import apiKeyRoutes from "./routes/apiKeyRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import publicApiRoutes from "./routes/publicApiRoutes.js";
import zapierRoutes from "./routes/zapierRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import { v2 as cloudinary } from "cloudinary";

const app = express();

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.cloudinary.com"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: [
        'https://sifapass.onrender.com',
        'http://localhost:5000',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://localhost:8081',
        'https://sifapass-eta.vercel.app',
        'https://sifapass.vercel.app',
        'https://sifapass.onrender.com/api-docs',
        'https://preview--sifapass-01.lovable.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const designerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
        success: false,
        message: 'Too many design requests, please try again later.'
    }
});

const exportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many export requests, please try again later.'
    }
});

// Apply rate limiting
app.use('/api/', generalLimiter);

// Body parsing middleware
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
}));

// Static file serving
app.use("/uploads", express.static("uploads"));

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        paystackConfigured: !!process.env.PAYSTACK_SECRET_KEY
    });
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Cloudinary config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "loaded" : "missing",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "loaded" : "missing",
});

// MongoDB connection test endpoint
app.get("/test-mongo", async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.json({
            success: true,
            message: "MongoDB connected!",
            dbState: mongoose.connection.readyState
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "MongoDB connection failed",
            error: err.message
        });
    }
});

// Dynamic base URL
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Enhanced Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Sifapass API with Credential Designer",
            version: "2.0.0",
            description: "Complete API documentation for Sifapass including WYSIWYG credential designer features",
            contact: {
                name: "Sifapass Support",
                email: "support@sifapass.com"
            }
        },
        servers: [
            {
                url: BASE_URL,
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        },
        security: [{ BearerAuth: [] }]
    },
    apis: ["./routes/*.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI setup
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Sifapass API Documentation",
    swaggerOptions: {
        persistAuthorization: true
    }
}));


// API Routes
app.use("/api/admin", adminRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/credentials/export/", exportLimiter);
app.use("/api/credentials/batch/", exportLimiter);
app.use("/api/credentials", credentialRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/admin/plans", planRoutes);
app.use("/admin/invoices", invoiceRoutes);
app.use("/api/designer", designerLimiter, designerRoutes);
app.use("/api/api-keys", apiKeyRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/zapier", zapierRoutes);
app.use("/api", testRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/v1", publicApiRoutes);

// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('Global Error Handler:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        url: req.url,
        method: req.method
    });

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: Object.values(error.errors).map(err => err.message)
        });
    }

    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
    }

    if (error.code === 11000) {
        return res.status(400).json({
            success: false,
            message: 'Duplicate entry found'
        });
    }

    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack
        })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// MongoDB connection
const connectDB = async () => {
    try {
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        };

        await mongoose.connect(process.env.MONGO_URI, options);

        console.log("✅ MongoDB Atlas connected successfully");
        console.log(`   Database: ${mongoose.connection.name}`);
        console.log(`   Host: ${mongoose.connection.host}`);

    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

// Start server
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on ${BASE_URL}`);
            console.log(`📚 API documentation: ${BASE_URL}/api-docs`);
            console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💳 Paystack: ${process.env.PAYSTACK_SECRET_KEY ? '✅ Configured' : '❌ Not configured'}`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();