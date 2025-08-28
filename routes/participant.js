import express from "express";
import bcrypt from "bcryptjs";
import Participant from "../models/Participant.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// At the top of participant.js
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

/**
 * @swagger
 * /api/participants/register:
 *   post:
 *     summary: Register a new participant
 *     tags: [Participants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: David John
 *               email:
 *                 type: string
 *                 example: participant@example.com
 *               password:
 *                 type: string
 *                 example: 12345678
 *               confirmPassword:
 *                 type: string
 *                 example: 12345678
 *     responses:
 *       201:
 *         description: Participant registered successfully
 *       400:
 *         description: Validation error
 */
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password || !confirmPassword)
      return res.status(400).json({ message: "All fields are required" });

    if (password !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });

    const existingUser = await Participant.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newParticipant = new Participant({
      fullName,
      email,
      password: hashedPassword,
    });

    await newParticipant.save();

    res.status(201).json({
      message: "Participant registered successfully",
      participant: {
        id: newParticipant._id,
        fullName: newParticipant.fullName,
        email: newParticipant.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @swagger
 * /api/participants/login:
 *   post:
 *     summary: Login a participant
 *     tags: [Participants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: participant@example.com
 *               password:
 *                 type: string
 *                 example: 12345678
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const participant = await Participant.findOne({ email });
    if (!participant) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, participant.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: participant._id, email: participant.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      participant: {
        id: participant._id,
        fullName: participant.fullName,
        email: participant.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @swagger
 * /api/participants/reset-password-request:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Participants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: participant@example.com
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       400:
 *         description: Email not found
 */
router.post("/reset-password-request", async (req, res) => {
  const { email } = req.body;
  const participant = await Participant.findOne({ email });
  if (!participant) return res.status(400).json({ message: "Email not found" });

  const token = crypto.randomBytes(20).toString("hex");
  participant.resetToken = token;
  participant.resetTokenExpiry = Date.now() + 3600000; // 1 hour
  await participant.save();

  // Implement sendEmail function to send the email
  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html: `<p>Click the link to reset your password:</p>
           <a href="http://localhost:3000/reset-password/${token}">Reset Password</a>`,
  });

  res.json({ message: "Password reset email sent" });
});

/**
 * @swagger
 * /api/participants/reset-password/{token}:
 *   post:
 *     summary: Reset password using token
 *     tags: [Participants]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const participant = await Participant.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() },
  });
  if (!participant) return res.status(400).json({ message: "Invalid or expired token" });

  participant.password = await bcrypt.hash(password, 10);
  participant.resetToken = undefined;
  participant.resetTokenExpiry = undefined;
  await participant.save();

  res.json({ message: "Password reset successful" });
});

export default router;
