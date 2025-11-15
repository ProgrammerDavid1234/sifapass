// scripts/seedPlans.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Plan from '../models/Plan.js';

dotenv.config();

const plans = [
  {
    name: 'Basic',
    price: 15000,
    currency: 'NGN',
    billingCycle: 'monthly',
    features: {
      maxParticipants: 500,
      maxEventsPerMonth: 10,
      templates: 'basic',
      emailDelivery: true,
      bulkGeneration: false,
      analytics: 'basic',
      prioritySupport: false,
      apiAccess: false,
      teamCollaboration: false,
      customBranding: false,
      whiteLabel: false
    },
    isActive: true,
    isPopular: false,
    sortOrder: 1
  },
  {
    name: 'Standard',
    price: 45000,
    currency: 'NGN',
    billingCycle: 'monthly',
    features: {
      maxParticipants: 2000,
      maxEventsPerMonth: 50,
      templates: 'premium',
      emailDelivery: true,
      bulkGeneration: true,
      analytics: 'advanced',
      prioritySupport: true,
      apiAccess: false,
      teamCollaboration: false,
      customBranding: false,
      whiteLabel: false
    },
    isActive: true,
    isPopular: true,
    sortOrder: 2
  },
  {
    name: 'Professional',
    price: 85000,
    currency: 'NGN',
    billingCycle: 'monthly',
    features: {
      maxParticipants: 10000,
      maxEventsPerMonth: -1, // Unlimited
      templates: 'custom',
      emailDelivery: true,
      bulkGeneration: true,
      analytics: 'advanced',
      prioritySupport: true,
      apiAccess: true,
      teamCollaboration: true,
      customBranding: true,
      whiteLabel: true
    },
    isActive: true,
    isPopular: false,
    sortOrder: 3
  }
];

async function seedPlans() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing plans
    await Plan.deleteMany({});
    console.log('Cleared existing plans');

    // Insert new plans
    const createdPlans = await Plan.insertMany(plans);
    console.log(`Created ${createdPlans.length} plans:`);
    
    createdPlans.forEach(plan => {
      console.log(`  - ${plan.name}: ₦${plan.price.toLocaleString()}/month`);
      console.log(`    Max Participants: ${plan.features.maxParticipants}`);
      console.log(`    Max Events: ${plan.features.maxEventsPerMonth === -1 ? 'Unlimited' : plan.features.maxEventsPerMonth}`);
      console.log('');
    });

    console.log('Plans seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding plans:', error);
    process.exit(1);
  }
}

seedPlans();