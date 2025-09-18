// models/ApiKey.js
import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    keyHash: {
        type: String,
        required: true,
        unique: true
    },
    permissions: [{
        type: String,
        enum: ['read', 'write', 'delete', 'admin'],
        default: ['read', 'write']
    }],
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    lastUsed: {
        type: Date,
        default: null
    },
    usageCount: {
        type: Number,
        default: 0
    },
    ipWhitelist: [{
        type: String
    }],
    userAgent: {
        type: String
    }
}, {
    timestamps: true
});

// Index for faster lookups
apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ organizationId: 1 });
apiKeySchema.index({ isActive: 1, expiresAt: 1 });

// Virtual for checking if key is expired
apiKeySchema.virtual('isExpired').get(function() {
    return this.expiresAt && new Date() > this.expiresAt;
});

// Method to update usage
apiKeySchema.methods.updateUsage = function(userAgent = null) {
    this.lastUsed = new Date();
    this.usageCount += 1;
    if (userAgent) this.userAgent = userAgent;
    return this.save();
};

export default mongoose.model('ApiKey', apiKeySchema);

// models/WebhookConfig.js
const webhookConfigSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true
    },
    webhookUrl: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                try {
                    new URL(v);
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Invalid webhook URL'
        }
    },
    events: [{
        type: String,
        enum: [
            'credential.issued',
            'credential.verified',
            'credential.revoked',
            'event.created',
            'participant.registered'
        ]
    }],
    secret: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastTriggered: {
        type: Date,
        default: null
    },
    successCount: {
        type: Number,
        default: 0
    },
    failureCount: {
        type: Number,
        default: 0
    },
    lastError: {
        message: String,
        timestamp: Date,
        statusCode: Number
    }
}, {
    timestamps: true
});

// Index for faster lookups
webhookConfigSchema.index({ organizationId: 1 });
webhookConfigSchema.index({ isActive: 1 });

// Virtual for success rate
webhookConfigSchema.virtual('successRate').get(function() {
    const total = this.successCount + this.failureCount;
    return total === 0 ? 100 : (this.successCount / total) * 100;
});

// Method to log webhook success
webhookConfigSchema.methods.logSuccess = function() {
    this.lastTriggered = new Date();
    this.successCount += 1;
    return this.save();
};

// Method to log webhook failure
webhookConfigSchema.methods.logFailure = function(error) {
    this.failureCount += 1;
    this.lastError = {
        message: error.message,
        timestamp: new Date(),
        statusCode: error.status || error.response?.status
    };
    return this.save();
};

export const WebhookConfig = mongoose.model('WebhookConfig', webhookConfigSchema);

// models/ZapierSubscription.js
const zapierSubscriptionSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    targetUrl: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return v.includes('hooks.zapier.com') || v.includes('localhost');
            },
            message: 'Invalid Zapier webhook URL'
        }
    },
    event: {
        type: String,
        required: true,
        enum: [
            'credential.issued',
            'credential.verified',
            'credential.revoked',
            'event.created',
            'participant.registered'
        ]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastTriggered: {
        type: Date,
        default: null
    },
    successCount: {
        type: Number,
        default: 0
    },
    failureCount: {
        type: Number,
        default: 0
    },
    zapierAppId: {
        type: String
    },
    zapierUserId: {
        type: String
    }
}, {
    timestamps: true
});

// Index for faster lookups
zapierSubscriptionSchema.index({ organizationId: 1, event: 1 });
zapierSubscriptionSchema.index({ isActive: 1 });

// Virtual for success rate
zapierSubscriptionSchema.virtual('successRate').get(function() {
    const total = this.successCount + this.failureCount;
    return total === 0 ? 100 : (this.successCount / total) * 100;
});

export const ZapierSubscription = mongoose.model('ZapierSubscription', zapierSubscriptionSchema);

// models/WebhookLog.js - For detailed webhook logging
const webhookLogSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    webhookConfigId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WebhookConfig'
    },
    zapierSubscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ZapierSubscription'
    },
    event: {
        type: String,
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    targetUrl: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'retry'],
        default: 'pending'
    },
    httpStatus: {
        type: Number
    },
    response: {
        type: mongoose.Schema.Types.Mixed
    },
    error: {
        type: String
    },
    responseTime: {
        type: Number // in milliseconds
    },
    retryCount: {
        type: Number,
        default: 0
    },
    nextRetryAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster lookups and cleanup
webhookLogSchema.index({ organizationId: 1, createdAt: -1 });
webhookLogSchema.index({ status: 1, nextRetryAt: 1 });

// TTL index to automatically delete old logs after 30 days
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const WebhookLog = mongoose.model('WebhookLog', webhookLogSchema);

// models/BatchOperation.js - For tracking batch operations
const batchOperationSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    batchId: {
        type: String,
        required: true,
        unique: true
    },
    operation: {
        type: String,
        enum: ['create_credentials', 'revoke_credentials', 'export_credentials'],
        required: true
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template'
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    totalItems: {
        type: Number,
        required: true
    },
    processedItems: {
        type: Number,
        default: 0
    },
    successfulItems: {
        type: Number,
        default: 0
    },
    failedItems: {
        type: Number,
        default: 0
    },
    errors: [{
        item: mongoose.Schema.Types.Mixed,
        error: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    estimatedCompletion: {
        type: Date
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    }
}, {
    timestamps: true
});

// Index for faster lookups
batchOperationSchema.index({ batchId: 1 });
batchOperationSchema.index({ organizationId: 1, status: 1 });
batchOperationSchema.index({ createdAt: -1 });

// Virtual for completion percentage
batchOperationSchema.virtual('completionRate').get(function() {
    return this.totalItems === 0 ? 0 : (this.processedItems / this.totalItems) * 100;
});

// Method to update progress
batchOperationSchema.methods.updateProgress = function() {
    this.progress = this.completionRate;
    this.processedItems = this.successfulItems + this.failedItems;
    
    if (this.processedItems >= this.totalItems) {
        this.status = this.failedItems === 0 ? 'completed' : 'completed';
        this.completedAt = new Date();
    }
    
    return this.save();
};

export const BatchOperation = mongoose.model('BatchOperation', batchOperationSchema);

// models/IntegrationUsage.js - For tracking API usage and analytics
const integrationUsageSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    apiKeyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey'
    },
    endpoint: {
        type: String,
        required: true
    },
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    responseTime: {
        type: Number // in milliseconds
    },
    userAgent: {
        type: String
    },
    ipAddress: {
        type: String
    },
    requestSize: {
        type: Number // in bytes
    },
    responseSize: {
        type: Number // in bytes
    }
}, {
    timestamps: true
});

// Compound index for efficient aggregation queries
integrationUsageSchema.index({ organizationId: 1, date: 1 });
integrationUsageSchema.index({ apiKeyId: 1, date: 1 });

// TTL index to automatically delete old usage logs after 90 days
integrationUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const IntegrationUsage = mongoose.model('IntegrationUsage', integrationUsageSchema);