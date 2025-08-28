import ActivityLog from "../models/ActivityLog.js";

// Get all logs
export const getLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a log
export const addLog = async (req, res) => {
  try {
    const newLog = new ActivityLog(req.body);
    await newLog.save();
    res.status(201).json(newLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
