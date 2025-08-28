const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  maxUsers: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  subscriptionPlan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
  createdAt: { type: Date, default: Date.now },
});
