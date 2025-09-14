import Participant from "../models/Participant.js";
import Event from "../models/Event.js";
import Credential from "../models/Credentials.js";
import Plan from "../models/Plan.js";
import NodeCache from "node-cache";
import { performance } from "perf_hooks";

// Cache instances with different TTL
const quickCache = new NodeCache({ stdTTL: 300 }); // 5 minutes
const statsCache = new NodeCache({ stdTTL: 600 }); // 10 minutes
const activityCache = new NodeCache({ stdTTL: 180 }); // 3 minutes

// Utility: execution timer
const measureTime = async (fn, label) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  console.log(`${label} took ${(end - start).toFixed(2)}ms`);
  return result;
};

/**
 * --------------------------
 * Basic Metrics (cached)
 * --------------------------
 */
export const getMetrics = async (req, res) => {
  try {
    const cacheKey = "dashboard-metrics";
    let metrics = quickCache.get(cacheKey);

    if (metrics) {
      return res.json({ ...metrics, cached: true, timestamp: Date.now() });
    }

    metrics = await measureTime(async () => {
      const [participants, events, credentials, plans] = await Promise.all([
        Participant.countDocuments(),
        Event.countDocuments(),
        Credential.countDocuments(),
        Plan.countDocuments(),
      ]);
      return { participants, events, credentials, plans };
    }, "Basic metrics query");

    quickCache.set(cacheKey, metrics);
    res.json({ ...metrics, cached: false, timestamp: Date.now() });
  } catch (err) {
    console.error("Metrics error:", err);
    res.status(500).json({
      error: "Failed to fetch metrics",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
};

/**
 * --------------------------
 * Detailed Stats (cached)
 * --------------------------
 */
export const getDetailedStats = async (req, res) => {
  try {
    const { timeRange = "30days", includeBreakdown = false } = req.query;
    const cacheKey = `detailed-stats-${timeRange}-${includeBreakdown}`;
    let stats = statsCache.get(cacheKey);

    if (stats) {
      return res.json({ ...stats, cached: true });
    }

    const now = new Date();
    let startDate;
    switch (timeRange) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    stats = await measureTime(async () => {
      const [credentialStats, eventStats, participantStats] = await Promise.all(
        [
          Credential.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                certificates: {
                  $sum: { $cond: [{ $eq: ["$type", "certificate"] }, 1, 0] },
                },
                badges: {
                  $sum: { $cond: [{ $eq: ["$type", "badge"] }, 1, 0] },
                },
                shared: {
                  $sum: { $cond: [{ $gt: ["$shareCount", 0] }, 1, 0] },
                },
                verified: {
                  $sum: { $cond: [{ $gt: ["$verificationCount", 0] }, 1, 0] },
                },
              },
            },
          ]),

          Event.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: {
                  $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                },
                completed: {
                  $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
                },
              },
            },
          ]),

          Participant.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                withCredentials: {
                  $sum: {
                    $cond: [
                      { $gt: [{ $size: { $ifNull: ["$credentials", []] } }, 0] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ]),
        ]
      );

      const result = {
        credentials:
          credentialStats[0] || {
            total: 0,
            certificates: 0,
            badges: 0,
            shared: 0,
            verified: 0,
          },
        events: eventStats[0] || { total: 0, active: 0, completed: 0 },
        participants: participantStats[0] || { total: 0, withCredentials: 0 },
        timeRange,
        generatedAt: new Date(),
      };

      if (includeBreakdown) {
        const [templateUsage, topEvents] = await Promise.all([
          Credential.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: "$templateId", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ]),
          Event.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
              $lookup: {
                from: "credentials",
                localField: "_id",
                foreignField: "eventId",
                as: "credentials",
              },
            },
            { $addFields: { credentialCount: { $size: "$credentials" } } },
            { $sort: { credentialCount: -1 } },
            { $limit: 5 },
            {
              $project: {
                title: 1,
                credentialCount: 1,
                status: 1,
                createdAt: 1,
              },
            },
          ]),
        ]);

        result.breakdown = { templateUsage, topEvents };
      }

      return result;
    }, `Detailed stats query (${timeRange})`);

    statsCache.set(cacheKey, stats, 600);
    res.json({ ...stats, cached: false });
  } catch (err) {
    console.error("Detailed stats error:", err);
    res.status(500).json({
      error: "Failed to fetch detailed statistics",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
};

/**
 * --------------------------
 * Recent Activity
 * --------------------------
 */
export const getRecentActivity = async (req, res) => {
  try {
    const { limit = 20, offset = 0, types, since } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit), 1), 100);
    const parsedOffset = Math.max(parseInt(offset), 0);

    const cacheKey = `recent-activity-${parsedLimit}-${parsedOffset}-${types || "all"}-${since || "all"}`;
    let cached = activityCache.get(cacheKey);

    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    let matchQuery = {};
    if (since) matchQuery.createdAt = { $gte: new Date(since) };
    if (types) matchQuery.type = { $in: types.split(",") };

    const result = await measureTime(async () => {
      const [credentials, events] = await Promise.all([
        Credential.aggregate([
          { $match: matchQuery },
          {
            $lookup: {
              from: "participants",
              localField: "participantId",
              foreignField: "_id",
              as: "participant",
            },
          },
          {
            $lookup: {
              from: "events",
              localField: "eventId",
              foreignField: "_id",
              as: "event",
            },
          },
          {
            $addFields: {
              type: "credential_created",
              description: {
                $concat: [
                  'Credential "', "$title", '" created for ',
                  { $arrayElemAt: ["$participant.name", 0] },
                ],
              },
              actor: {
                id: { $arrayElemAt: ["$participant._id", 0] },
                name: { $arrayElemAt: ["$participant.name", 0] },
                type: "participant",
              },
              timestamp: "$createdAt",
            },
          },
          { $project: { _id: 1, type: 1, description: 1, actor: 1, timestamp: 1 } },
        ]).limit(parsedLimit / 2),

        Event.aggregate([
          { $match: matchQuery },
          {
            $addFields: {
              type: "event_created",
              description: { $concat: ['Event "', "$title", '" was created'] },
              actor: { id: "$createdBy", name: "System", type: "admin" },
              timestamp: "$createdAt",
            },
          },
          { $project: { _id: 1, type: 1, description: 1, actor: 1, timestamp: 1 } },
        ]).limit(parsedLimit / 2),
      ]);

      const activities = [...credentials, ...events]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(parsedOffset, parsedOffset + parsedLimit);

      const totalCount = await Promise.all([
        Credential.countDocuments(matchQuery),
        Event.countDocuments(matchQuery),
      ]).then(([credCount, eventCount]) => credCount + eventCount);

      return {
        activities,
        pagination: {
          total: totalCount,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: parsedOffset + parsedLimit < totalCount,
        },
      };
    }, "Recent activity query");

    activityCache.set(cacheKey, result, 180);
    res.json({ ...result, cached: false });
  } catch (err) {
    console.error("Recent activity error:", err);
    res.status(500).json({
      error: "Failed to fetch recent activity",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
};

/**
 * --------------------------
 * System Health
 * --------------------------
 */
export const getSystemHealth = async (req, res) => {
  try {
    const cacheKey = "system-health";
    let health = quickCache.get(cacheKey);

    if (health) return res.json({ ...health, cached: true });

    health = await measureTime(async () => {
      const startTime = performance.now();

      // DB check
      let dbStatus = "healthy";
      let dbResponseTime = 0;
      try {
        const dbStart = performance.now();
        await Participant.findOne().limit(1);
        dbResponseTime = performance.now() - dbStart;
        if (dbResponseTime > 1000) dbStatus = "warning";
        if (dbResponseTime > 3000) dbStatus = "critical";
      } catch {
        dbStatus = "critical";
        dbResponseTime = -1;
      }

      // Memory usage
      const memUsage = process.memoryUsage();
      const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      // Cache stats
      const cacheStats = {
        quickCache: quickCache.getStats(),
        statsCache: statsCache.getStats(),
        activityCache: activityCache.getStats(),
      };

      const totalHits =
        cacheStats.quickCache.hits + cacheStats.statsCache.hits + cacheStats.activityCache.hits;
      const totalMisses =
        cacheStats.quickCache.misses + cacheStats.statsCache.misses + cacheStats.activityCache.misses;
      const hitRate =
        totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

      let overallStatus = "healthy";
      if (dbStatus === "warning" || memoryPercentage > 80) overallStatus = "warning";
      if (dbStatus === "critical" || memoryPercentage > 95) overallStatus = "critical";

      return {
        status: overallStatus,
        uptime: process.uptime(),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          percentage: parseFloat(memoryPercentage.toFixed(2)),
        },
        database: { status: dbStatus, responseTime: Math.round(dbResponseTime) },
        cache: { hitRate: parseFloat(hitRate.toFixed(2)) },
        performance: { responseTime: Math.round(performance.now() - startTime) },
        timestamp: new Date(),
      };
    }, "System health check");

    quickCache.set(cacheKey, health, 60);
    res.json({ ...health, cached: false });
  } catch (err) {
    console.error("System health error:", err);
    res.status(500).json({
      status: "critical",
      error: "Failed to check system health",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
      timestamp: new Date(),
    });
  }
};

/**
 * --------------------------
 * Analytics (time series + trends)
 * --------------------------
 */
export const getAnalytics = async (req, res) => {
  try {
    const { timeRange = "30days", groupBy = "day", metrics = "credentials,verifications,shares,events" } = req.query;
    const cacheKey = `analytics-${timeRange}-${groupBy}-${metrics}`;

    let analytics = statsCache.get(cacheKey);
    if (analytics) return res.json({ ...analytics, cached: true });

    const now = new Date();
    let startDate, dateFormat, groupFormat;

    switch (timeRange) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFormat = "%Y-%m-%d";
        break;
      case "30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFormat = groupBy === "week" ? "%Y-W%U" : "%Y-%m-%d";
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        dateFormat = groupBy === "month" ? "%Y-%m" : "%Y-W%U";
        break;
      case "1year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        dateFormat = "%Y-%m";
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFormat = "%Y-%m-%d";
    }
    groupFormat = { $dateToString: { format: dateFormat, date: "$createdAt" } };

    const requestedMetrics = metrics.split(",");
    analytics = await measureTime(async () => {
      const promises = [];

      if (requestedMetrics.includes("credentials")) {
        promises.push(
          Credential.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: groupFormat, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ])
        );
      }
      if (requestedMetrics.includes("verifications")) {
        promises.push(
          Credential.aggregate([
            { $match: { createdAt: { $gte: startDate }, verificationCount: { $gt: 0 } } },
            { $group: { _id: groupFormat, verifications: { $sum: "$verificationCount" } } },
            { $sort: { _id: 1 } },
          ])
        );
      }
      if (requestedMetrics.includes("shares")) {
        promises.push(
          Credential.aggregate([
            { $match: { createdAt: { $gte: startDate }, shareCount: { $gt: 0 } } },
            { $group: { _id: groupFormat, shares: { $sum: "$shareCount" } } },
            { $sort: { _id: 1 } },
          ])
        );
      }
      if (requestedMetrics.includes("events")) {
        promises.push(
          Event.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: groupFormat, events: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ])
        );
      }

      const results = await Promise.all(promises);
      const timeSeriesMap = new Map();

      results.forEach((result, i) => {
        const metricName = requestedMetrics[i];
        result.forEach((item) => {
          const date = item._id;
          if (!timeSeriesMap.has(date)) timeSeriesMap.set(date, { date });
          const entry = timeSeriesMap.get(date);
          entry[metricName] = item.count || item[metricName] || 0;
        });
      });

      const timeSeries = Array.from(timeSeriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      return { timeSeries, metrics: requestedMetrics, timeRange, groupBy, generatedAt: new Date() };
    }, `Analytics query (${timeRange}, ${groupBy})`);

    statsCache.set(cacheKey, analytics, 900);
    res.json({ ...analytics, cached: false });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({
      error: "Failed to fetch analytics",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    });
  }
};
