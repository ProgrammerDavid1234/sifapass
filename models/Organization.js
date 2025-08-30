import mongoose from "mongoose";
import bcrypt from "bcrypt";

// ... your schema definition here ...
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  location: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
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

// hash password before saving
organizationSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ✅ Avoid overwrite error
const Organization = mongoose.models.Organization || mongoose.model("Organization", organizationSchema);

export default Organization;
