import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  fullName: { type: String, required: true },  
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetToken: { type: String },           // for password reset
  resetTokenExpiry: { type: Date },
  registeredEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
}, { timestamps: true });

export default mongoose.model("Participant", participantSchema);
