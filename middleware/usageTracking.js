// middleware/usageTracking.js
import Organization from '../models/Organization.js';

/**
 * Track credential issuance
 * Use this middleware on credential creation endpoints
 */
export const trackCredentialUsage = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if organization is on pay-as-you-go
    if (organization.billing.planType === 'pay-as-you-go') {
      // Check if they have enough credits
      if (organization.billing.credits.available <= 0) {
        return res.status(402).json({
          success: false,
          message: 'Insufficient credits. Please purchase more credits to continue.',
          creditsAvailable: organization.billing.credits.available,
          requiresPayment: true
        });
      }

      // Deduct one credit
      const result = organization.deductCredits(1);
      
      if (!result.success) {
        return res.status(402).json({
          success: false,
          message: result.message,
          requiresPayment: true
        });
      }

      await organization.save();
      
      // Attach remaining credits to request for response
      req.creditsDeducted = true;
      req.remainingCredits = result.remainingCredits;
    } 
    // Check subscription limits
    else if (organization.billing.planType === 'subscription') {
      const hasReached = await organization.hasReachedLimit('participants');
      
      if (hasReached) {
        return res.status(402).json({
          success: false,
          message: 'You have reached your plan limit. Please upgrade your plan to continue.',
          requiresUpgrade: true
        });
      }

      // Increment usage
      organization.billing.usage.currentMonth.credentialsIssued += 1;
      organization.billing.usage.lifetime.credentialsIssued += 1;
      await organization.save();
    }

    next();
  } catch (error) {
    console.error('Usage Tracking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track usage',
      error: error.message
    });
  }
};

/**
 * Track event creation
 */
export const trackEventUsage = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check subscription limits for events
    if (organization.billing.planType === 'subscription') {
      const hasReached = await organization.hasReachedLimit('events');
      
      if (hasReached) {
        return res.status(402).json({
          success: false,
          message: 'You have reached your monthly event limit. Please upgrade your plan.',
          requiresUpgrade: true
        });
      }

      // Increment usage
      organization.billing.usage.currentMonth.eventsCreated += 1;
      organization.billing.usage.lifetime.eventsCreated += 1;
      await organization.save();
    }

    next();
  } catch (error) {
    console.error('Event Usage Tracking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track event usage',
      error: error.message
    });
  }
};

/**
 * Track participant addition
 */
export const trackParticipantUsage = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (organization.billing.planType === 'subscription') {
      const hasReached = await organization.hasReachedLimit('participants');
      
      if (hasReached) {
        return res.status(402).json({
          success: false,
          message: 'You have reached your participant limit. Please upgrade your plan.',
          requiresUpgrade: true
        });
      }

      // Increment usage
      organization.billing.usage.currentMonth.participantsAdded += 1;
      organization.billing.usage.lifetime.participantsAdded += 1;
      await organization.save();
    }

    next();
  } catch (error) {
    console.error('Participant Usage Tracking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track participant usage',
      error: error.message
    });
  }
};

/**
 * Check if organization has active subscription or credits
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId || req.user.id;
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check if they have an active subscription
    if (organization.billing.planType === 'subscription') {
      if (organization.billing.subscription.status !== 'active') {
        return res.status(402).json({
          success: false,
          message: 'No active subscription. Please subscribe to a plan.',
          requiresSubscription: true
        });
      }

      // Check if subscription has expired
      const now = new Date();
      const endDate = new Date(organization.billing.subscription.endDate);
      
      if (endDate < now) {
        organization.billing.subscription.status = 'inactive';
        await organization.save();
        
        return res.status(402).json({
          success: false,
          message: 'Your subscription has expired. Please renew to continue.',
          requiresRenewal: true
        });
      }
    } 
    // Check if they have credits for pay-as-you-go
    else if (organization.billing.planType === 'pay-as-you-go') {
      if (organization.billing.credits.available <= 0) {
        return res.status(402).json({
          success: false,
          message: 'No credits available. Please purchase credits to continue.',
          requiresPayment: true
        });
      }
    } 
    // No billing setup
    else {
      return res.status(402).json({
        success: false,
        message: 'Please set up billing to use this feature.',
        requiresSetup: true
      });
    }

    next();
  } catch (error) {
    console.error('Subscription Check Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify subscription',
      error: error.message
    });
  }
};

export default {
  trackCredentialUsage,
  trackEventUsage,
  trackParticipantUsage,
  requireActiveSubscription
};