// controllers/paystackController.js - FIXED: Always read from process.env
import axios from 'axios';
import crypto from 'crypto';
import Invoice from '../models/Invoice.js';
import Organization from '../models/Organization.js';
import Admin from '../models/Admin.js';
import Plan from '../models/Plan.js';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Helper function to get the key (always fresh from process.env)
const getPaystackSecretKey = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured in environment variables');
  }
  return key;
};

// Validate at load time (but don't cache the value)
try {
  const testKey = getPaystackSecretKey();
  console.log('✅ Paystack Controller: Secret key loaded');
  console.log('   Key preview:', testKey.substring(0, 15) + '...');
} catch (error) {
  console.error('⚠️ WARNING: Paystack secret key not properly configured!');
  console.error('   Error:', error.message);
}

const paystackRequest = async (endpoint, method = 'GET', data = null) => {
  try {
    // CRITICAL: Always get fresh key from process.env
    const PAYSTACK_SECRET_KEY = getPaystackSecretKey();

    console.log('🔵 Paystack Request:', {
      endpoint,
      method,
      hasData: !!data,
      keyExists: !!PAYSTACK_SECRET_KEY,
      keyLength: PAYSTACK_SECRET_KEY.length,
      keyPreview: PAYSTACK_SECRET_KEY.substring(0, 15) + '...'
    });

    const config = {
      method,
      url: `${PAYSTACK_BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
      console.log('   Request payload:', JSON.stringify(data, null, 2));
    }

    const response = await axios(config);
    console.log('✅ Paystack Response: Success');
    return response.data;
  } catch (error) {
    console.error('❌ Paystack API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.response?.data?.message || error.message,
      fullError: error.response?.data
    });

    if (error.response?.status === 401) {
      throw new Error('Invalid Paystack API key - 401 Unauthorized');
    }

    throw new Error(error.response?.data?.message || error.message || 'Paystack request failed');
  }
};

const generateInvoiceNumber = async () => {
  const count = await Invoice.countDocuments();
  const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp for uniqueness
  return `INV-${String(count + 1).padStart(5, '0')}-${timestamp}`;
};

export const initializeSubscription = async (req, res) => {
  try {
    console.log('\n🟢 Starting subscription initialization...');
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'planId is required'
      });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const organization = await Organization.findOne({ email: admin.email });
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found for this admin'
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    console.log('📋 Plan details:', {
      name: plan.name,
      price: plan.price,
      organization: organization.email
    });

    // Generate invoice
    const invoiceNumber = await generateInvoiceNumber();
    const invoice = await Invoice.create({
      invoiceNumber,
      organization: organization._id,
      type: 'subscription',
      plan: plan._id,
      amount: plan.price,
      totalAmount: plan.price,
      currency: 'NGN',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending'
    });

    console.log('📄 Invoice created:', invoice.invoiceNumber);

    // Prepare Paystack data
    const reference = `SUB_${Date.now()}_${plan._id}`;
    const paystackData = {
      email: organization.email,
      amount: Math.round(plan.price * 100), // Convert to kobo
      reference: reference,
      callback_url: `${process.env.FRONTEND_URL}/billing/verify`,
      metadata: {
        invoiceId: invoice._id.toString(),
        organizationId: organization._id.toString(),
        type: 'subscription',
        planId: plan._id.toString(),
        planName: plan.name
      }
    };

    console.log('💳 Initializing Paystack payment...');

    // Initialize payment
    const paystackResponse = await paystackRequest(
      '/transaction/initialize',
      'POST',
      paystackData
    );

    if (paystackResponse.status && paystackResponse.data) {
      invoice.paystack = {
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        reference: reference
      };
      invoice.status = 'processing';
      await invoice.save();

      console.log('✅ Payment initialized successfully');
      console.log('   Reference:', reference);

      return res.json({
        success: true,
        message: 'Subscription payment initialized',
        data: {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          authorizationUrl: paystackResponse.data.authorization_url,
          accessCode: paystackResponse.data.access_code,
          reference: reference,
          amount: plan.price
        }
      });
    } else {
      throw new Error('Paystack response was not successful');
    }

  } catch (error) {
    console.error('❌ Initialize Subscription Error:', error.message);
    console.error('   Stack:', error.stack);

    res.status(500).json({
      success: false,
      message: 'Failed to initialize subscription payment',
      error: error.message
    });
  }
};

export const initializeCreditPurchase = async (req, res) => {
  try {
    console.log('\n🟢 Starting credit purchase initialization...');
    const { creditPackage } = req.body;

    if (!creditPackage || !creditPackage.quantity || !creditPackage.price) {
      return res.status(400).json({
        success: false,
        message: 'creditPackage with quantity and price is required'
      });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    let organization = await Organization.findOne({ email: admin.email });
    if (!organization) {
      organization = await Organization.create({
        name: admin.name || 'Organization',
        email: admin.email,
        password: 'temp_password',
        location: 'Not specified',
        billing: {
          planType: 'pay-as-you-go',
          credits: { available: 0, used: 0, creditRate: 5 },
          subscription: { status: 'inactive' },
          usage: {
            currentMonth: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
            lifetime: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 }
          },
          paystack: {}
        }
      });
    }

    // Calculate bonus credits
    let bonusCredits = 0;
    if (creditPackage.quantity === 1000) bonusCredits = 100;
    else if (creditPackage.quantity === 2500) bonusCredits = 300;
    else if (creditPackage.quantity === 5000) bonusCredits = 750;

    const totalCredits = creditPackage.quantity + bonusCredits;

    // Create invoice
    const invoiceNumber = await generateInvoiceNumber();
    const reference = `CREDIT_${Date.now()}_${organization._id}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      organization: organization._id,
      type: 'credit_purchase',
      amount: creditPackage.price,
      currency: 'NGN',
      totalAmount: creditPackage.price,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: `Purchase of ${creditPackage.quantity} credits${bonusCredits > 0 ? ` (+${bonusCredits} bonus)` : ''}`,
      credits: {
        quantity: creditPackage.quantity,
        bonusCredits: bonusCredits,
        totalCredits: totalCredits
      },
      paystack: {
        reference: reference
      }
    });

    console.log('📄 Invoice created:', invoice.invoiceNumber);
    console.log('💎 Credits:', `${creditPackage.quantity} + ${bonusCredits} bonus = ${totalCredits}`);

    const paystackData = {
      email: organization.email,
      amount: Math.round(creditPackage.price * 100),
      reference: reference,
      callback_url: `${process.env.FRONTEND_URL}/billing/verify`,
      metadata: {
        invoiceId: invoice._id.toString(),
        organizationId: organization._id.toString(),
        type: 'credit_purchase',
        credits: totalCredits
      }
    };

    console.log('💳 Initializing credit purchase payment...');

    const paystackResponse = await paystackRequest(
      '/transaction/initialize',
      'POST',
      paystackData
    );

    if (paystackResponse.status && paystackResponse.data) {
      invoice.paystack.authorizationUrl = paystackResponse.data.authorization_url;
      invoice.paystack.accessCode = paystackResponse.data.access_code;
      invoice.status = 'processing';
      await invoice.save();

      console.log('✅ Credit purchase initialized successfully');

      return res.json({
        success: true,
        message: 'Credit purchase initialized',
        data: {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          authorizationUrl: paystackResponse.data.authorization_url,
          accessCode: paystackResponse.data.access_code,
          reference: reference,
          credits: totalCredits,
          amount: creditPackage.price
        }
      });
    } else {
      throw new Error('Paystack response was not successful');
    }

  } catch (error) {
    console.error('❌ Initialize Credit Purchase Error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to initialize credit purchase',
      error: error.message
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    // Accept both 'reference' and 'trxref' (Paystack sends both)
    const reference = req.query.reference || req.query.trxref;
    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    console.log('\n🔍 Verifying payment:', reference);

    const paystackResponse = await paystackRequest(`/transaction/verify/${reference}`);

    if (!paystackResponse.status || paystackResponse.data.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        status: paystackResponse.data.status
      });
    }

    const transactionData = paystackResponse.data;

    const invoice = await Invoice.findOne({ 'paystack.reference': reference });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found for this payment reference'
      });
    }

    // Check if already processed
    if (invoice.status === 'paid') {
      console.log('⚠️ Invoice already processed:', invoice.invoiceNumber);
      const organization = await Organization.findById(invoice.organization);
      return res.json({
        success: true,
        message: 'Payment already processed',
        data: {
          invoice: {
            id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.totalAmount,
            status: invoice.status,
            paidDate: invoice.paidDate,
            type: invoice.type
          },
          organization: {
            planType: organization.billing.planType,
            credits: organization.billing.credits
          }
        }
      });
    }

    // Update invoice
    invoice.status = 'paid';
    invoice.paidDate = new Date();
    invoice.paystack.transactionId = transactionData.id;
    invoice.paystack.paidAt = new Date(transactionData.paid_at);
    invoice.paystack.channel = transactionData.channel;
    invoice.paystack.ipAddress = transactionData.ip_address;
    invoice.paystack.fees = transactionData.fees / 100;

    if (transactionData.authorization) {
      invoice.paystack.cardType = transactionData.authorization.card_type;
      invoice.paystack.lastFourDigits = transactionData.authorization.last4;
      invoice.paystack.bank = transactionData.authorization.bank;
    }

    await invoice.save();
    console.log('✅ Invoice updated:', invoice.invoiceNumber);

    // Update organization - CRITICAL FIX HERE
    const organization = await Organization.findById(invoice.organization);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    console.log('📊 Current billing state:', JSON.stringify(organization.billing, null, 2));

    // Initialize billing structure if it doesn't exist
    if (!organization.billing) {
      organization.billing = {};
    }

    // Initialize all nested objects with proper defaults
    if (!organization.billing.credits) {
      organization.billing.credits = {
        available: 0,
        used: 0,
        creditRate: 5
      };
    }

    if (!organization.billing.subscription) {
      organization.billing.subscription = {
        status: 'inactive',
        autoRenew: true,
        cancelAtPeriodEnd: false
      };
    }

    if (!organization.billing.usage) {
      organization.billing.usage = {
        currentMonth: {
          credentialsIssued: 0,
          eventsCreated: 0,
          participantsAdded: 0
        },
        lifetime: {
          credentialsIssued: 0,
          eventsCreated: 0,
          participantsAdded: 0
        }
      };
    }

    if (!organization.billing.paystack) {
      organization.billing.paystack = {};
    }

    // Process based on invoice type
    if (invoice.type === 'subscription') {
      console.log('💼 Processing subscription payment...');

      organization.billing.currentPlan = invoice.plan;
      organization.billing.planType = 'subscription';
      organization.billing.subscription.status = 'active';
      organization.billing.subscription.startDate = new Date();
      organization.billing.subscription.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      organization.billing.lastBillingDate = new Date();
      organization.billing.nextBillingDate = organization.billing.subscription.endDate;

      if (transactionData.authorization) {
        organization.billing.paystack.authorizationCode = transactionData.authorization.authorization_code;
        organization.billing.paystack.lastFourDigits = transactionData.authorization.last4;
        organization.billing.paystack.cardType = transactionData.authorization.card_type;
        organization.billing.paystack.bank = transactionData.authorization.bank;
      }

      console.log('✅ Subscription activated');

    } else if (invoice.type === 'credit_purchase') {
      console.log('💎 Processing credit purchase...');
      console.log('📋 Invoice credits:', invoice.credits);
      console.log('💰 Current available credits:', organization.billing.credits.available);

      // CRITICAL: Ensure credits object exists and has numeric values
      const currentAvailable = organization.billing.credits.available || 0;
      const creditsToAdd = invoice.credits.totalCredits || 0;

      // Add credits - explicit addition
      organization.billing.credits.available = currentAvailable + creditsToAdd;
      organization.billing.planType = 'pay-as-you-go';

      console.log(`✅ Added ${creditsToAdd} credits`);
      console.log(`💰 New total: ${organization.billing.credits.available} credits`);
    }

    // Mark the billing path as modified to ensure Mongoose saves it
    organization.markModified('billing');
    organization.markModified('billing.credits');
    organization.markModified('billing.subscription');

    // Save with error handling
    try {
      await organization.save();
      console.log('✅ Organization billing updated and saved');
      console.log('📊 Final billing state:', JSON.stringify(organization.billing, null, 2));
    } catch (saveError) {
      console.error('❌ Failed to save organization:', saveError);
      throw new Error(`Database save failed: ${saveError.message}`);
    }

    // Verify the save by re-fetching
    const verifyOrg = await Organization.findById(invoice.organization);
    console.log('🔍 Verification - Credits after save:', verifyOrg.billing.credits.available);

    console.log('✅ Payment verified and processed successfully');

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          status: invoice.status,
          paidDate: invoice.paidDate,
          type: invoice.type
        },
        transaction: {
          reference: transactionData.reference,
          amount: transactionData.amount / 100,
          channel: transactionData.channel,
          paidAt: transactionData.paid_at
        },
        organization: {
          planType: organization.billing.planType,
          ...(invoice.type === 'subscription' && {
            subscription: {
              status: organization.billing.subscription.status,
              startDate: organization.billing.subscription.startDate,
              endDate: organization.billing.subscription.endDate
            }
          }),
          ...(invoice.type === 'credit_purchase' && {
            credits: {
              available: organization.billing.credits.available,
              purchased: invoice.credits.totalCredits
            }
          })
        }
      }
    });

  } catch (error) {
    console.error('❌ Verify Payment Error:', error.message);
    console.error('   Stack:', error.stack);

    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};
export const handleWebhook = async (req, res) => {
  try {
    // CRITICAL: Get fresh key from process.env
    const PAYSTACK_SECRET_KEY = getPaystackSecretKey();

    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const event = req.body;
    console.log('📨 Paystack Webhook Event:', event.event);

    switch (event.event) {
      case 'charge.success':
        console.log('✅ Charge successful:', event.data.reference);
        // You can add additional processing here
        break;
      case 'transfer.success':
        console.log('✅ Transfer successful');
        break;
      case 'transfer.failed':
        console.log('❌ Transfer failed');
        break;
      default:
        console.log('ℹ️ Unhandled webhook event:', event.event);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Webhook Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  initializeSubscription,
  initializeCreditPurchase,
  verifyPayment,
  handleWebhook
};