// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

// Load environment variables
dotenv.config();

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

// Add these imports to your existing server.js file after the existing route imports
import apiKeyRoutes from "./routes/apiKeyRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import publicApiRoutes from "./routes/publicApiRoutes.js";
import zapierRoutes from "./routes/zapierRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import { v2 as cloudinary } from "cloudinary";


// Import new designer routes (comment this out if the file doesn't exist yet)
// import designerRoutes from "./routes/designer.js";

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
        'http://localhost:3000', // Added common React dev port
        'http://localhost:8080',
        'http://localhost:8081',
        'https://sifapass-eta.vercel.app',
        'https://sifapass.vercel.app',
        'https://sifapass.onrender.com/api-docs', // Add this
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

// Rate limiting - more specific limits for different endpoints
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const designerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // More restrictive for designer uploads
    message: {
        success: false,
        message: 'Too many design requests, please try again later.'
    }
});

const exportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Very restrictive for export operations
    message: {
        success: false,
        message: 'Too many export requests, please try again later.'
    }
});

// Apply rate limiting
app.use('/api/', generalLimiter);
// Note: Removed duplicate designer limiter - will be applied in routes section

// Body parsing middleware with increased limits for designer uploads
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
        environment: process.env.NODE_ENV || 'development'
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
            },
            license: {
                name: "MIT",
                url: "https://opensource.org/licenses/MIT"
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
                    bearerFormat: "JWT",
                    description: "Enter your JWT token"
                },
            },
            schemas: {
                Error: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: false
                        },
                        message: {
                            type: "string"
                        },
                        error: {
                            type: "string"
                        }
                    }
                },
                Success: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            example: true
                        },
                        message: {
                            type: "string"
                        },
                        data: {
                            type: "object"
                        }
                    }
                }
            }
        },
        security: [{ BearerAuth: [] }],
        tags: [
            {
                name: "Admin",
                description: "Admin management operations"
            },
            {
                name: "Participants",
                description: "Participant management operations"
            },
            {
                name: "Analytics",
                description: "Analytics and reporting operations"
            },
            {
                name: "Events",
                description: "Event management operations"
            },
            {
                name: "Credentials",
                description: "Credential management operations"
            },
            {
                name: "Certificates",
                description: "Certificate management operations"
            },
            {
                name: "Templates",
                description: "Template management for credential designer"
            },
            {
                name: "Designer",
                description: "WYSIWYG designer tools and utilities"
            },
            {
                name: "Designer Assets",
                description: "Asset management for credential designer"
            },
            {
                name: "Export",
                description: "Export credentials in various formats"
            },
            {
                name: "Batch Operations",
                description: "Bulk operations for credentials"
            }
        ]
    },
    apis: ["./routes/*.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI setup with custom CSS
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #2c3e50; }
        .swagger-ui .btn.authorize { background-color: #3498db; border-color: #3498db; }
        .swagger-ui .btn.authorize:hover { background-color: #2980b9; border-color: #2980b9; }
    `,
    customSiteTitle: "Sifapass API Documentation",
    customfavIcon: "/favicon.ico",
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "none",
        filter: true,
        showExtensions: true,
        tryItOutEnabled: true
    }
}));

// API version info
app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "Sifapass API with Credential Designer & Integrations",
        version: "2.1.0",
        features: {
            credentialDesigner: true,
            templateManagement: true,
            batchOperations: true,
            multiFormatExport: true,
            blockchainVerification: true,
            qrCodeGeneration: true,
            webhookIntegrations: true,
            zapierIntegration: true,
            apiKeyManagement: true,
            externalApi: true
        },
        endpoints: {
            documentation: `${BASE_URL}/api-docs`,
            health: `${BASE_URL}/health`,
            mongoTest: `${BASE_URL}/test-mongo`,
            externalApi: `${BASE_URL}/api/v1`,
            webhooks: `${BASE_URL}/api/webhooks`,
            zapier: `${BASE_URL}/api/zapier`
        },
        integrations: {
            restApi: {
                version: "v1",
                baseUrl: `${BASE_URL}/api/v1`,
                authentication: "API Key (Bearer token)",
                rateLimit: "1000 requests per 15 minutes"
            },
            webhooks: {
                events: [
                    "credential.issued",
                    "credential.verified",
                    "credential.revoked",
                    "event.created",
                    "participant.registered"
                ],
                signatureVerification: "HMAC SHA256"
            },
            zapier: {
                triggers: [
                    "credential-issued",
                    "credential-verified"
                ],
                actions: [
                    "create-credential"
                ],
                searches: []
            }
        }
    });
});

// Add integration status endpoints for the dashboard
app.get("/api/integrations/status", async (req, res) => {
    try {
        // Check various integration statuses
        // You would fetch this data from your database

        const integrationStatus = {
            apiKeys: {
                total: 3,
                active: 2,
                lastUsed: new Date(),
                totalRequests: 15420
            },
            webhooks: {
                configured: true,
                url: "https://example.com/webhook",
                events: ["credential.issued", "credential.verified"],
                lastTriggered: new Date(),
                successRate: 98.5
            },
            zapier: {
                connected: true,
                webhookUrl: "https://hooks.zapier.com/hooks/catch/123/abc/",
                activeZaps: 5,
                lastSync: new Date()
            }
        };

        res.json({
            success: true,
            data: integrationStatus
        });

    } catch (error) {
        console.error('Integration status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch integration status',
            error: error.message
        });
    }
});

// Add webhook test endpoint for the dashboard
app.post("/api/integrations/webhook/test", async (req, res) => {
    try {
        const { webhookUrl } = req.body;

        if (!webhookUrl) {
            return res.status(400).json({
                success: false,
                message: 'Webhook URL is required'
            });
        }

        // Import the webhook function
        const { sendWebhook } = await import('./routes/webhookRoutes.js');

        const testPayload = {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            data: {
                message: 'This is a test webhook from SifaPass dashboard',
                testId: Date.now()
            }
        };

        const result = await sendWebhook(webhookUrl, testPayload, 'test_secret');

        res.json({
            success: true,
            message: 'Webhook test completed',
            data: result
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

// Add Zapier connection test endpoint
app.post("/api/integrations/zapier/test", async (req, res) => {
    try {
        const { webhookUrl } = req.body;

        if (!webhookUrl) {
            return res.status(400).json({
                success: false,
                message: 'Zapier webhook URL is required'
            });
        }

        // Import the Zapier function
        const { sendToZapier } = await import('./routes/zapierRoutes.js');

        const testData = {
            id: 'test_' + Date.now(),
            recipient_email: 'test@example.com',
            recipient_name: 'Test User',
            template_name: 'Test Certificate',
            status: 'issued',
            issued_at: new Date().toISOString(),
            test: true
        };

        // Send test data
        await sendToZapier('credential.issued', testData);

        res.json({
            success: true,
            message: 'Zapier test completed',
            data: testData
        });

    } catch (error) {
        console.error('Zapier test error:', error);
        res.status(500).json({
            success: false,
            message: 'Zapier test failed',
            error: error.message
        });
    }
});

console.log('\nIntegration Features Added:');
console.log('   - API Key Management (/api/api-keys)');
console.log('   - Webhook Configuration (/api/webhooks)');
console.log('   - Zapier Integration (/api/zapier)');
console.log('   - Public API v1 (/api/v1)');
console.log('   - Integration Status Endpoints');
console.log('   - Enhanced Swagger Documentation');

// API Routes - Apply specific rate limiting where needed

// Existing routes
app.use("/api/admin", adminRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/invoices", invoiceRoutes);

// Enhanced credential routes with export limiting
app.use("/api/credentials/export/", exportLimiter);
app.use("/api/credentials/batch/", exportLimiter);
app.use("/api/credentials", credentialRoutes);

app.use("/api/certificates", certificateRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/analytics", analyticsRoutes);
// Admin routes (legacy support)
app.use("/admin/plans", planRoutes);
app.use("/admin/invoices", invoiceRoutes);

// New designer routes - uncomment when designer.js file is created
app.use("/api/designer", designerLimiter, designerRoutes);
app.use("/api/api-keys", apiKeyRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/zapier", zapierRoutes);
app.use("/api", testRoutes);


// Public API routes (versioned)
app.use("/api/v1", publicApiRoutes);
app.use("api/admins/settings", adminRoutes);
// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('Global Error Handler:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Handle specific error types
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

    // Default error response
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            details: error
        })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        availableEndpoints: {
            api: `${BASE_URL}/api`,
            docs: `${BASE_URL}/api-docs`,
            health: `${BASE_URL}/health`
        }
    });
});

// MongoDB connection with enhanced error handling
// MongoDB connection with enhanced error handling
const connectDB = async () => {
    try {
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
            bufferCommands: false,
            // Remove the deprecated bufferMaxEntries option
            // bufferMaxEntries: 0  // <-- This line was causing the error
        };

        await mongoose.connect(process.env.MONGO_URI, options);

        console.log("MongoDB Atlas connected successfully");
        console.log(`Database: ${mongoose.connection.name}`);
        console.log(`Host: ${mongoose.connection.host}:${mongoose.connection.port}`);

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

    } catch (err) {
        console.error("MongoDB connection failed:", err.message);
        process.exit(1);
    }
};
// Graceful shutdown handling
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
            console.log(`Server running on ${BASE_URL}`);
            console.log(`API documentation: ${BASE_URL}/api-docs`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Credential Designer: Ready for integration`);
            console.log(`Security: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'} mode`);

            // Log available features
            console.log('\nAvailable Features:');
            console.log('   - Enhanced API Documentation');
            console.log('   - Rate Limiting & Security');
            console.log('   - Error Handling');
            console.log('   - Health Monitoring');
            console.log('   - Ready for Designer Integration');

            console.log('\nMonitoring:');
            console.log(`   Health Check: ${BASE_URL}/health`);
            console.log(`   MongoDB Test: ${BASE_URL}/test-mongo`);
            console.log(`   API Info: ${BASE_URL}/api`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Initialize server
startServer();