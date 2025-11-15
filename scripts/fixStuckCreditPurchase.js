// scripts/fixStuckCreditPurchase.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../models/Invoice.js';
import Organization from '../models/Organization.js';

dotenv.config();

const fixStuckCreditPurchase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the stuck invoice
    const invoice = await Invoice.findOne({
      invoiceNumber: 'INV-00008-0394',
      type: 'credit_purchase',
      status: 'processing'
    });

    if (!invoice) {
      console.log('❌ Invoice not found or already processed');
      process.exit(0);
    }

    console.log('📄 Found invoice:', {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      credits: invoice.credits,
      amount: invoice.amount
    });

    // Find the organization
    const organization = await Organization.findById(invoice.organization);
    
    if (!organization) {
      console.log('❌ Organization not found');
      process.exit(1);
    }

    console.log('🏢 Found organization:', organization.email);
    console.log('💰 Current credits:', organization.billing?.credits?.available || 0);

    // Update invoice to paid
    invoice.status = 'paid';
    invoice.paidDate = new Date();
    await invoice.save();
    console.log('✅ Invoice marked as paid');

    // Initialize billing if needed
    if (!organization.billing) {
      organization.billing = {};
    }

    if (!organization.billing.credits) {
      organization.billing.credits = {
        available: 0,
        used: 0,
        creditRate: 5
      };
    }

    // Add the credits
    const currentCredits = organization.billing.credits.available || 0;
    const creditsToAdd = invoice.credits.totalCredits || 0;
    
    organization.billing.credits.available = currentCredits + creditsToAdd;
    organization.billing.planType = 'pay-as-you-go';
    
    // Mark as modified
    organization.markModified('billing');
    organization.markModified('billing.credits');
    
    await organization.save();
    
    console.log('✅ Credits added successfully');
    console.log('💎 Credits added:', creditsToAdd);
    console.log('💰 New total:', organization.billing.credits.available);

    // Verify
    const verifyOrg = await Organization.findById(invoice.organization);
    console.log('\n🔍 Verification:');
    console.log('   Available credits:', verifyOrg.billing.credits.available);
    console.log('   Plan type:', verifyOrg.billing.planType);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixStuckCreditPurchase();