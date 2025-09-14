import ActivityLog from "../models/ActivityLog.js";

// Get all logs (your existing function)
export const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, actor, startDate, endDate } = req.query;
    
    // Build filter object
    const filter = {};
    if (action) filter.action = action;
    if (actor) filter.actor = { $regex: actor, $options: 'i' };
    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const logs = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ActivityLog.countDocuments(filter);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch logs",
      error: err.message 
    });
  }
};

// Add a log (your existing function with enhancements)
export const addLog = async (req, res) => {
  try {
    const logData = {
      ...req.body,
      timestamp: new Date(),
      // Add IP address and user agent if available
      details: {
        ...req.body.details,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    };

    const newLog = new ActivityLog(logData);
    await newLog.save();
    
    res.status(201).json({
      success: true,
      message: "Log created successfully",
      data: newLog
    });
  } catch (err) {
    res.status(400).json({ 
      success: false, 
      message: "Failed to create log",
      error: err.message 
    });
  }
};

// New function: Log credential issuance
export const logCredentialIssued = async (credentialData, actor) => {
  try {
    await ActivityLog.create({
      action: "credential_issued",
      actor: actor,
      details: {
        credentialId: credentialData.id,
        credentialType: credentialData.type,
        eventId: credentialData.eventId,
        eventName: credentialData.eventName,
        recipientEmail: credentialData.recipientEmail
      }
    });
  } catch (error) {
    console.error('Failed to log credential issuance:', error);
  }
};

// New function: Log credential verification
export const logCredentialVerified = async (credentialId, verificationMethod, actor) => {
  try {
    await ActivityLog.create({
      action: "credential_verified",
      actor: actor || "anonymous",
      details: {
        credentialId,
        verificationMethod: verificationMethod || "qr_code",
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log credential verification:', error);
  }
};

// New function: Log credential download
export const logCredentialDownloaded = async (credentialId, downloadFormat, actor) => {
  try {
    await ActivityLog.create({
      action: "credential_downloaded",
      actor: actor,
      details: {
        credentialId,
        downloadFormat,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log credential download:', error);
  }
};

// New function: Log credential delivery
export const logCredentialDelivered = async (credentialId, deliveryMethod, recipientEmail, actor) => {
  try {
    await ActivityLog.create({
      action: "credential_delivered",
      actor: actor,
      details: {
        credentialId,
        deliveryMethod, // 'email', 'sms', 'download'
        recipientEmail,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log credential delivery:', error);
  }
};

// New function: Bulk log activities
export const bulkLogActivities = async (activities) => {
  try {
    const logs = activities.map(activity => ({
      ...activity,
      timestamp: new Date()
    }));
    
    await ActivityLog.insertMany(logs);
    return { success: true, count: logs.length };
  } catch (error) {
    console.error('Failed to bulk log activities:', error);
    return { success: false, error: error.message };
  }
};

// New function: Clean old logs (for maintenance)
export const cleanOldLogs = async (daysToKeep = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await ActivityLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });
    
    console.log(`Cleaned ${result.deletedCount} old activity logs`);
    return result;
  } catch (error) {
    console.error('Failed to clean old logs:', error);
    throw error;
  }
};