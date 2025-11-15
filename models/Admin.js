import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  // Basic Profile Information
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  organization: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },

  // Extended Profile Information
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  website: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  logo: {
    type: String, // Base64 string or URL to logo image
    default: null
  },

  // Account Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String
  },
  verificationTokenExpires: {
    type: Date
  },

  // Password Reset
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  lastPasswordChange: {
    type: Date,
    default: null
  },

  // Security Settings
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String, // For TOTP secret key
    default: null
  },
  sessionTimeout: {
    type: Number,
    default: 30, // minutes
    min: 5,
    max: 480
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  lastLoginIP: {
    type: String,
    default: null
  },

  // Notification Preferences
  emailNotifications: {
    type: Boolean,
    default: true
  },
  pushNotifications: {
    type: Boolean,
    default: false
  },
  weeklyReports: {
    type: Boolean,
    default: true
  },
  securityAlerts: {
    type: Boolean,
    default: true
  },

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  accountSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String,
    default: null
  },

  // Role and Permissions (for future expansion)
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    default: 'admin'
  },
  permissions: [{
    type: String,
    enum: [
      'create_events',
      'manage_participants',
      'send_certificates',
      'view_analytics',
      'manage_team',
      'system_settings'
    ]
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
adminSchema.index({ email: 1 });
adminSchema.index({ verificationToken: 1 });
adminSchema.index({ resetPasswordToken: 1 });
adminSchema.index({ isVerified: 1, isActive: 1 });

// Virtual for full profile completion percentage
adminSchema.virtual('profileCompleteness').get(function() {
  let completedFields = 0;
  const totalFields = 8; // fullName, organization, email, phone, website, address, description, logo

  if (this.fullName) completedFields++;
  if (this.organization) completedFields++;
  if (this.email) completedFields++;
  if (this.phone) completedFields++;
  if (this.website) completedFields++;
  if (this.address) completedFields++;
  if (this.description) completedFields++;
  if (this.logo) completedFields++;

  return Math.round((completedFields / totalFields) * 100);
});

// Method to check if admin has specific permission
adminSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.role === 'super_admin';
};

// Method to get admin's security score
adminSchema.methods.getSecurityScore = function() {
  let score = 0;
  
  // Password strength (basic check)
  if (this.password && this.password.length >= 8) score += 25;
  
  // Two-factor authentication
  if (this.twoFactorEnabled) score += 30;
  
  // Email verified
  if (this.isVerified) score += 25;
  
  // Recent password change (within 90 days)
  if (this.lastPasswordChange && 
      (Date.now() - this.lastPasswordChange.getTime()) < (90 * 24 * 60 * 60 * 1000)) {
    score += 20;
  }

  return score;
};

// Pre-save middleware to update timestamps
adminSchema.pre('save', function(next) {
  if (this.isModified('password')) {
    this.lastPasswordChange = new Date();
  }
  next();
});

// Method to safely return admin data (without sensitive fields)
adminSchema.methods.toSafeObject = function() {
  const admin = this.toObject();
  delete admin.password;
  delete admin.verificationToken;
  delete admin.resetPasswordToken;
  delete admin.twoFactorSecret;
  return admin;
};

export default mongoose.model("Admin", adminSchema);