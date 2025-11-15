// scripts/findAllOrganizations.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../models/Organization.js';
import Admin from '../models/Admin.js';

dotenv.config();

const findAllOrganizations = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all organizations
    const allOrgs = await Organization.find({});
    
    console.log(`📊 Found ${allOrgs.length} organization(s):\n`);
    
    allOrgs.forEach((org, index) => {
      console.log(`--- Organization ${index + 1} ---`);
      console.log('ID:', org._id);
      console.log('Name:', org.name);
      console.log('Email:', org.email);
      console.log('Credits Available:', org.billing?.credits?.available || 0);
      console.log('Plan Type:', org.billing?.planType || 'none');
      console.log('Created At:', org.createdAt);
      console.log('');
    });

    // Find admin with matching email
    const admin = await Admin.findOne({ email: 'olonadenifemi@gmail.com' });
    if (admin) {
      console.log('👤 Admin found:');
      console.log('   Email:', admin.email);
      console.log('   Name:', admin.name);
      console.log('   ID:', admin._id);
      console.log('');
    }

    // Check which org has credits
    const orgWithCredits = allOrgs.find(org => 
      (org.billing?.credits?.available || 0) > 0
    );

    if (orgWithCredits) {
      console.log('💰 Organization WITH credits:');
      console.log('   ID:', orgWithCredits._id);
      console.log('   Email:', orgWithCredits.email);
      console.log('   Credits:', orgWithCredits.billing.credits.available);
      console.log('');
    }

    const orgMatchingAdmin = allOrgs.find(org => 
      org.email === 'olonadenifemi@gmail.com'
    );

    if (orgMatchingAdmin) {
      console.log('🔍 Organization matching admin email:');
      console.log('   ID:', orgMatchingAdmin._id);
      console.log('   Email:', orgMatchingAdmin.email);
      console.log('   Credits:', orgMatchingAdmin.billing?.credits?.available || 0);
      console.log('');
      
      if (orgMatchingAdmin._id.toString() !== orgWithCredits?._id.toString()) {
        console.log('⚠️  WARNING: The organization with credits has a DIFFERENT ID!');
        console.log('   Credits are on org:', orgWithCredits?._id);
        console.log('   But admin is linked to:', orgMatchingAdmin._id);
        console.log('');
        console.log('🔧 FIX NEEDED: Transfer credits or update email');
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

findAllOrganizations();