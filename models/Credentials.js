// models/Credentials.js
import mongoose from 'mongoose';

const credentialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['certificate', 'badge', 'diploma', 'award'],
    default: 'certificate'
  },
  status: {
    type: String,
    enum: ['draft', 'generating', 'issued', 'revoked', 'failed'], // Added 'generating' and 'failed'
    default: 'draft'
  },
  designData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  participantData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  credentialUrl: {
    type: String
  },
  qrCodeUrl: {
    type: String
  },
  verificationUrl: {
    type: String
  },
  downloadLink: {
    type: String
  },
  hasGeneratedImage: {
    type: Boolean,
    default: false
  },
  exportLinks: {
    png: String,
    pdf: String,
    json: String
  },
  isShared: {
    type: Boolean,
    default: false
  },
  shareSettings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    shareableLink: String,
    expiresAt: Date
  },
  blockchainHash: {
    type: String,
    unique: true,
    sparse: true // allows multiple nulls temporarily until generated
  }
}, {
  timestamps: true
});

// Index for faster queries
credentialSchema.index({ participantId: 1, eventId: 1 });
credentialSchema.index({ createdBy: 1 });
credentialSchema.index({ status: 1 });
credentialSchema.pre('save', function (next) {
  if (!this.blockchainHash) {
    const hashData = `${this.participantId}-${this.eventId}-${Date.now()}-${Math.random()}`;
    this.blockchainHash = crypto.createHash('sha256').update(hashData).digest('hex');
  }
  next();
});
export default mongoose.model('Credential', credentialSchema);