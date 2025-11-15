// models/Invoice.js - Enhanced for all billing scenarios
import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { 
    type: String, 
    unique: true, 
    required: true 
  },
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Organization", 
    required: true 
  },
  
  // Invoice type
  type: {
    type: String,
    enum: ['subscription', 'credit_purchase', 'plan_upgrade', 'overage'],
    required: true
  },
  
  // Related entities
  plan: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Plan" 
  },
  
  // Credit purchase details
  credits: {
    quantity: Number,
    bonusCredits: Number,
    totalCredits: Number
  },
  
  // Financial details
  amount: { 
    type: Number, 
    required: true 
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  tax: {
    amount: { type: Number, default: 0 },
    rate: { type: Number, default: 0 }
  },
  discount: {
    amount: { type: Number, default: 0 },
    code: String,
    description: String
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Payment status
  status: { 
    type: String, 
    enum: ["pending", "processing", "paid", "failed", "refunded", "cancelled"], 
    default: "pending" 
  },
  
  // Paystack integration
  paystack: {
    reference: { type: String, unique: true, sparse: true },
    transactionId: String,
    authorizationUrl: String,
    accessCode: String,
    paidAt: Date,
    channel: String, // card, bank, ussd, etc.
    ipAddress: String,
    fees: Number,
    cardType: String,
    lastFourDigits: String,
    bank: String
  },
  
  // Dates
  issueDate: { 
    type: Date, 
    default: Date.now 
  },
  dueDate: { 
    type: Date, 
    required: true 
  },
  paidDate: Date,
  
  // Invoice details
  description: String,
  notes: String,
  
  // Line items for detailed invoices
  lineItems: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number
  }],
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Calculate total amount
invoiceSchema.pre('save', function(next) {
  if (!this.totalAmount) {
    this.totalAmount = this.amount + this.tax.amount - this.discount.amount;
  }
  next();
});

export default mongoose.model("Invoice", invoiceSchema);