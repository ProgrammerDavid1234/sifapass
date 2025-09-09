// Optimized version of your metrics controller
import Participant from "../models/Participant.js";
import Event from "../models/Event.js";
import Credential from "../models/Credentials.js";
import Plan from "../models/Plan.js";
import NodeCache from "node-cache";

// Cache for 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

export const getMetrics = async (req, res) => {
  try {
    const cacheKey = 'dashboard-metrics';
    
    // Check cache first
    let metrics = cache.get(cacheKey);
    if (metrics) {
      return res.json({
        ...metrics,
        cached: true,
        timestamp: Date.now()
      });
    }

    // Use Promise.all for parallel execution
    const [participants, events, credentials, plans] = await Promise.all([
      Participant.countDocuments(),
      Event.countDocuments(),
      Credential.countDocuments(),
      Plan.countDocuments()
    ]);

    metrics = { participants, events, credentials, plans };
    
    // Cache the results
    cache.set(cacheKey, metrics);

    res.json({
      ...metrics,
      cached: false,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('Metrics error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch metrics',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

// Enhanced stats with time-based filtering and caching
export const getDetailedStats = async (req, res) => {
  try {
    const { timeRange = '30days' } = req.query;
    const cacheKey = `detailed-stats-${timeRange}`;
    
    let stats = cache.get(cacheKey);
    if (stats) {
      return res.json({ ...stats, cached: true });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7days':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '30days':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '90days':
        startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      default:
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }

    // Use aggregation pipeline for better performance
    const [credentialStats, eventStats, participantStats] = await Promise.all([
      // Credential statistics
      Credential.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            certificates: {
              $sum: { $cond: [{ $eq: ['$type', 'certificate'] }, 1, 0] }
            },
            badges: {
              $sum: { $cond: [{ $eq: ['$type', 'badge'] }, 1, 0] }
            },
            shared: {
              $sum: { $cond: [{ $gt: ['$shareCount', 0] }, 1, 0] }
            },
            verified: {
              $sum: { $cond: [{ $gt: ['$verificationCount', 0] }, 1, 0] }
            }
          }
        }
      ]),

      // Event statistics
      Event.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]),

      // Participant statistics
      Participant.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withCredentials: {
              $sum: { $cond: [{ $gt: [{ $size: '$credentials' }, 0] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    stats = {
      credentials: credentialStats[0] || { total: 0, certificates: 0, badges: 0, shared: 0, verified: 0 },
      events: eventStats[0] || { total: 0, active: 0, completed: 0 },
      participants: participantStats[0] || { total: 0, withCredentials: 0 },
      timeRange,
      generatedAt: new Date()
    };

    // Cache for 10 minutes
    cache.set(cacheKey, stats, 600);

    res.json({ ...stats, cached: false });
  } catch (err) {
    console.error('Detailed stats error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch detailed statistics',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

// Optimized batch operations with proper error handling
export const optimizedBatchCreate = async (req, res) => {
  try {
    const { eventId, templateId, type = 'certificate', participants } = req.body;

    if (!eventId || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid input data",
        required: ['eventId', 'participants'] 
      });
    }

    const batchSize = 10; // Process 10 at a time
    const results = [];
    const errors = [];
    let processed = 0;

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < participants.length; i += batchSize) {
      const batch = participants.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (participant) => {
        try {
          const credentialData = {
            participantId: participant.participantId,
            eventId,
            title: participant.title || `${type} of Achievement`,
            type,
            templateId,
            participantData: participant.participantData || {}
          };

          // Simulated credential creation - replace with actual logic
          const credential = await createCredentialWithDesign({ body: credentialData });
          return { success: true, credential, participantId: participant.participantId };
        } catch (error) {
          return { 
            success: false, 
            participantId: participant.participantId, 
            error: error.message 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result.credential);
        } else {
          errors.push({
            participantId: result.participantId,
            error: result.error
          });
        }
      });

      processed += batch.length;

      // Optional: Send progress update for long-running operations
      if (participants.length > 50) {
        console.log(`Processed ${processed}/${participants.length} credentials`);
      }
    }

    const successRate = ((results.length / participants.length) * 100).toFixed(2);

    res.status(201).json({
      success: true,
      message: `Batch processing completed. ${results.length} credentials created successfully.`,
      summary: {
        total: participants.length,
        successful: results.length,
        failed: errors.length,
        successRate: `${successRate}%`
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Batch create error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create batch credentials",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};