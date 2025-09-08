import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  phone: { type: String },
  bio: { type: String },
  profilePicture: { type: String }, // Base64 string or URL

  // Account status & reconciliation
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  reconciled: { type: Boolean, default: false },

  // Events & credentials
  events: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
  registeredEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }], // optional if needed separately
  credentials: [{ type: mongoose.Schema.Types.ObjectId, ref: "Credential" }],

  // Settings object (frontend compatibility + UI preferences)
  settings: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    eventReminders: { type: Boolean, default: true },
    credentialUpdates: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    theme: { type: String, default: "light" },
    notifications: { type: Boolean, default: true },
  },

  preferences: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Password reset
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
}, {
  timestamps: true
});

export default mongoose.model("Participant", participantSchema);
