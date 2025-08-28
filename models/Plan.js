import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  maxUsers: { type: Number, required: true },
  durationInMonths: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Plan", planSchema);
