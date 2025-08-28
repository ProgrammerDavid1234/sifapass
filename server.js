import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

import participantRoutes from "./routes/participant.js";
import eventRoutes from "./routes/eventRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/invoices", invoiceRoutes);

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "My Express API",
            version: "1.0.0",
            description: "API documentation for Admin and Participants",
        },
        servers: [{ url: "http://localhost:5000" }],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
        security: [{ BearerAuth: [] }], // applies globally
    },
    apis: ["./routes/*.js"], // adjust to your routes path
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

mongoose
    .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Atlas connected"))
    .catch((err) => console.error("❌ DB Connection Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📖 Swagger docs at http://localhost:${PORT}/api-docs`);
});
