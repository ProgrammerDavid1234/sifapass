// scripts/testBillingAPI.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const testBillingAPI = async () => {
  try {
    // You need to get a valid token first
    // Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('https://sifapass.onrender.com/api/admin/login', {
      email: 'olonadenifemi@gmail.com',
      password: 'password' // Replace with actual password
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('   Token:', token.substring(0, 20) + '...\n');

    // Now test the billing dashboard endpoint
    console.log('📊 Testing billing dashboard API...');
    const billingResponse = await axios.get('https://sifapass.onrender.com/api/billing/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n📦 Full Response Structure:');
    console.log(JSON.stringify(billingResponse.data, null, 2));

    console.log('\n💰 Credits Path Analysis:');
    console.log('response.data.success:', billingResponse.data.success);
    console.log('response.data.data exists:', !!billingResponse.data.data);
    console.log('response.data.data.billing exists:', !!billingResponse.data.data?.billing);
    console.log('response.data.data.billing.credits:', billingResponse.data.data?.billing?.credits);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
};

testBillingAPI();