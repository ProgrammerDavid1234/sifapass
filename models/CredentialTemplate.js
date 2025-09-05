// models/CredentialTemplate.js
import mongoose from "mongoose";

const credentialTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ["certificate", "badge"],
        required: true
    },
    description: {
        type: String,
        trim: true
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
            color: { type: String, default: '#ffffff' },
            primaryColor: String,
            secondaryColor: String,
            gradientDirection: {
                type: String,
                enum: ['to right', 'to left', 'to top', 'to bottom', 'to top right', 'to top left', 'to bottom right', 'to bottom left'],
                default: 'to right'
            },
            imageUrl: String,
            imagePosition: { type: String, default: 'center' },
            imageSize: { type: String, default: 'cover' }
        },

        // Design elements array
        elements: [{
            id: { type: String, required: true },
            type: {
                type: String,
                enum: ['text', 'image', 'qrcode', 'shape', 'line'],
                required: true
            },
            // Position and size
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
            width: Number,
            height: Number,
            rotation: { type: Number, default: 0 },
            zIndex: { type: Number, default: 1 },
            
            // Text properties
            content: String,
            placeholder: String, // For dynamic content like {{participantName}}
            fontFamily: { type: String, default: 'Arial' },
            fontSize: { type: Number, default: 16 },
            fontWeight: { type: String, default: 'normal' },
            fontStyle: { type: String, default: 'normal' },
            color: { type: String, default: '#000000' },
            textAlign: { type: String, default: 'left' },
            textDecoration: String,
            lineHeight: Number,
            letterSpacing: Number,
            
            // Image properties
            src: String,
            alt: String,
            borderRadius: Number,
            opacity: { type: Number, default: 1 },
            
            // Shape properties
            shapeType: {
                type: String,
                enum: ['rectangle', 'circle', 'ellipse', 'triangle', 'star']
            },
            fillColor: String,
            strokeColor: String,
            strokeWidth: Number,
            
            // QR Code properties
            qrCodeUrl: String,
            verificationUrl: String,
            
            // Animation properties
            animation: {
                type: String,
                duration: Number,
                delay: Number,
                repeat: Boolean
            },
            
            // Conditional display
            conditions: {
                showOnType: [String], // ['certificate', 'badge']
                showForEvents: [String] // Event IDs
            }
        }],

        // Content configuration
        content: {
            titleText: { type: String, default: 'Certificate of Achievement' },
            participantNameLabel: { type: String, default: 'This is to certify that' },
            eventDescriptionTemplate: String,
            skillsTemplate: String,
            dateFormat: { type: String, default: 'MMMM DD, YYYY' },
            customFields: [{
                name: String,
                label: String,
                type: { type: String, enum: ['text', 'date', 'number'] },
                required: Boolean,
                placeholder: String
            }]
        },

        // Verification settings
        verification: {
            includeQRCode: { type: Boolean, default: true },
            qrCodePosition: {
                type: String,
                enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'],
                default: 'bottom-right'
            },
            qrCodeSize: { type: Number, default: 100 },
            includeBlockchainHash: { type: Boolean, default: true },
            hashPosition: String,
            verificationText: String,
            customVerificationUrl: String
        },

        // Export settings
        export: {
            defaultFormat: {
                type: String,
                enum: ['png', 'jpeg', 'pdf'],
                default: 'pdf'
            },
            resolution: {
                type: String,
                enum: ['low', 'medium', 'high', 'print'],
                default: 'high'
            },
            quality: { type: Number, default: 90 },
            includeMetadata: { type: Boolean, default: true }
        }
    },

    // Template metadata
    isDefault: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    category: {
        type: String,
        enum: ['academic', 'professional', 'achievement', 'participation', 'custom'],
        default: 'custom'
    },
    tags: [String],
    
    // Usage statistics
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: Date,

    // Access control
    isPublic: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    sharedWith: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        permissions: {
            type: String,
            enum: ['view', 'edit', 'admin'],
            default: 'view'
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
        createdAt: Date,
        note: String
    }]
}, {
    timestamps: true
});

// Indexes for better performance
credentialTemplateSchema.index({ type: 1, isActive: 1 });
credentialTemplateSchema.index({ createdBy: 1, isActive: 1 });
credentialTemplateSchema.index({ isPublic: 1, isActive: 1 });
credentialTemplateSchema.index({ category: 1, type: 1 });
credentialTemplateSchema.index({ tags: 1 });

// Pre-save middleware to increment version
credentialTemplateSchema.pre('save', function(next) {
    if (this.isModified('designData') && !this.isNew) {
        // Store previous version
        const versionParts = this.version.split('.').map(Number);
        versionParts[2]++; // Increment patch version
        this.version = versionParts.join('.');
        
        this.previousVersions.push({
            version: this.version,
            designData: this.designData,
            createdAt: new Date(),
            note: 'Auto-saved version'
        });

        // Keep only last 10 versions
        if (this.previousVersions.length > 10) {
            this.previousVersions = this.previousVersions.slice(-10);
        }
    }
    next();
});

// Instance methods
credentialTemplateSchema.methods.incrementUsage = function() {
    this.usageCount += 1;
    this.lastUsed = new Date();
    return this.save();
};

credentialTemplateSchema.methods.duplicate = function(newName, userId) {
    const duplicateData = this.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.usageCount;
    delete duplicateData.lastUsed;
    delete duplicateData.previousVersions;
    
    duplicateData.name = newName || `${this.name} (Copy)`;
    duplicateData.createdBy = userId;
    duplicateData.version = '1.0.0';
    duplicateData.isDefault = false;

    return new this.constructor(duplicateData);
};

// Static methods
credentialTemplateSchema.statics.getDefaultTemplate = function(type) {
    return this.findOne({ type, isDefault: true, isActive: true });
};

credentialTemplateSchema.statics.getPublicTemplates = function(type) {
    const filter = { isPublic: true, isActive: true };
    if (type) filter.type = type;
    return this.find(filter).sort({ usageCount: -1, createdAt: -1 });
};

credentialTemplateSchema.statics.getUserTemplates = function(userId, type) {
    const filter = { 
        $or: [
            { createdBy: userId },
            { 'sharedWith.user': userId }
        ],
        isActive: true
    };
    if (type) filter.type = type;
    return this.find(filter).sort({ createdAt: -1 });
};

const CredentialTemplate = mongoose.model("CredentialTemplate", credentialTemplateSchema);
export default CredentialTemplate;