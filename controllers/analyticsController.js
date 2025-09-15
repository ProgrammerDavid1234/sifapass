import mongoose from "mongoose";
import Credential from "../models/Credentials.js"; // Import the actual Credential model
// Import other models as needed
import Event from "../models/Event.js";
import Participant from "../models/Participant.js";

// Get dashboard analytics summary
export const getDashboardAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Total credentials issued in the period
    const totalCredentials = await Credential.countDocuments({
      issuedAt: { $gte: startDate },
      status: { $ne: 'draft' } // Exclude drafts
    });

    // Previous period comparison
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - parseInt(period));
    
    const previousCredentials = await Credential.countDocuments({
      issuedAt: { $gte: previousPeriodStart, $lt: startDate },
      status: { $ne: 'draft' }
    });

    // Calculate percentage change
    const credentialGrowth = previousCredentials > 0 
      ? ((totalCredentials - previousCredentials) / previousCredentials * 100).toFixed(1)
      : totalCredentials > 0 ? 100 : 0;

    // Total verification views (using viewCount from credentials)
    const verificationViews = await Credential.aggregate([
      {
        $match: {
          issuedAt: { $gte: startDate },
          status: { $ne: 'draft' }
        }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$viewCount" }
        }
      }
    ]);

    const totalViews = verificationViews.length > 0 ? verificationViews[0].totalViews : 0;

    // Engagement rate calculation (credentials with views vs total)
    const credentialsWithViews = await Credential.countDocuments({
      issuedAt: { $gte: startDate },
      status: { $ne: 'draft' },
      viewCount: { $gt: 0 }
    });

    const engagementRate = totalCredentials > 0 
      ? ((credentialsWithViews / totalCredentials) * 100).toFixed(1)
      : 0;

    // Active recipients (unique participants who received credentials)
    const activeRecipients = await Credential.distinct("participantId", {
      issuedAt: { $gte: startDate },
      status: { $ne: 'draft' }
    });

    res.json({
      success: true,
      data: {
        totalCredentials,
        credentialGrowth: `${credentialGrowth >= 0 ? '+' : ''}${credentialGrowth}`,
        engagementRate: `${engagementRate}%`,
        activeRecipients: activeRecipients.length,
        verificationViews: totalViews,
        period: parseInt(period)
      }
    });

  } catch (error) {
    console.error('Dashboard Analytics Error:', error);
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

    const topEvents = await Credential.aggregate([
      {
        $match: {
          status: { $ne: 'draft' }
        }
      },
      {
        $lookup: {
          from: "events", // Assuming your events collection name is "events"
          localField: "eventId",
          foreignField: "_id",
          as: "eventDetails"
        }
      },
      {
        $unwind: {
          path: "$eventDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: "$eventId",
          eventName: { 
            $first: { 
              $ifNull: ["$eventDetails.title", "$participantData.eventTitle", "Unknown Event"] 
            }
          },
          credentialsIssued: { $sum: 1 },
          totalViews: { $sum: "$viewCount" },
          totalDownloads: { $sum: "$downloadCount" },
          participantCount: { $addToSet: "$participantId" }
        }
      },
      {
        $addFields: {
          uniqueParticipants: { $size: "$participantCount" },
          engagementScore: {
            $cond: [
              { $eq: ["$credentialsIssued", 0] },
              0,
              {
                $add: [
                  { $multiply: [{ $divide: ["$totalViews", "$credentialsIssued"] }, 50] },
                  { $multiply: [{ $divide: ["$totalDownloads", "$credentialsIssued"] }, 30] },
                  { $multiply: ["$uniqueParticipants", 20] }
                ]
              }
            ]
          }
        }
      },
      {
        $project: {
          eventName: 1,
          credentialsIssued: 1,
          totalViews: 1,
          totalDownloads: 1,
          uniqueParticipants: 1,
          engagementScore: { $round: ["$engagementScore", 2] }
        }
      },
      { $sort: { engagementScore: -1, credentialsIssued: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: topEvents
    });

  } catch (error) {
    console.error('Top Events Error:', error);
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

    const recentActivity = await Credential.find({
      status: { $ne: 'draft' }
    })
    .populate('participantId', 'name email')
    .populate('eventId', 'title')
    .populate('issuedBy', 'name')
    .sort({ issuedAt: -1 })
    .limit(parseInt(limit))
    .select('title type issuedAt participantId eventId issuedBy status viewCount downloadCount');

    // Format the activity data
    const formattedActivity = recentActivity.map(credential => ({
      action: `Credential ${credential.status}`,
      actor: credential.participantId?.name || 'Unknown Participant',
      timestamp: credential.issuedAt,
      details: {
        credentialTitle: credential.title,
        credentialType: credential.type,
        eventTitle: credential.eventId?.title || credential.participantData?.eventTitle,
        issuedBy: credential.issuedBy?.name || 'System',
        views: credential.viewCount,
        downloads: credential.downloadCount
      }
    }));

    res.json({
      success: true,
      data: formattedActivity
    });

  } catch (error) {
    console.error('Recent Activity Error:', error);
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

    const trendData = await Credential.aggregate([
      {
        $match: {
          issuedAt: { $gte: startDate },
          status: { $ne: 'draft' }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$issuedAt" },
            month: { $month: "$issuedAt" },
            day: { $dayOfMonth: "$issuedAt" }
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
    console.error('Issuance Trend Error:', error);
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

    // Hourly pattern based on when credentials were last viewed
    const hourlyPattern = await Credential.aggregate([
      {
        $match: {
          lastViewed: { $gte: startDate },
          status: { $ne: 'draft' }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: "$lastViewed" }
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

    // Verification attempts analysis
    const verificationMethods = await Credential.aggregate([
      {
        $match: {
          "verificationAttempts.0": { $exists: true },
          issuedAt: { $gte: startDate }
        }
      },
      {
        $unwind: "$verificationAttempts"
      },
      {
        $match: {
          "verificationAttempts.timestamp": { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$verificationAttempts.result",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        hourlyPattern,
        methods: verificationMethods
      }
    });

  } catch (error) {
    console.error('Verification Analytics Error:', error);
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
    const credentialTypes = await Credential.aggregate([
      {
        $match: {
          issuedAt: { $gte: startDate },
          status: { $ne: 'draft' }
        }
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ]);

    // Status breakdown
    const statusBreakdown = await Credential.aggregate([
      {
        $match: {
          issuedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Verification status
    const verificationStatus = await Credential.aggregate([
      {
        $match: {
          issuedAt: { $gte: startDate },
          status: { $ne: 'draft' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          verified: {
            $sum: { $cond: [{ $gt: ["$viewCount", 0] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          verified: "$verified",
          unverified: { $subtract: ["$total", "$verified"] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        credentialTypes,
        statusBreakdown,
        verificationStatus: verificationStatus[0] || { verified: 0, unverified: 0 }
      }
    });

  } catch (error) {
    console.error('Detailed Metrics Error:', error);
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
    console.error('Export Report Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to export analytics report",
      error: error.message
    });
  }
};

// Helper functions
async function getDashboardAnalyticsSummary(startDate) {
  const totalCredentials = await Credential.countDocuments({
    issuedAt: { $gte: startDate },
    status: { $ne: 'draft' }
  });

  const verificationViews = await Credential.aggregate([
    {
      $match: {
        issuedAt: { $gte: startDate },
        status: { $ne: 'draft' }
      }
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$viewCount" }
      }
    }
  ]);

  const totalViews = verificationViews.length > 0 ? verificationViews[0].totalViews : 0;

  return {
    totalCredentials,
    verificationViews: totalViews,
    engagementRate: totalCredentials > 0 ? (totalViews / totalCredentials * 100).toFixed(1) : 0
  };
}

async function getCredentialTrendData(startDate) {
  return await Credential.aggregate([
    {
      $match: {
        issuedAt: { $gte: startDate },
        status: { $ne: 'draft' }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$issuedAt" },
          month: { $month: "$issuedAt" },
          day: { $dayOfMonth: "$issuedAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);
}

async function getEventAnalytics(startDate) {
  return await Credential.aggregate([
    {
      $match: {
        issuedAt: { $gte: startDate },
        status: { $ne: 'draft' }
      }
    },
    {
      $group: {
        _id: "$eventId",
        eventName: { $first: "$participantData.eventTitle" },
        count: { $sum: 1 }
      }
    }
  ]);
}

async function getVerificationData(startDate) {
  return await Credential.aggregate([
    {
      $match: {
        "verificationAttempts.0": { $exists: true },
        issuedAt: { $gte: startDate }
      }
    },
    {
      $unwind: "$verificationAttempts"
    },
    {
      $group: {
        _id: "$verificationAttempts.result",
        count: { $sum: 1 }
      }
    }
  ]);
}

function convertToCSV(data) {
  // Enhanced CSV conversion
  let csv = "Type,Value,Count,Date\n";
  
  // Add summary data
  if (data.summary) {
    csv += `Total Credentials,${data.summary.totalCredentials},1,${new Date().toISOString()}\n`;
    csv += `Verification Views,${data.summary.verificationViews},1,${new Date().toISOString()}\n`;
    csv += `Engagement Rate,${data.summary.engagementRate}%,1,${new Date().toISOString()}\n`;
  }

  // Add trend data
  if (data.trends && data.trends.length > 0) {
    data.trends.forEach(trend => {
      csv += `Daily Trend,${trend._id.day}/${trend._id.month}/${trend._id.year},${trend.count},${new Date().toISOString()}\n`;
    });
  }

  return csv;
}