// models/Plan.js - Enhanced with all features
import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    enum: ['Basic', 'Standard', 'Professional']
  },
  price: { 
    type: Number, 
    required: true 
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  features: {
    maxParticipants: { type: Number, required: true },
    maxEventsPerMonth: { type: Number, required: true }, // -1 for unlimited
    templates: { 
      type: String, 
      enum: ['basic', 'premium', 'custom'],
      required: true 
    },
    emailDelivery: { type: Boolean, default: true },
    bulkGeneration: { type: Boolean, default: false },
    analytics: { 
      type: String, 
      enum: ['basic', 'advanced'],
      default: 'basic'
    },
    prioritySupport: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    teamCollaboration: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false }
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isPopular: { 
    type: Boolean, 
    default: false 
  },
  sortOrder: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update timestamp on save
planSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Plan", planSchema);