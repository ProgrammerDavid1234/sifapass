
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
    const verificationUrl = `${process.env.BASE_URL}/api/admin/verify-email?token=${verificationToken}`;

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


// GET ADMIN SETTINGS
export const getSettings = async (req, res) => {
  try {
    const { adminId } = req.params;

    const admin = await Admin.findById(adminId).select('-password -verificationToken -resetPasswordToken');
    
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    // Return admin data with settings structure
    const settings = {
      profile: {
        fullName: admin.fullName,
        organization: admin.organization,
        email: admin.email,
        phone: admin.phone || '',
        website: admin.website || '',
        address: admin.address || '',
        description: admin.description || '',
        logo: admin.logo || null
      },
      security: {
        twoFactorEnabled: admin.twoFactorEnabled || false,
        sessionTimeout: admin.sessionTimeout || 30,
        lastPasswordChange: admin.lastPasswordChange || null
      },
      notifications: {
        emailNotifications: admin.emailNotifications !== false, // default true
        pushNotifications: admin.pushNotifications || false,
        weeklyReports: admin.weeklyReports !== false, // default true
        securityAlerts: admin.securityAlerts !== false // default true
      },
      account: {
        isVerified: admin.isVerified,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE ADMIN PROFILE
export const updateProfile = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { 
      fullName, 
      organization, 
      email, 
      phone, 
      website, 
      address, 
      description,
      logo 
    } = req.body;

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    // If email is being changed, check if new email already exists
    if (email && email !== admin.email) {
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: adminId } });
      if (existingAdmin) {
        return res.status(400).json({ msg: "Email already exists" });
      }
    }

    // Update profile fields
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (organization) updateData.organization = organization;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website;
    if (address !== undefined) updateData.address = address;
    if (description !== undefined) updateData.description = description;
    if (logo !== undefined) updateData.logo = logo;

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      updateData,
      { new: true, select: '-password -verificationToken -resetPasswordToken' }
    );

    res.json({
      success: true,
      msg: "Profile updated successfully",
      data: {
        profile: {
          fullName: updatedAdmin.fullName,
          organization: updatedAdmin.organization,
          email: updatedAdmin.email,
          phone: updatedAdmin.phone,
          website: updatedAdmin.website,
          address: updatedAdmin.address,
          description: updatedAdmin.description,
          logo: updatedAdmin.logo
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE ADMIN PASSWORD
export const updatePassword = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ msg: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters long" });
    }

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Current password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password and last password change date
    await Admin.findByIdAndUpdate(adminId, {
      password: hashedNewPassword,
      lastPasswordChange: new Date()
    });

    // Send notification email about password change
    try {
      const mailOptions = {
        from: "certomehq@gmail.com",
        to: admin.email,
        subject: 'Password Changed Successfully',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <h2 style="color: #333;">Password Changed</h2>
            <p>Hello ${admin.fullName},</p>
            <p>Your account password has been successfully changed.</p>
            <p>If you did not make this change, please contact support immediately.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Changed on: ${new Date().toLocaleString()}
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Password change notification email error:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      msg: "Password changed successfully"
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE SECURITY SETTINGS
export const updateSecuritySettings = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { twoFactorEnabled, sessionTimeout } = req.body;

    // Validation
    if (sessionTimeout && (sessionTimeout < 5 || sessionTimeout > 480)) {
      return res.status(400).json({ msg: "Session timeout must be between 5 and 480 minutes" });
    }

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    // Update security settings
    const updateData = {};
    if (twoFactorEnabled !== undefined) updateData.twoFactorEnabled = twoFactorEnabled;
    if (sessionTimeout !== undefined) updateData.sessionTimeout = sessionTimeout;

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      updateData,
      { new: true, select: 'twoFactorEnabled sessionTimeout' }
    );

    res.json({
      success: true,
      msg: "Security settings updated successfully",
      data: {
        security: {
          twoFactorEnabled: updatedAdmin.twoFactorEnabled,
          sessionTimeout: updatedAdmin.sessionTimeout
        }
      }
    });

  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE NOTIFICATION PREFERENCES
export const updateNotificationSettings = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { 
      emailNotifications, 
      pushNotifications, 
      weeklyReports, 
      securityAlerts 
    } = req.body;

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    // Update notification settings
    const updateData = {};
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
    if (weeklyReports !== undefined) updateData.weeklyReports = weeklyReports;
    if (securityAlerts !== undefined) updateData.securityAlerts = securityAlerts;

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      updateData,
      { new: true, select: 'emailNotifications pushNotifications weeklyReports securityAlerts' }
    );

    res.json({
      success: true,
      msg: "Notification preferences updated successfully",
      data: {
        notifications: {
          emailNotifications: updatedAdmin.emailNotifications,
          pushNotifications: updatedAdmin.pushNotifications,
          weeklyReports: updatedAdmin.weeklyReports,
          securityAlerts: updatedAdmin.securityAlerts
        }
      }
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// UPDATE ALL SETTINGS AT ONCE
export const updateSettings = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { profile, security, notifications } = req.body;

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    const updateData = {};

    // Handle profile updates
    if (profile) {
      if (profile.fullName) updateData.fullName = profile.fullName;
      if (profile.organization) updateData.organization = profile.organization;
      if (profile.email && profile.email !== admin.email) {
        // Check if email already exists
        const existingAdmin = await Admin.findOne({ 
          email: profile.email, 
          _id: { $ne: adminId } 
        });
        if (existingAdmin) {
          return res.status(400).json({ msg: "Email already exists" });
        }
        updateData.email = profile.email;
      }
      if (profile.phone !== undefined) updateData.phone = profile.phone;
      if (profile.website !== undefined) updateData.website = profile.website;
      if (profile.address !== undefined) updateData.address = profile.address;
      if (profile.description !== undefined) updateData.description = profile.description;
      if (profile.logo !== undefined) updateData.logo = profile.logo;
    }

    // Handle security updates
    if (security) {
      if (security.twoFactorEnabled !== undefined) {
        updateData.twoFactorEnabled = security.twoFactorEnabled;
      }
      if (security.sessionTimeout !== undefined) {
        if (security.sessionTimeout < 5 || security.sessionTimeout > 480) {
          return res.status(400).json({ 
            msg: "Session timeout must be between 5 and 480 minutes" 
          });
        }
        updateData.sessionTimeout = security.sessionTimeout;
      }
    }

    // Handle notification updates
    if (notifications) {
      if (notifications.emailNotifications !== undefined) {
        updateData.emailNotifications = notifications.emailNotifications;
      }
      if (notifications.pushNotifications !== undefined) {
        updateData.pushNotifications = notifications.pushNotifications;
      }
      if (notifications.weeklyReports !== undefined) {
        updateData.weeklyReports = notifications.weeklyReports;
      }
      if (notifications.securityAlerts !== undefined) {
        updateData.securityAlerts = notifications.securityAlerts;
      }
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      updateData,
      { new: true, select: '-password -verificationToken -resetPasswordToken' }
    );

    // Structure response data
    const responseData = {
      profile: {
        fullName: updatedAdmin.fullName,
        organization: updatedAdmin.organization,
        email: updatedAdmin.email,
        phone: updatedAdmin.phone,
        website: updatedAdmin.website,
        address: updatedAdmin.address,
        description: updatedAdmin.description,
        logo: updatedAdmin.logo
      },
      security: {
        twoFactorEnabled: updatedAdmin.twoFactorEnabled,
        sessionTimeout: updatedAdmin.sessionTimeout
      },
      notifications: {
        emailNotifications: updatedAdmin.emailNotifications,
        pushNotifications: updatedAdmin.pushNotifications,
        weeklyReports: updatedAdmin.weeklyReports,
        securityAlerts: updatedAdmin.securityAlerts
      }
    };

    res.json({
      success: true,
      msg: "Settings updated successfully",
      data: responseData
    });

  } catch (error) {
    console.error('Update all settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE ADMIN ACCOUNT
export const deleteAccount = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { password, confirmDelete } = req.body;

    // Validation
    if (!password || !confirmDelete) {
      return res.status(400).json({ msg: "Password and confirmation required" });
    }

    if (confirmDelete !== "DELETE") {
      return res.status(400).json({ msg: "Please type 'DELETE' to confirm account deletion" });
    }

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: "Admin not found" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Password is incorrect" });
    }

    // Send account deletion notification email
    try {
      const mailOptions = {
        from: "certomehq@gmail.com",
        to: admin.email,
        subject: 'Account Deleted',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <h2 style="color: #333;">Account Deleted</h2>
            <p>Hello ${admin.fullName},</p>
            <p>Your admin account has been permanently deleted as requested.</p>
            <p>If this was not intended, please contact support immediately.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Deleted on: ${new Date().toLocaleString()}
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Account deletion notification email error:', emailError);
      // Don't fail the request if email fails
    }

    // Delete the admin account
    await Admin.findByIdAndDelete(adminId);

    res.json({
      success: true,
      msg: "Account deleted successfully"
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: error.message });
  }
};