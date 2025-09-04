
import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";

// Configure nodemailer (you'll need to set up your email service)
// import nodemailer from "nodemailer";
console.log("Loaded EMAIL_USER:", process.env.EMAIL_USER);
console.log("Loaded EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "certomehq@gmail.com",
    pass: "jiayxsekzbcwjcoa", // your app password
  },
});
// REGISTER ADMIN (now sends verification email)
export const registerAdmin = async (req, res) => {
  try {
    const { fullName, organization, email, password } = req.body;

    const adminExists = await Admin.findOne({ email });
    if (adminExists) return res.status(400).json({ msg: "Admin already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const admin = new Admin({
      fullName,
      organization,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationTokenExpires
    });

    await admin.save();

    // Send verification email
    const verificationUrl = `${process.env.BASE_URL}/api/admin/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: "certomehq@gmail.com", // same as transporter
      to: email,
      subject: 'Verify Your Admin Account',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">Welcome to ${organization || 'Our Platform'}!</h2>
          <p>Hello ${fullName},</p>
          <p>Thank you for registering as an admin. Please click the button below to verify your email address and activate your account:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't create this account, please ignore this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      msg: "Admin account created successfully. Please check your email to verify your account.",
      emailSent: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
};

// VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ msg: "Verification token is required" });
    }

    const admin = await Admin.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!admin) {
      return res.status(400).json({
        msg: "Invalid or expired verification token"
      });
    }

    // Update admin as verified
    admin.isVerified = true;
    admin.verificationToken = undefined;
    admin.verificationTokenExpires = undefined;
    await admin.save();

    res.json({
      msg: "Email verified successfully. You can now login to your account.",
      verified: true
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: error.message });
  }
};

// RESEND VERIFICATION EMAIL
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    if (admin.isVerified) {
      return res.status(400).json({ msg: "Account is already verified" });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    admin.verificationToken = verificationToken;
    admin.verificationTokenExpires = verificationTokenExpires;
    await admin.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: "certomehq@gmail.com", // same as transporter
      to: email,
      subject: 'Verify Your Admin Account - Resent',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Hello ${admin.fullName},</p>
          <p>You requested a new verification email. Please click the button below to verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This link will expire in 24 hours.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      msg: "Verification email sent successfully. Please check your email.",
      emailSent: true
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: error.message });
  }
};

// LOGIN ADMIN (now checks if email is verified)
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ msg: "Invalid credentials" });

    // Check if email is verified
    if (!admin.isVerified) {
      return res.status(400).json({
        msg: "Please verify your email before logging in",
        emailNotVerified: true
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1h"
    });

    res.json({
      token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        organization: admin.organization,
        isVerified: admin.isVerified
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};



// GET METRICS
export const getMetrics = async (req, res) => {
  try {
    const metrics = await SomeMetricsModel.find(); // replace with real logic
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DOWNLOAD REPORT
export const downloadReport = async (req, res) => {
  const format = req.query.format || "csv";
  try {
    const data = await generateReport(); // replace with real report logic
    if (format === "csv") {
      res.setHeader("Content-Disposition", "attachment; filename=report.csv");
      res.setHeader("Content-Type", "text/csv");
      res.send(convertToCSV(data)); // implement convertToCSV function
    } else {
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

