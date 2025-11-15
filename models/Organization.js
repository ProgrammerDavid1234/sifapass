// models/Organization.js - Enhanced with billing features
import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema({

  // Basic Info
  name: { type: String, required: true, unique: true },
  location: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  active: { type: Boolean, default: true },

  // Billing Information
  billing: {
    // Current subscription
    currentPlan: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Plan" 
    },

    planType: {
      type: String,
      enum: ['subscription', 'pay-as-you-go'],
      default: 'subscription'
    },

    // Pay-as-you-go credits
    credits: {
      available: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      creditRate: { type: Number, default: 5 } // ₦5 per credential
    },

    // Subscription info
    subscription: {
      status: { 
        type: String, 
        enum: ['active', 'inactive', 'cancelled', 'past_due', 'trialing'],
        default: 'inactive'
      },
      startDate: Date,
      endDate: Date,
      autoRenew: { type: Boolean, default: true },
      cancelAtPeriodEnd: { type: Boolean, default: false }
    },

    // Usage tracking
    usage: {
      currentMonth: {
        credentialsIssued: { type: Number, default: 0 },
        eventsCreated: { type: Number, default: 0 },
        participantsAdded: { type: Number, default: 0 }
      },
      lifetime: {
        credentialsIssued: { type: Number, default: 0 },
        eventsCreated: { type: Number, default: 0 },
        participantsAdded: { type: Number, default: 0 }
      }
    },

    // Paystack customer info
    paystack: {
      customerId: String,
      subscriptionCode: String,
      authorizationCode: String,
      lastFourDigits: String,
      cardType: String,
      bank: String
    },

    nextBillingDate: Date,
    lastBillingDate: Date,
    billingEmail: String
  },

  // Team management
  maxUsers: { type: Number, default: 10 },
  roles: { type: [String], default: ["admin", "event_manager", "viewer"] },

  teamMembers: [
    {
      name: { type: String, required: true },
      email: { type: String, required: true },
      role: { 
        type: String, 
        enum: ["admin", "editor", "viewer"], 
        default: "viewer" 
      },
      status: { 
        type: String, 
        enum: ["active", "inactive", "pending"], 
        default: "active" 
      },
      addedAt: { type: Date, default: Date.now }
    }
  ],

}, { 
  timestamps: true,
  autoIndex: false // VERY IMPORTANT to prevent old indexes from recreating
});


// Reset monthly usage on the first of each month
organizationSchema.methods.resetMonthlyUsage = function() {
  this.billing.usage.currentMonth = {
    credentialsIssued: 0,
    eventsCreated: 0,
    participantsAdded: 0
  };
  return this.save();
};


// Check plan limits
organizationSchema.methods.hasReachedLimit = async function(limitType) {
  if (this.billing.planType === 'pay-as-you-go') {
    return this.billing.credits.available <= 0;
  }

  const plan = await mongoose.model('Plan').findById(this.billing.currentPlan);
  if (!plan) return true;

  const usage = this.billing.usage.currentMonth;

  switch (limitType) {
    case 'participants':
      return usage.participantsAdded >= plan.features.maxParticipants;

    case 'events':
      return plan.features.maxEventsPerMonth !== -1 && 
             usage.eventsCreated >= plan.features.maxEventsPerMonth;

    default:
      return false;
  }
};


// Deduct credits
organizationSchema.methods.deductCredits = function(amount = 1) {
  if (this.billing.planType !== 'pay-as-you-go') {
    return { success: false, message: 'Not on pay-as-you-go plan' };
  }

  if (this.billing.credits.available < amount) {
    return { success: false, message: 'Insufficient credits' };
  }

  this.billing.credits.available -= amount;
  this.billing.credits.used += amount;
  this.billing.usage.currentMonth.credentialsIssued += amount;
  this.billing.usage.lifetime.credentialsIssued += amount;

  return { success: true, remainingCredits: this.billing.credits.available };
};


export default mongoose.models.Organization ||
  mongoose.model("Organization", organizationSchema);
