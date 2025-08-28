import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema({
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: "Participant", required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  title: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  downloadLink: { type: String }, // Optional: if you generate a PDF link
});

const Certificate = mongoose.model("Certificate", certificateSchema);
export default Certificate;
