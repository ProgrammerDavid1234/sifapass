// scripts/verifyCredits.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../models/Organization.js';

dotenv.config();

const verifyCredits = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const organization = await Organization.findOne({ 
      email: 'olonadenifemi@gmail.com' 
    });

    if (!organization) {
      console.log('❌ Organization not found');
      process.exit(1);
    }

    console.log('🏢 Organization:', organization.email);
    console.log('📊 Full Billing Object:');
    console.log(JSON.stringify(organization.billing, null, 2));
    console.log('\n💰 Credits Breakdown:');
    console.log('   Available:', organization.billing?.credits?.available);
    console.log('   Used:', organization.billing?.credits?.used);
    console.log('   Credit Rate:', organization.billing?.credits?.creditRate);
    console.log('   Plan Type:', organization.billing?.planType);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

verifyCredits();