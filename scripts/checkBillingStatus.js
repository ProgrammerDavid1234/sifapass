// scripts/checkBillingStatus.js
// Run this to see exactly what's in the database
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../models/Organization.js';

dotenv.config();

const checkBillingStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the organization
    const organization = await Organization.findOne({ 
      email: 'olonadenifemi@gmail.com' 
    }).lean();

    if (!organization) {
      console.log('❌ Organization not found');
      return;
    }

    console.log('🏢 Organization Details:');
    console.log('   ID:', organization._id);
    console.log('   Name:', organization.name);
    console.log('   Email:', organization.email);
    console.log('\n💳 Billing Information:');
    console.log('   Plan Type:', organization.billing?.planType);
    console.log('   Current Plan ID:', organization.billing?.currentPlan);
    console.log('\n📅 Subscription:');
    console.log('   Status:', organization.billing?.subscription?.status);
    console.log('   Start Date:', organization.billing?.subscription?.startDate);
    console.log('   End Date:', organization.billing?.subscription?.endDate);
    console.log('\n💰 Credits:');
    console.log('   Available:', organization.billing?.credits?.available);
    console.log('   Used:', organization.billing?.credits?.used);
    console.log('\n🔧 Raw Billing Object:');
    console.log(JSON.stringify(organization.billing, null, 2));

    await mongoose.connection.close();
    console.log('\n✅ Check complete');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

checkBillingStatus();