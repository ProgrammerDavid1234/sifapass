import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., "User created", "Login attempt"
  actor: { type: String, required: true },  // user/admin performing the action
  timestamp: { type: Date, default: Date.now },
  details: { type: Object }, // optional metadata
});


export default mongoose.model("ActivityLog", activityLogSchema);