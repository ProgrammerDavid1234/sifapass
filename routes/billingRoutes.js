// routes/billingRoutes.js - COMPLETE MERGED VERSION
import express from 'express';
import axios from 'axios';
import {
  getBillingDashboard,
  getAllPlans,
  switchPlan,
  cancelSubscription,
  getInvoiceHistory,
  getUsageStats
} from '../controllers/billingController.js';
import {
  initializeSubscription,
  initializeCreditPurchase,
  verifyPayment,
  handleWebhook
} from '../controllers/paystackController.js';
import { authenticate } from '../middleware/auth.js';
import { getPlanFeatures } from '../middleware/planAccess.js';
import Invoice from '../models/Invoice.js';
import Organization from '../models/Organization.js';

const router = express.Router();

// ==================== TEST ROUTES ====================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Billing routes are working!',
    timestamp: new Date().toISOString()
  });
});

router.get('/test-paystack', async (req, res) => {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    
    console.log('\n🔍 Paystack Diagnostic Test');
    console.log('   Secret Key Exists:', !!secretKey);
    console.log('   Secret Key Length:', secretKey?.length);
    console.log('   Secret Key Preview:', secretKey?.substring(0, 15) + '...');
    
    if (!secretKey) {
      return res.status(500).json({
        success: false,
        message: 'PAYSTACK_SECRET_KEY is not set in environment variables',
        envVars: {
          allPaystackVars: Object.keys(process.env).filter(k => k.includes('PAYSTACK')),
          nodeEnv: process.env.NODE_ENV
        }
      });
    }

    const response = await axios.get('https://api.paystack.co/transaction', {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Paystack API test successful');

    res.json({
      success: true,
      message: 'Paystack configuration is valid!',
      data: {
        keyConfigured: true,
        keyLength: secretKey.length,
        keyPrefix: secretKey.substring(0, 15),
        apiConnectivity: 'OK',
        testEndpoint: response.data?.status ? 'Accessible' : 'Limited access'
      }
    });

  } catch (error) {
    console.error('❌ Paystack test failed:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Paystack test failed',
      error: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      }
    });
  }
});

router.get('/debug-payment/:reference', authenticate, async (req, res) => {
  try {
    const { reference } = req.params;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    
    console.log('\n🔍 Checking payment status on Paystack...');
    console.log('   Reference:', reference);
    
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Paystack response received');
    console.log('   Status:', response.data.data?.status);
    console.log('   Amount:', response.data.data?.amount);

    res.json({
      success: true,
      message: 'Payment status retrieved from Paystack',
      paystackData: response.data,
      summary: {
        reference: reference,
        status: response.data.data?.status,
        amount: response.data.data?.amount / 100,
        paid: response.data.data?.status === 'success',
        channel: response.data.data?.channel,
        paidAt: response.data.data?.paid_at
      }
    });

  } catch (error) {
    console.error('❌ Debug payment check failed:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      }
    });
  }
});

// ==================== PLAN FEATURES ENDPOINT ====================
router.get('/plan-features', authenticate, getPlanFeatures);

// ==================== BILLING DASHBOARD ROUTES ====================
router.get('/dashboard', authenticate, getBillingDashboard);
router.get('/plans', getAllPlans);

// ==================== BILLING MANAGEMENT ROUTES ====================
router.post('/switch-plan', authenticate, switchPlan);
router.post('/cancel-subscription', authenticate, cancelSubscription);
router.get('/invoices', authenticate, getInvoiceHistory);
router.get('/usage', authenticate, getUsageStats);

// ==================== MANUAL ACTIVATION (ADMIN FIX) ====================
router.post('/activate-paid-subscription', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.body;
    
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'invoiceId is required'
      });
    }

    const invoice = await Invoice.findById(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is not paid. Status: ' + invoice.status
      });
    }

    const organization = await Organization.findById(invoice.organization);
    
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

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

    organization.billing.currentPlan = invoice.plan;
    organization.billing.planType = 'subscription';
    organization.billing.subscription = {
      status: 'active',
      startDate: invoice.paidDate || new Date(),
      endDate: new Date((invoice.paidDate || new Date()).getTime() + 30 * 24 * 60 * 60 * 1000)
    };
    organization.billing.lastBillingDate = invoice.paidDate || new Date();
    organization.billing.nextBillingDate = organization.billing.subscription.endDate;

    if (invoice.paystack) {
      if (!organization.billing.paystack) organization.billing.paystack = {};
      organization.billing.paystack.cardType = invoice.paystack.cardType;
      organization.billing.paystack.lastFourDigits = invoice.paystack.lastFourDigits;
      organization.billing.paystack.bank = invoice.paystack.bank;
    }

    await organization.save();

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      data: {
        planType: organization.billing.planType,
        currentPlan: organization.billing.currentPlan,
        subscription: organization.billing.subscription,
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          paidDate: invoice.paidDate
        }
      }
    });

  } catch (error) {
    console.error('Activate Paid Subscription Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate subscription',
      error: error.message
    });
  }
});

// ==================== PAYMENT ROUTES ====================
router.post('/payment/subscription/initialize', authenticate, initializeSubscription);
router.post('/payment/credits/initialize', authenticate, initializeCreditPurchase);

// CRITICAL FIX: Add both verify routes for frontend callback
router.get('/payment/verify', verifyPayment);  // Original route
router.get('/verify', verifyPayment);          // Frontend callback route

// ==================== WEBHOOK ROUTE ====================
router.post('/webhook/paystack', handleWebhook);

export default router;