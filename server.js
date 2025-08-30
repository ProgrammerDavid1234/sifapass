import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

import adminRoutes from "./routes/adminRoutes.js";
import participantRoutes from "./routes/participant.js";
import eventRoutes from "./routes/eventRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import credentialRoutes from "./routes/credentialRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import organizationRoutes from "./routes/Organization.js";
dotenv.config();
const app = express();

// Middleware
app.use(cors({
    origin: ['https://sifapass.onrender.com', 'http://localhost:5000'], // add your URLs
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/admin/plans", planRoutes);
app.use("/admin/invoices", invoiceRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/api/organization", organizationRoutes);

// Dynamic base URL
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Swagger options
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Sifapass API",
            version: "1.0.0",
            description: "API documentation for Admin and Participants",
        },
        servers: [{ url: BASE_URL }],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
        security: [{ BearerAuth: [] }],
    },
    apis: ["./routes/*.js"], // adjust if routes are elsewhere
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/test-mongo", async (req, res) => {
    try {
        await mongoose.connection.db.admin().ping();
        res.send("✅ MongoDB connected!");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Atlas connected"))
    .catch((err) => console.error("❌ DB Connection Error:", err));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on ${BASE_URL}`);
    console.log(`📖 Swagger docs at ${BASE_URL}/api-docs`);
});
