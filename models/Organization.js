import mongoose from "mongoose";

// ... your schema definition here ...
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  location: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // stored as plain text now
  maxUsers: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  subscriptionPlan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
  roles: { type: [String], default: ["admin", "event_manager", "viewer"] },
  teamMembers: [
    {
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      role: { type: String, enum: ["admin", "editor", "viewer"], default: "viewer" },
      status: { type: String, enum: ["active", "inactive"], default: "active" },
      createdAt: { type: Date, default: Date.now },
    }
  ],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ✅ Removed bcrypt hashing logic

// Avoid overwrite error
const Organization =
  mongoose.models.Organization || mongoose.model("Organization", organizationSchema);

export default Organization;