// scripts/fixPaidSubscription.js
// Run this to fix your paid subscription that didn't update properly
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from '../models/Invoice.js';
import Organization from '../models/Organization.js';

dotenv.config();

const fixPaidSubscription = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the paid invoice
    const paidInvoice = await Invoice.findOne({ 
      invoiceNumber: 'INV-00005-3232',
      status: 'paid'
    });

    if (!paidInvoice) {
      console.log('❌ Paid invoice not found');
      return;
    }

    console.log('📄 Found paid invoice:', paidInvoice.invoiceNumber);
    console.log('   Type:', paidInvoice.type);
    console.log('   Plan ID:', paidInvoice.plan);
    console.log('   Amount:', paidInvoice.totalAmount);

    // Find the organization
    const organization = await Organization.findById(paidInvoice.organization);

    if (!organization) {
      console.log('❌ Organization not found');
      return;
    }

    console.log('🏢 Organization:', organization.name);
    console.log('   Current plan type:', organization.billing?.planType);

    // Ensure billing structure exists
    if (!organization.billing) {
      organization.billing = {
        credits: { available: 0, used: 0, creditRate: 5 },
        subscription: {},
        usage: {
          currentMonth: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
          lifetime: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 }
        },
        paystack: {}
      };
    }

    // Update organization with subscription
    organization.billing.currentPlan = paidInvoice.plan;
    organization.billing.planType = 'subscription';
    organization.billing.subscription = {
      status: 'active',
      startDate: paidInvoice.paidDate || new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    };
    organization.billing.lastBillingDate = paidInvoice.paidDate || new Date();
    organization.billing.nextBillingDate = organization.billing.subscription.endDate;

    // Update Paystack details if available
    if (paidInvoice.paystack) {
      if (!organization.billing.paystack) {
        organization.billing.paystack = {};
      }
      organization.billing.paystack.cardType = paidInvoice.paystack.cardType;
      organization.billing.paystack.lastFourDigits = paidInvoice.paystack.lastFourDigits;
      organization.billing.paystack.bank = paidInvoice.paystack.bank;
    }

    await organization.save();

    console.log('\n✅ Subscription fixed successfully!');
    console.log('   Plan Type:', organization.billing.planType);
    console.log('   Subscription Status:', organization.billing.subscription.status);
    console.log('   Start Date:', organization.billing.subscription.startDate);
    console.log('   End Date:', organization.billing.subscription.endDate);
    console.log('   Current Plan:', organization.billing.currentPlan);

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

fixPaidSubscription();