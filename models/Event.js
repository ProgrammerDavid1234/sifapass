import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  maxParticipants: { type: Number, default: 100 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Participant" }],
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  location: { type: String },

  // New fields for your credential management interface
  eventCode: {
    type: String,
    unique: true,
    default: function () {
      const year = new Date().getFullYear();
      const randomId = Math.random().toString(36).substr(2, 3).toUpperCase();
      return `EVT-${year}-${randomId}`;
    }
  },
  category: {
    type: String,
    enum: ['Technology', 'Marketing', 'Business', 'Education', 'Healthcare', 'General'],
    default: 'General'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'active', 'completed', 'cancelled'],
    default: 'published'
  },
  registrationOpen: { type: Boolean, default: true },
  certificateTemplate: {
    id: { type: String },
    name: { type: String },
    preview: { type: String }
  },
  // Additional metadata
  tags: [String],
  isPublic: { type: Boolean, default: true },

  // Event settings
  requireApproval: { type: Boolean, default: false },
  allowWaitlist: { type: Boolean, default: true },

  // Updated timestamp
  updatedAt: { type: Date, default: Date.now }
});

// Index for better performance
eventSchema.index({ createdBy: 1, startDate: -1 });
eventSchema.index({ eventCode: 1 });

// Virtual for computed status based on dates
eventSchema.virtual('computedStatus').get(function () {
  const now = new Date();
  const eventStart = new Date(this.startDate);
  const eventEnd = this.endDate ? new Date(this.endDate) : eventStart;

  if (now >= eventStart && now <= eventEnd) {
    return 'active';
  } else if (now > eventEnd) {
    return 'completed';
  } else {
    return 'upcoming';
  }
});

// Pre-save middleware to update the updatedAt field
eventSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Event", eventSchema);