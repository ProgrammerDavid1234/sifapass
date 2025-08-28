import mongoose from "mongoose";

const adminSettingsSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "TeamMember", required: true },
  uiPreferences: {
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    language: { type: String, default: "en" },
  },
  profile: {
    name: String,
    email: String,
    phone: String,
  },
  security: {
    twoFactorAuth: { type: Boolean, default: false },
    lastPasswordChange: { type: Date },
  },
}, { timestamps: true });



export default mongoose.model("AdminSettings", adminSettingsSchema);