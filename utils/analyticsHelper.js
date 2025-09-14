// utils/analyticsHelper.js
import { 
  logCredentialIssued, 
  logCredentialVerified, 
  logCredentialDownloaded, 
  logCredentialDelivered 
} from "../controllers/activityLogController.js";

/**
 * Analytics helper functions to be used throughout your application
 * Call these functions when specific events occur in your credential system
 */

// Use this when a credential is issued
export const trackCredentialIssued = async (credentialData, adminEmail) => {
  try {
    await logCredentialIssued(credentialData, adminEmail);
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

// Use this when a credential is verified via QR code or link
export const trackCredentialVerified = async (credentialId, method = 'qr_code', userInfo = null) => {
  try {
    const actor = userInfo?.email || userInfo?.id || 'anonymous_verifier';
    await logCredentialVerified(credentialId, method, actor);
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

// Use this when a credential is downloaded
export const trackCredentialDownloaded = async (credentialId, format, userEmail) => {
  try {
    await logCredentialDownloaded(credentialId, format, userEmail);
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

// Use this when a credential is delivered via email/SMS
export const trackCredentialDelivered = async (credentialId, method, recipientEmail, adminEmail) => {
  try {
    await logCredentialDelivered(credentialId, method, recipientEmail, adminEmail);
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

// Batch tracking for multiple credentials
export const trackBatchCredentials = async (credentials, action, adminEmail) => {
  try {
    const activities = credentials.map(cred => ({
      action: `credential_${action}`,
      actor: adminEmail,
      details: {
        credentialId: cred.id,
        credentialType: cred.type,
        eventId: cred.eventId,
        eventName: cred.eventName,
        recipientEmail: cred.recipientEmail
      }
    }));

    // Import bulkLogActivities from your controller
    const { bulkLogActivities } = await import("../controllers/activityLogController.js");
    await bulkLogActivities(activities);
  } catch (error) {
    console.error('Batch analytics tracking error:', error);
  }
};