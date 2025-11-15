// controllers/billingController.js - COMPLETE MERGED VERSION
import Organization from '../models/Organization.js';
import Admin from '../models/Admin.js';
import Plan from '../models/Plan.js';
import Invoice from '../models/Invoice.js';

export const getBillingDashboard = async (req, res) => {
  try {
    console.log('\n📊 Fetching billing dashboard...');
    console.log('   User ID:', req.user?.id);
    console.log('   User Email:', req.user?.email);

    // Find admin and organization
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    console.log('   Admin found:', admin.email);

    // CRITICAL FIX: Use lean() to bypass Mongoose cache and get fresh data
    const organization = await Organization.findOne({ email: admin.email })
      .lean() // This forces fresh data from MongoDB
      .exec();

    if (!organization) {
      console.log('   No organization found for admin:', admin.email);
      
      // Return empty dashboard for new admin
      return res.json({
        success: true,
        message: 'No organization linked. Please create an organization first.',
        data: {
          organization: null,
          billing: {
            planType: 'none',
            currentPlan: null,
            credits: { available: 0, used: 0, creditRate: 5 },
            subscription: { status: 'inactive' },
            usage: {
              currentMonth: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
              lifetime: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
              percentages: null
            },
            paymentMethod: null
          },
          plans: [],
          invoices: [],
          statistics: {
            totalSpent: 0,
            activeSubscription: false,
            creditsRemaining: 0,
            invoicesCount: { total: 0, paid: 0, pending: 0, overdue: 0 }
          }
        }
      });
    }

    console.log('   Organization found:', organization.name);
    console.log('   📊 RAW BILLING DATA FROM DB:', JSON.stringify(organization.billing, null, 2));
    console.log('   💰 CREDITS FROM DB:', organization.billing?.credits);

    // Ensure billing structure exists with fallback values
    const billing = organization.billing || {
      planType: 'pay-as-you-go',
      credits: { available: 0, used: 0, creditRate: 5 },
      subscription: { status: 'inactive' },
      usage: {
        currentMonth: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
        lifetime: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 }
      },
      paystack: {}
    };

    // Get current plan details if subscription is active
    let currentPlanDetails = null;
    if (billing.currentPlan) {
      try {
        currentPlanDetails = await Plan.findById(billing.currentPlan).lean();
        console.log('   Current plan:', currentPlanDetails?.name);
      } catch (error) {
        console.warn('   Could not fetch plan details:', error.message);
      }
    }

    // Get all available plans
    const allPlans = await Plan.find({ isActive: true }).sort({ price: 1 }).lean();
    console.log(`   Found ${allPlans.length} active plans`);

    // Get recent invoices
    const recentInvoices = await Invoice.find({ organization: organization._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    console.log(`   Found ${recentInvoices.length} invoices`);

    // Calculate usage percentages for subscription plans
    let usagePercentages = null;
    if (billing.planType === 'subscription' && currentPlanDetails) {
      const monthlyLimits = {
        credentials: currentPlanDetails.features?.credentialsPerMonth || 
                     currentPlanDetails.features?.maxParticipants || Infinity,
        events: currentPlanDetails.features?.eventsPerMonth || 
                currentPlanDetails.features?.maxEventsPerMonth || Infinity,
        participants: currentPlanDetails.features?.participantsPerMonth || 
                      currentPlanDetails.features?.maxParticipants || Infinity
      };

      const currentUsage = billing.usage?.currentMonth || {
        credentialsIssued: 0,
        eventsCreated: 0,
        participantsAdded: 0
      };

      usagePercentages = {
        credentials: monthlyLimits.credentials === Infinity 
          ? 0 
          : Math.min(100, (currentUsage.credentialsIssued / monthlyLimits.credentials) * 100),
        events: monthlyLimits.events === Infinity 
          ? 0 
          : Math.min(100, (currentUsage.eventsCreated / monthlyLimits.events) * 100),
        participants: monthlyLimits.participants === Infinity 
          ? 0 
          : Math.min(100, (currentUsage.participantsAdded / monthlyLimits.participants) * 100)
      };
    }

    // Build comprehensive response with explicit credit values
    const creditsAvailable = billing.credits?.available || 0;
    const creditsUsed = billing.credits?.used || 0;
    const creditRate = billing.credits?.creditRate || 5;

    console.log('   💰 CREDITS TO RETURN:');
    console.log('      Available:', creditsAvailable);
    console.log('      Used:', creditsUsed);
    console.log('      Rate:', creditRate);

    const dashboardData = {
      organization: {
        id: organization._id,
        name: organization.name,
        email: organization.email
      },
      billing: {
        planType: billing.planType || 'none',
        currentPlan: currentPlanDetails ? {
          id: currentPlanDetails._id,
          name: currentPlanDetails.name,
          price: currentPlanDetails.price,
          interval: currentPlanDetails.interval || currentPlanDetails.billingCycle,
          features: currentPlanDetails.features
        } : null,
        credits: {
          available: creditsAvailable,
          used: creditsUsed,
          creditRate: creditRate
        },
        subscription: {
          status: billing.subscription?.status || 'inactive',
          startDate: billing.subscription?.startDate || null,
          endDate: billing.subscription?.endDate || null,
          nextBillingDate: billing.nextBillingDate || null,
          cancelAtPeriodEnd: billing.subscription?.cancelAtPeriodEnd || false
        },
        usage: {
          currentMonth: billing.usage?.currentMonth || {
            credentialsIssued: 0,
            eventsCreated: 0,
            participantsAdded: 0
          },
          lifetime: billing.usage?.lifetime || {
            credentialsIssued: 0,
            eventsCreated: 0,
            participantsAdded: 0
          },
          percentages: usagePercentages
        },
        paymentMethod: billing.paystack?.cardType ? {
          type: 'card',
          cardType: billing.paystack.cardType,
          lastFourDigits: billing.paystack.lastFourDigits,
          bank: billing.paystack.bank
        } : null
      },
      plans: allPlans.map(plan => ({
        id: plan._id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency || 'NGN',
        interval: plan.interval || plan.billingCycle || 'monthly',
        features: plan.features,
        isActive: plan.isActive,
        isPopular: plan.isPopular || false,
        isCurrent: currentPlanDetails ? plan._id.toString() === currentPlanDetails._id.toString() : false
      })),
      invoices: recentInvoices.map(invoice => ({
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        amount: invoice.totalAmount,
        currency: invoice.currency || 'NGN',
        status: invoice.status,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        credits: invoice.credits,
        createdAt: invoice.createdAt
      })),
      statistics: {
        totalSpent: recentInvoices
          .filter(inv => inv.status === 'paid')
          .reduce((sum, inv) => sum + inv.totalAmount, 0),
        activeSubscription: billing.subscription?.status === 'active',
        creditsRemaining: creditsAvailable,
        invoicesCount: {
          total: recentInvoices.length,
          paid: recentInvoices.filter(inv => inv.status === 'paid').length,
          pending: recentInvoices.filter(inv => inv.status === 'pending').length,
          overdue: recentInvoices.filter(inv => 
            inv.status === 'pending' && new Date(inv.dueDate) < new Date()
          ).length
        }
      }
    };

    console.log('✅ Dashboard data compiled successfully');
    console.log('   💰 FINAL CREDITS IN RESPONSE:', dashboardData.billing.credits);

    res.json({
      success: true,
      message: 'Billing dashboard retrieved successfully',
      data: dashboardData
    });

  } catch (error) {
    console.error('❌ Get Billing Dashboard Error:', error.message);
    console.error('   Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing dashboard',
      error: error.message
    });
  }
};
export const getAllPlans = async (req, res) => {
  try {
    console.log('\n📋 Fetching all plans...');

    const plans = await Plan.find({ isActive: true })
      .sort({ sortOrder: 1, price: 1 });

    console.log(`✅ Found ${plans.length} active plans`);

    if (plans.length === 0) {
      return res.json({
        success: true,
        plans: [],
        message: 'No plans found. Run: node scripts/seedPlans.js'
      });
    }

    res.json({
      success: true,
      message: 'Plans retrieved successfully',
      plans: plans.map(plan => ({
        id: plan._id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency || 'NGN',
        interval: plan.interval || plan.billingCycle || 'monthly',
        features: plan.features,
        isActive: plan.isActive,
        isPopular: plan.isPopular || false,
        recommendedFor: plan.recommendedFor,
        createdAt: plan.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Get Plans Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans',
      error: error.message
    });
  }
};

export const switchPlan = async (req, res) => {
  try {
    console.log('\n🔄 Processing plan switch...');
    const { newPlanId } = req.body;
    
    if (!newPlanId) {
      return res.status(400).json({
        success: false,
        message: 'newPlanId is required'
      });
    }

    const admin = await Admin.findById(req.user.id);
    const organization = await Organization.findOne({ email: admin.email });
    
    if (!organization) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }

    const newPlan = await Plan.findById(newPlanId);
    if (!newPlan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Plan not found' 
      });
    }

    let currentPlan = null;
    if (organization.billing?.currentPlan) {
      currentPlan = await Plan.findById(organization.billing.currentPlan);
    }
    
    let proratedAmount = newPlan.price;
    let prorationType = 'none';
    
    if (currentPlan && organization.billing?.subscription?.status === 'active') {
      const now = new Date();
      const endDate = new Date(organization.billing.subscription.endDate);
      const startDate = new Date(organization.billing.subscription.startDate);
      
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      if (remainingDays > 0) {
        const unusedAmount = (currentPlan.price / totalDays) * remainingDays;
        proratedAmount = newPlan.price - unusedAmount;
        prorationType = newPlan.price > currentPlan.price ? 'upgrade' : 'downgrade';
      }
    }

    console.log('✅ Plan switch calculated');

    res.json({
      success: true,
      message: 'Plan switch calculated',
      data: {
        currentPlan: currentPlan ? {
          name: currentPlan.name,
          price: currentPlan.price
        } : null,
        newPlan: {
          name: newPlan.name,
          price: newPlan.price
        },
        proration: {
          type: prorationType,
          amount: Math.max(0, proratedAmount),
          immediateCharge: prorationType === 'upgrade',
          nextBillingAmount: newPlan.price
        }
      }
    });

  } catch (error) {
    console.error('❌ Switch Plan Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate plan switch',
      error: error.message
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    console.log('\n🚫 Processing subscription cancellation...');
    const { cancelImmediately = false } = req.body;
    
    const admin = await Admin.findById(req.user.id);
    const organization = await Organization.findOne({ email: admin.email });
    
    if (!organization) {
      return res.status(404).json({ 
        success: false, 
        message: 'Organization not found' 
      });
    }

    if (organization.billing?.planType !== 'subscription') {
      return res.status(400).json({ 
        success: false, 
        message: 'No active subscription to cancel' 
      });
    }

    if (cancelImmediately) {
      organization.billing.subscription.status = 'cancelled';
      organization.billing.subscription.endDate = new Date();
      organization.billing.planType = 'pay-as-you-go';
      organization.billing.currentPlan = null;
      console.log('   Cancelled immediately');
    } else {
      organization.billing.subscription.cancelAtPeriodEnd = true;
      console.log('   Set to cancel at period end');
    }

    await organization.save();

    console.log('✅ Subscription cancellation processed');

    res.json({
      success: true,
      message: cancelImmediately 
        ? 'Subscription cancelled immediately' 
        : 'Subscription will be cancelled at period end',
      data: {
        status: organization.billing.subscription.status,
        endDate: organization.billing.subscription.endDate,
        cancelAtPeriodEnd: organization.billing.subscription.cancelAtPeriodEnd
      }
    });

  } catch (error) {
    console.error('❌ Cancel Subscription Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};

export const getInvoiceHistory = async (req, res) => {
  try {
    console.log('\n📄 Fetching invoice history...');
    
    const admin = await Admin.findById(req.user.id);
    const organization = await Organization.findOne({ email: admin.email });
    
    if (!organization) {
      return res.json({
        success: true,
        data: {
          invoices: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 0 }
        }
      });
    }

    const { page = 1, limit = 20, status } = req.query;
    const query = { organization: organization._id };
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Invoice.countDocuments(query);

    console.log(`✅ Found ${invoices.length} invoices (page ${page})`);

    res.json({
      success: true,
      data: {
        invoices: invoices.map(inv => ({
          id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          type: inv.type,
          amount: inv.totalAmount,
          currency: inv.currency,
          status: inv.status,
          credits: inv.credits,
          dueDate: inv.dueDate,
          paidDate: inv.paidDate,
          createdAt: inv.createdAt,
          paymentMethod: inv.paystack?.cardType ? {
            type: inv.paystack.cardType,
            lastFour: inv.paystack.lastFourDigits
          } : null
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ Get Invoice History Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice history',
      error: error.message
    });
  }
};

export const getUsageStats = async (req, res) => {
  try {
    console.log('\n📊 Fetching usage statistics...');
    
    const admin = await Admin.findById(req.user.id);
    const organization = await Organization.findOne({ email: admin.email });

    if (!organization) {
      return res.json({
        success: true,
        data: {
          planType: 'none',
          currentMonth: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
          lifetime: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
          limits: {}
        }
      });
    }

    let plan = null;
    if (organization.billing?.currentPlan) {
      plan = await Plan.findById(organization.billing.currentPlan);
    }

    const usage = organization.billing?.usage || {
      currentMonth: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 },
      lifetime: { credentialsIssued: 0, eventsCreated: 0, participantsAdded: 0 }
    };

    let limits = {};
    if (organization.billing?.planType === 'subscription' && plan) {
      const maxParticipants = plan.features?.maxParticipants || Infinity;
      const maxEvents = plan.features?.maxEventsPerMonth || plan.features?.eventsPerMonth || -1;
      
      limits = {
        participants: {
          used: usage.currentMonth.participantsAdded || 0,
          limit: maxParticipants,
          percentage: maxParticipants === Infinity ? 0 : ((usage.currentMonth.participantsAdded || 0) / maxParticipants) * 100
        },
        events: {
          used: usage.currentMonth.eventsCreated || 0,
          limit: maxEvents === -1 ? 'Unlimited' : maxEvents,
          percentage: maxEvents === -1 ? 0 : ((usage.currentMonth.eventsCreated || 0) / maxEvents) * 100
        },
        credentials: {
          used: usage.currentMonth.credentialsIssued || 0,
          limit: 'Based on participants'
        }
      };
    } else if (organization.billing?.planType === 'pay-as-you-go') {
      limits = {
        credits: {
          available: organization.billing.credits?.available || 0,
          used: organization.billing.credits?.used || 0,
          rate: organization.billing.credits?.creditRate || 5
        }
      };
    }

    console.log('✅ Usage statistics compiled');

    res.json({
      success: true,
      data: {
        planType: organization.billing?.planType || 'none',
        currentMonth: usage.currentMonth,
        lifetime: usage.lifetime,
        limits
      }
    });

  } catch (error) {
    console.error('❌ Get Usage Stats Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage statistics',
      error: error.message
    });
  }
};

// Helper function to check if organization needs billing setup
export const checkBillingStatus = async (organizationId) => {
  try {
    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      return { needsSetup: true, reason: 'Organization not found' };
    }

    if (!organization.billing) {
      return { needsSetup: true, reason: 'Billing not configured' };
    }

    if (organization.billing.planType === 'pay-as-you-go') {
      if ((organization.billing.credits?.available || 0) <= 0) {
        return { 
          needsSetup: false, 
          needsCredits: true, 
          reason: 'No credits available' 
        };
      }
    }

    if (organization.billing.planType === 'subscription') {
      if (organization.billing.subscription?.status !== 'active') {
        return { 
          needsSetup: false, 
          needsRenewal: true, 
          reason: 'Subscription inactive' 
        };
      }

      if (organization.billing.subscription?.endDate && 
          new Date(organization.billing.subscription.endDate) < new Date()) {
        return { 
          needsSetup: false, 
          needsRenewal: true, 
          reason: 'Subscription expired' 
        };
      }
    }

    return { needsSetup: false, status: 'ok' };

  } catch (error) {
    console.error('Check billing status error:', error);
    return { needsSetup: true, reason: 'Error checking status' };
  }
};

export default {
  getBillingDashboard,
  getAllPlans,
  switchPlan,
  cancelSubscription,
  getInvoiceHistory,
  getUsageStats,
  checkBillingStatus
};