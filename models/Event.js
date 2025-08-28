import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  maxParticipants: { type: Number, default: 100 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Participant" }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Event", eventSchema);
