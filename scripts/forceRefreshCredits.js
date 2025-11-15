// scripts/forceRefreshCredits.js
// This script will force update the organization to trigger Mongoose to refresh
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../models/Organization.js';

dotenv.config();

const forceRefreshCredits = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const org = await Organization.findOne({ 
      email: 'olonadenifemi@gmail.com' 
    });

    if (!org) {
      console.log('❌ Organization not found');
      process.exit(1);
    }

    console.log('📊 Current state:');
    console.log('   ID:', org._id);
    console.log('   Email:', org.email);
    console.log('   Credits Available:', org.billing?.credits?.available);
    console.log('   Plan Type:', org.billing?.planType);

    // Force a small update to trigger Mongoose cache refresh
    org.billing.credits.available = 2800;
    org.billing.credits.used = 0;
    org.billing.planType = 'pay-as-you-go';
    
    // Mark as modified
    org.markModified('billing');
    org.markModified('billing.credits');
    
    await org.save();
    
    console.log('\n✅ Organization updated and saved');

    // Verify by re-fetching without cache
    const verifyOrg = await Organization.findById(org._id).lean();
    console.log('\n🔍 Verification (fresh from DB):');
    console.log('   Credits Available:', verifyOrg.billing?.credits?.available);
    console.log('   Credits Used:', verifyOrg.billing?.credits?.used);
    console.log('   Plan Type:', verifyOrg.billing?.planType);

    await mongoose.disconnect();
    console.log('\n✅ Done! Now restart your backend server.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

forceRefreshCredits();