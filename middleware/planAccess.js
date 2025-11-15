// middleware/planAccess.js
import Organization from '../models/Organization.js';
import Admin from '../models/Admin.js';
import Plan from '../models/Plan.js';

/**
 * Feature access levels by plan
 */
const PLAN_FEATURES = {
  free: {
    level: 0,
    maxParticipants: 50,
    maxEventsPerMonth: 2,
    templates: 'basic',
    emailDelivery: true,
    bulkGeneration: false,
    analytics: false,
    prioritySupport: false,
    apiAccess: false,
    teamCollaboration: false,
    customBranding: false,
    whiteLabel: false,
    customTemplates: false,
    exportData: false,
    advancedReports: false
  },
  Basic: {
    level: 1,
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
    whiteLabel: false,
    customTemplates: false,
    exportData: true,
    advancedReports: false
  },
  Standard: {
    level: 2,
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
    whiteLabel: false,
    customTemplates: true,
    exportData: true,
    advancedReports: true
  },
  Professional: {
    level: 3,
    maxParticipants: 10000,
    maxEventsPerMonth: -1, // unlimited
    templates: 'custom',
    emailDelivery: true,
    bulkGeneration: true,
    analytics: 'advanced',
    prioritySupport: true,
    apiAccess: true,
    teamCollaboration: true,
    customBranding: true,
    whiteLabel: true,
    customTemplates: true,
    exportData: true,
    advancedReports: true
  }
};

/**
 * Get user's current plan and features
 */
const getUserPlanInfo = async (userId) => {
  try {
    const admin = await Admin.findById(userId);
    if (!admin) {
      return { planName: 'free', features: PLAN_FEATURES.free };
    }

    const organization = await Organization.findOne({ email: admin.email });
    
    // No organization or no billing = free plan
    if (!organization || !organization.billing) {
      return { planName: 'free', features: PLAN_FEATURES.free };
    }

    // Pay-as-you-go with credits = Basic level access
    if (organization.billing.planType === 'pay-as-you-go') {
      if (organization.billing.credits.available > 0) {
        return { 
          planName: 'pay-as-you-go', 
          features: PLAN_FEATURES.Basic,
          organization 
        };
      }
      return { planName: 'free', features: PLAN_FEATURES.free, organization };
    }

    // Subscription plan
    if (organization.billing.planType === 'subscription' && 
        organization.billing.subscription.status === 'active') {
      
      const plan = await Plan.findById(organization.billing.currentPlan);
      
      if (plan) {
        const planFeatures = PLAN_FEATURES[plan.name] || PLAN_FEATURES.free;
        return { 
          planName: plan.name, 
          features: planFeatures,
          plan,
          organization 
        };
      }
    }

    // Default to free
    return { planName: 'free', features: PLAN_FEATURES.free, organization };
  } catch (error) {
    console.error('Error getting user plan info:', error);
    return { planName: 'free', features: PLAN_FEATURES.free };
  }
};

/**
 * Middleware: Require specific feature access
 * Usage: requireFeature('bulkGeneration')
 */
export const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const planInfo = await getUserPlanInfo(req.user.id);
      const hasFeature = planInfo.features[featureName];

      if (!hasFeature) {
        const requiredPlan = Object.entries(PLAN_FEATURES)
          .find(([_, features]) => features[featureName])
          ?.[0] || 'Professional';

        return res.status(403).json({
          success: false,
          message: `This feature requires ${requiredPlan} plan or higher`,
          currentPlan: planInfo.planName,
          requiredPlan,
          feature: featureName,
          upgradeRequired: true
        });
      }

      req.userPlan = planInfo;
      next();
    } catch (error) {
      console.error('Feature check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify feature access',
        error: error.message
      });
    }
  };
};

/**
 * Middleware: Require minimum plan level
 * Usage: requirePlan('Standard')
 */
export const requirePlan = (minPlanName) => {
  return async (req, res, next) => {
    try {
      const planInfo = await getUserPlanInfo(req.user.id);
      const userLevel = planInfo.features.level;
      const requiredLevel = PLAN_FEATURES[minPlanName]?.level || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: `This feature requires ${minPlanName} plan or higher`,
          currentPlan: planInfo.planName,
          requiredPlan: minPlanName,
          upgradeRequired: true
        });
      }

      req.userPlan = planInfo;
      next();
    } catch (error) {
      console.error('Plan check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify plan access',
        error: error.message
      });
    }
  };
};

/**
 * Middleware: Check event creation limit
 */
export const checkEventLimit = async (req, res, next) => {
  try {
    const planInfo = await getUserPlanInfo(req.user.id);
    
    // Free users or no organization
    if (!planInfo.organization) {
      return res.status(403).json({
        success: false,
        message: 'Please set up billing to create events',
        requiresSetup: true
      });
    }

    const maxEvents = planInfo.features.maxEventsPerMonth;
    
    // Unlimited events
    if (maxEvents === -1) {
      req.userPlan = planInfo;
      return next();
    }

    const currentUsage = planInfo.organization.billing.usage?.currentMonth?.eventsCreated || 0;

    if (currentUsage >= maxEvents) {
      const nextPlan = getNextPlanForFeature('maxEventsPerMonth', maxEvents);
      
      return res.status(403).json({
        success: false,
        message: `You've reached your monthly event limit (${maxEvents} events)`,
        currentPlan: planInfo.planName,
        currentUsage,
        limit: maxEvents,
        suggestedPlan: nextPlan,
        upgradeRequired: true
      });
    }

    req.userPlan = planInfo;
    next();
  } catch (error) {
    console.error('Event limit check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check event limit',
      error: error.message
    });
  }
};

/**
 * Middleware: Check participant limit
 */
export const checkParticipantLimit = async (req, res, next) => {
  try {
    const planInfo = await getUserPlanInfo(req.user.id);
    
    if (!planInfo.organization) {
      return res.status(403).json({
        success: false,
        message: 'Please set up billing to add participants',
        requiresSetup: true
      });
    }

    const maxParticipants = planInfo.features.maxParticipants;
    const currentUsage = planInfo.organization.billing.usage?.currentMonth?.participantsAdded || 0;

    if (currentUsage >= maxParticipants) {
      const nextPlan = getNextPlanForFeature('maxParticipants', maxParticipants);
      
      return res.status(403).json({
        success: false,
        message: `You've reached your participant limit (${maxParticipants} participants)`,
        currentPlan: planInfo.planName,
        currentUsage,
        limit: maxParticipants,
        suggestedPlan: nextPlan,
        upgradeRequired: true
      });
    }

    req.userPlan = planInfo;
    next();
  } catch (error) {
    console.error('Participant limit check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check participant limit',
      error: error.message
    });
  }
};

/**
 * Middleware: Attach user plan info to request (no blocking)
 */
export const attachPlanInfo = async (req, res, next) => {
  try {
    const planInfo = await getUserPlanInfo(req.user.id);
    req.userPlan = planInfo;
    next();
  } catch (error) {
    console.error('Attach plan info error:', error);
    // Don't block request, just continue without plan info
    next();
  }
};

/**
 * Helper: Get next plan that supports a feature
 */
const getNextPlanForFeature = (featureName, currentValue) => {
  const plans = ['Basic', 'Standard', 'Professional'];
  
  for (const planName of plans) {
    const planFeatures = PLAN_FEATURES[planName];
    if (planFeatures[featureName] > currentValue || planFeatures[featureName] === -1) {
      return planName;
    }
  }
  
  return 'Professional';
};

/**
 * API endpoint to get current user's plan features
 */
export const getPlanFeatures = async (req, res) => {
  try {
    const planInfo = await getUserPlanInfo(req.user.id);
    
    res.json({
      success: true,
      data: {
        currentPlan: planInfo.planName,
        features: planInfo.features,
        usage: planInfo.organization?.billing?.usage?.currentMonth || {
          credentialsIssued: 0,
          eventsCreated: 0,
          participantsAdded: 0
        },
        limits: {
          events: planInfo.features.maxEventsPerMonth,
          participants: planInfo.features.maxParticipants
        }
      }
    });
  } catch (error) {
    console.error('Get plan features error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get plan features',
      error: error.message
    });
  }
};

export default {
  requireFeature,
  requirePlan,
  checkEventLimit,
  checkParticipantLimit,
  attachPlanInfo,
  getPlanFeatures,
  PLAN_FEATURES
};