import Plan from "../models/Plan.js";

// Create Plan
export const createPlan = async (req, res) => {
  try {
    const plan = new Plan(req.body);
    await plan.save();
    res.status(201).json({ message: "Plan created", plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Plans
export const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Plan
export const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan updated", plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Plan
export const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
