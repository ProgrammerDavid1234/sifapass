import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  dueDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Invoice", invoiceSchema);
