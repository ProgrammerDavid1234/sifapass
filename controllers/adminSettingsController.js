import AdminSettings from "../models/AdminSettings.js"

// Get admin settings
export const getSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.findOne({ adminId: req.params.adminId });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update settings
export const updateSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.findOneAndUpdate(
      { adminId: req.params.adminId },
      req.body,
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
