import express from "express";
import jwt from "jsonwebtoken";
import Organization from "../models/Organization.js";

const router = express.Router();

// Secret key (put in .env in real projects)
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Create Organization
/**
 * @swagger
 * components:
 *   schemas:
 *     Organization:
 *       type: object
 *       required:
 *         - name
 *         - location
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: string
 *           description: Auto-generated ID of the organization
 *         name:
 *           type: string
 *           description: Name of the organization
 *         location:
 *           type: string
 *         email:
 *           type: string
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *           description: Default roles in the organization
 *         token:
 *           type: string
 *           description: JWT token for authentication
 *       example:
 *         id: 64fe0c4d9a8f0a3e456789ab
 *         name: TechHub
 *         location: Lagos, Nigeria
 *         email: contact@techhub.com
 *         roles: ["admin","event_manager","viewer"]
 *         token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 */

/**
 * @swagger
 * /api/organization/create:
 *   post:
 *     summary: Create a new organization
 *     tags: [Organization]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             example:
 *               name: TechHub
 *               location: Lagos
 *               email: contact@techhub.com
 *               password: Secure123!
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */

router.post("/create", async (req, res) => {
    try {
        const { name, location, email, password } = req.body;

        // 1. Validate required fields
        if (!name || !location || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // 2. Validate email format
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // 3. Password strength (min 6 chars, 1 number, 1 special char)
        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 6 characters long, contain 1 number and 1 special character"
            });
        }

        // 4. Check if email exists
        const existingOrg = await Organization.findOne({ email });
        if (existingOrg) {
            return res.status(400).json({ message: "Organization with this email already exists" });
        }

        // 5. Create organization
        const organization = new Organization({ name, location, email, password });
        await organization.save();

        // 6. Generate JWT token
        const token = jwt.sign(
            { id: organization._id, email: organization.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        // 7. Send response (exclude password)
        res.status(201).json({
            message: "Organization created successfully",
            organization: {
                id: organization._id,
                name: organization.name,
                location: organization.location,
                email: organization.email,
                roles: organization.roles
            },
            token
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

export default router;
