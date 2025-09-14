import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
// Import your existing models
// import Event from "../models/Event.js";
// import Credential from "../models/Credential.js";
// import Participant from "../models/Participant.js";

// Get dashboard analytics summary
export const getDashboardAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Total credentials issued (replace with your actual credential model)
    const totalCredentials = await ActivityLog.countDocuments({
      action: "credential_issued",
      timestamp: { $gte: startDate }
    });

    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - parseInt(period));
    
    const previousCredentials = await ActivityLog.countDocuments({
      action: "credential_issued",
      timestamp: { $gte: previousPeriodStart, $lt: startDate }
    });

    // Calculate percentage change
    const credentialGrowth = previousCredentials > 0 
      ? ((totalCredentials - previousCredentials) / previousCredentials * 100).toFixed(1)
      : totalCredentials > 0 ? 100 : 0;

    // Engagement rate calculation
    const verificationViews = await ActivityLog.countDocuments({
      action: "credential_verified",
      timestamp: { $gte: startDate }
    });

    const engagementRate = totalCredentials > 0 
      ? ((verificationViews / totalCredentials) * 100).toFixed(1)
      : 0;

    // Active recipients (unique actors who received credentials)
    const activeRecipients = await ActivityLog.distinct("actor", {
      action: "credential_received",
      timestamp: { $gte: startDate }
    });

    res.json({
      success: true,
      data: {
        totalCredentials,
        credentialGrowth: `${credentialGrowth >= 0 ? '+' : ''}${credentialGrowth}`,
        engagementRate: `${engagementRate}%`,
        activeRecipients: activeRecipients.length,
        verificationViews,
        period: parseInt(period)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard analytics",
      error: error.message
    });
  }
};

// Get top performing events
export const getTopPerformingEvents = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topEvents = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ["credential_issued", "credential_verified"] },
          "details.eventId": { $exists: true }
        }
      },
      {
        $group: {
          _id: "$details.eventId",
          eventName: { $first: "$details.eventName" },
          credentialsIssued: {
            $sum: { $cond: [{ $eq: ["$action", "credential_issued"] }, 1, 0] }
          },
          verifications: {
            $sum: { $cond: [{ $eq: ["$action", "credential_verified"] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          engagementScore: {
            $cond: [
              { $eq: ["$credentialsIssued", 0] },
              0,
              { $multiply: [{ $divide: ["$verifications", "$credentialsIssued"] }, 100] }
            ]
          }
        }
      },
      { $sort: { engagementScore: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: topEvents
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch top performing events",
      error: error.message
    });
  }
};

// Get recent activity
export const getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const recentActivity = await ActivityLog.find({
      action: { $in: ["credential_issued", "credential_verified", "credential_downloaded"] }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .select('action actor timestamp details');

    res.json({
      success: true,
      data: recentActivity
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activity",
      error: error.message
    });
  }
};

// Get credential issuance trend
export const getCredentialIssuanceTrend = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const trendData = await ActivityLog.aggregate([
      {
        $match: {
          action: "credential_issued",
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day"
            }
          },
          count: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      success: true,
      data: trendData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch credential issuance trend",
      error: error.message
    });
  }
};

// Get verification analytics
export const getVerificationAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const verificationData = await ActivityLog.aggregate([
      {
        $match: {
          action: "credential_verified",
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.hour": 1 }
      },
      {
        $project: {
          hour: "$_id.hour",
          count: 1,
          _id: 0
        }
      }
    ]);

    // Get verification methods breakdown
    const verificationMethods = await ActivityLog.aggregate([
      {
        $match: {
          action: "credential_verified",
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$details.verificationMethod",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        hourlyPattern: verificationData,
        methods: verificationMethods
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch verification analytics",
      error: error.message
    });
  }
};

// Get detailed metrics
export const getDetailedMetrics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Credential types breakdown
    const credentialTypes = await ActivityLog.aggregate([
      {
        $match: {
          action: "credential_issued",
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$details.credentialType",
          count: { $sum: 1 }
        }
      }
    ]);

    // Delivery methods
    const deliveryMethods = await ActivityLog.aggregate([
      {
        $match: {
          action: "credential_delivered",
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$details.deliveryMethod",
          count: { $sum: 1 }
        }
      }
    ]);

    // Verification status
    const verificationStatus = await ActivityLog.aggregate([
      {
        $match: {
          action: { $in: ["credential_issued", "credential_verified"] },
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          issued: {
            $sum: { $cond: [{ $eq: ["$action", "credential_issued"] }, 1, 0] }
          },
          verified: {
            $sum: { $cond: [{ $eq: ["$action", "credential_verified"] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          verified: "$verified",
          unverified: { $subtract: ["$issued", "$verified"] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        credentialTypes,
        deliveryMethods,
        verificationStatus: verificationStatus[0] || { verified: 0, unverified: 0 }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch detailed metrics",
      error: error.message
    });
  }
};

// Export analytics report
export const exportAnalyticsReport = async (req, res) => {
  try {
    const { period = '30', format = 'json' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get comprehensive analytics data
    const analyticsData = {
      summary: await getDashboardAnalyticsSummary(startDate),
      trends: await getCredentialTrendData(startDate),
      events: await getEventAnalytics(startDate),
      verifications: await getVerificationData(startDate)
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(analyticsData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: analyticsData,
        exportDate: new Date().toISOString(),
        period: parseInt(period)
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to export analytics report",
      error: error.message
    });
  }
};

// Helper functions
async function getDashboardAnalyticsSummary(startDate) {
  const totalCredentials = await ActivityLog.countDocuments({
    action: "credential_issued",
    timestamp: { $gte: startDate }
  });

  const verificationViews = await ActivityLog.countDocuments({
    action: "credential_verified",
    timestamp: { $gte: startDate }
  });

  return {
    totalCredentials,
    verificationViews,
    engagementRate: totalCredentials > 0 ? (verificationViews / totalCredentials * 100).toFixed(1) : 0
  };
}

async function getCredentialTrendData(startDate) {
  return await ActivityLog.aggregate([
    {
      $match: {
        action: "credential_issued",
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$timestamp" },
          month: { $month: "$timestamp" },
          day: { $dayOfMonth: "$timestamp" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);
}

async function getEventAnalytics(startDate) {
  return await ActivityLog.aggregate([
    {
      $match: {
        action: "credential_issued",
        timestamp: { $gte: startDate },
        "details.eventId": { $exists: true }
      }
    },
    {
      $group: {
        _id: "$details.eventId",
        eventName: { $first: "$details.eventName" },
        count: { $sum: 1 }
      }
    }
  ]);
}

async function getVerificationData(startDate) {
  return await ActivityLog.aggregate([
    {
      $match: {
        action: "credential_verified",
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: "$details.verificationMethod",
        count: { $sum: 1 }
      }
    }
  ]);
}

function convertToCSV(data) {
  // Simple CSV conversion - you can enhance this
  let csv = "Type,Value,Count,Date\n";
  
  // Add summary data
  if (data.summary) {
    csv += `Total Credentials,${data.summary.totalCredentials},1,${new Date().toISOString()}\n`;
    csv += `Verification Views,${data.summary.verificationViews},1,${new Date().toISOString()}\n`;
    csv += `Engagement Rate,${data.summary.engagementRate}%,1,${new Date().toISOString()}\n`;
  }

  return csv;
}