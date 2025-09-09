// models/Credentials.js
import mongoose from "mongoose";

const credentialSchema = new mongoose.Schema({
  // Basic credential information
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Participant",
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  type: {
    type: String,
    enum: ["certificate", "badge"],
    default: "certificate",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },

  // Template and design data
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CredentialTemplate"
  },
  designData: {
    // Canvas settings
    canvas: {
      width: { type: Number, default: 800 },
      height: { type: Number, default: 600 },
      backgroundColor: { type: String, default: '#ffffff' }
    },

    // Background settings
    background: {
      type: {
        type: String,
        enum: ['solid', 'gradient', 'image'],
        default: 'solid'
      },
      color: String,
      primaryColor: String,
      secondaryColor: String,
      gradientDirection: String,
      imageUrl: String,
      imagePosition: String,
      imageSize: String
    },

    // Design elements
    elements: [{
      id: String,
      type: {
        type: String,
        enum: ['text', 'image', 'qr-code', 'signature', 'logo', 'border', 'shape'],
        required: true
      },
      x: Number,
      y: Number,
      width: Number,
      height: Number,
      rotation: { type: Number, default: 0 },
      zIndex: { type: Number, default: 1 },

      // Text properties
      content: String,
      fontFamily: String,
      fontSize: Number,
      fontWeight: String,
      color: String,
      textAlign: String,

      // Image properties
      src: String,
      alt: String,
      opacity: Number,

      // Shape properties
      shapeType: String,
      fillColor: String,
      strokeColor: String,
      strokeWidth: Number,

      // QR Code properties
      qrCodeUrl: String,
      verificationUrl: String
    }]
  },

  // Participant-specific data used in the credential
  participantData: {
    name: String,
    email: String,
    eventTitle: String,
    eventDate: Date,
    skills: [String],
    completionDate: Date,
    grade: String,
    instructor: String,
    duration: String,
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },

  // Verification and security
  blockchainHash: {
    type: String,
    required: true,
    unique: true
  },
  qrCode: {
    type: String,
    required: true
  },
  verificationUrl: String,
  isVerified: {
    type: Boolean,
    default: true
  },
  verificationAttempts: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    result: {
      type: String,
      enum: ['success', 'failed', 'tampered'],
      default: 'success'
    }
  }],

  // Export and download links
  downloadLink: String, // Original uploaded file (if any)
  exportLinks: {
    png: String,
    jpeg: String,
    pdf: String
  },

  // Sharing and permissions
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin"
    },
    sharedAt: {
      type: Date,
      default: Date.now
    },
    permissions: {
      type: String,
      enum: ['view', 'download'],
      default: 'view'
    },
    accessCount: {
      type: Number,
      default: 0
    },
    lastAccessed: Date
  }],

  // Privacy settings
  isPublic: {
    type: Boolean,
    default: false
  },
  shareableLink: {
    token: String,
    enabled: { type: Boolean, default: false },
    expiresAt: Date,
    accessCount: { type: Number, default: 0 },
    maxAccess: Number
  },

  // Status and workflow
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'issued', 'revoked', 'expired'],
    default: 'issued'
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },
  approvedAt: Date,
  revokedAt: Date,
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },
  revocationReason: String,
  expiresAt: Date,

  // Analytics and tracking
  viewCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  lastViewed: Date,
  lastDownloaded: Date,

  // Integration data
  externalReferences: [{
    platform: String, // 'linkedin', 'blockchain', 'opensea', etc.
    referenceId: String,
    url: String,
    syncedAt: Date,
    status: {
      type: String,
      enum: ['synced', 'pending', 'failed'],
      default: 'pending'
    }
  }],

  // Version control
  version: {
    type: String,
    default: '1.0.0'
  },
  previousVersions: [{
    version: String,
    designData: mongoose.Schema.Types.Mixed,
    exportLinks: {
      png: String,
      jpeg: String,
      pdf: String
    },
    createdAt: Date,
    note: String
  }],

  // Metadata
  tags: [String],
  category: {
    type: String,
    enum: ['academic', 'professional', 'achievement', 'participation', 'skill', 'custom'],
    default: 'achievement'
  },
  customData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better performance
credentialSchema.index({ participantId: 1, eventId: 1 });
credentialSchema.index({ blockchainHash: 1 }, { unique: true });
credentialSchema.index({ type: 1, status: 1 });
credentialSchema.index({ issuedAt: -1 });
credentialSchema.index({ 'shareableLink.token': 1 });
credentialSchema.index({ 'sharedWith.user': 1 });
credentialSchema.index({ tags: 1 });
credentialSchema.index({ category: 1, type: 1 });

// Compound indexes
credentialSchema.index({ participantId: 1, issuedAt: -1 });
credentialSchema.index({ eventId: 1, status: 1, issuedAt: -1 });

// Pre-save middleware
credentialSchema.pre('save', async function (next) {
  // Generate shareable link token if not exists
  if (this.shareableLink.enabled && !this.shareableLink.token) {
    this.shareableLink.token = crypto.randomBytes(32).toString('hex');
  }

  // Update version if design data changed
  if (this.isModified('designData') && !this.isNew) {
    const versionParts = this.version.split('.').map(Number);
    versionParts[2]++; // Increment patch version
    this.version = versionParts.join('.');

    // Store previous version
    this.previousVersions.push({
      version: this.version,
      designData: this.designData,
      exportLinks: this.exportLinks,
      createdAt: new Date(),
      note: 'Design updated'
    });

    // Keep only last 5 versions
    if (this.previousVersions.length > 5) {
      this.previousVersions = this.previousVersions.slice(-5);
    }
  }

  next();
});

// Instance methods
credentialSchema.methods.incrementView = function () {
  this.viewCount += 1;
  this.lastViewed = new Date();
  return this.save();
};

credentialSchema.methods.incrementDownload = function () {
  this.downloadCount += 1;
  this.lastDownloaded = new Date();
  return this.save();
};

credentialSchema.methods.incrementShare = function () {
  this.shareCount += 1;
  return this.save();
};

credentialSchema.methods.generateShareableLink = function (maxAccess = null, expiresInDays = null) {
  this.shareableLink = {
    token: crypto.randomBytes(32).toString('hex'),
    enabled: true,
    accessCount: 0,
    maxAccess: maxAccess,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null
  };
  return this.save();
};

credentialSchema.methods.revokeCredential = function (userId, reason) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = userId;
  this.revocationReason = reason;
  return this.save();
};

credentialSchema.methods.addVerificationAttempt = function (ipAddress, userAgent, result) {
  this.verificationAttempts.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    result
  });

  // Keep only last 50 attempts
  if (this.verificationAttempts.length > 50) {
    this.verificationAttempts = this.verificationAttempts.slice(-50);
  }

  return this.save();
};

// Static methods
credentialSchema.statics.findByHash = function (hash) {
  return this.findOne({ blockchainHash: hash, status: { $ne: 'revoked' } });
};

credentialSchema.statics.findByShareableToken = function (token) {
  return this.findOne({
    'shareableLink.token': token,
    'shareableLink.enabled': true,
    $or: [
      { 'shareableLink.expiresAt': null },
      { 'shareableLink.expiresAt': { $gt: new Date() } }
    ]
  });
};

credentialSchema.statics.getStatsByEvent = function (eventId) {
  return this.aggregate([
    { $match: { eventId: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalViews: { $sum: '$viewCount' },
        totalDownloads: { $sum: '$downloadCount' }
      }
    }
  ]);
};

credentialSchema.statics.getStatsByParticipant = function (participantId) {
  return this.aggregate([
    { $match: { participantId: mongoose.Types.ObjectId(participantId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalViews: { $sum: '$viewCount' },
        totalDownloads: { $sum: '$downloadCount' }
      }
    }
  ]);
};

// Virtual fields
credentialSchema.virtual('isExpired').get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

credentialSchema.virtual('isShareableLinkValid').get(function () {
  if (!this.shareableLink.enabled) return false;
  if (this.shareableLink.expiresAt && this.shareableLink.expiresAt < new Date()) return false;
  if (this.shareableLink.maxAccess && this.shareableLink.accessCount >= this.shareableLink.maxAccess) return false;
  return true;
});

credentialSchema.virtual('publicUrl').get(function () {
  if (this.isShareableLinkValid) {
    return `${process.env.FRONTEND_URL}/credential/view/${this.shareableLink.token}`;
  }
  return null;
});

// Transform JSON output
credentialSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v;
    delete ret.shareableLink.token; // Don't expose token in general JSON responses
    return ret;
  }
});

const Credential = mongoose.model("Credential", credentialSchema);
export default Credential;