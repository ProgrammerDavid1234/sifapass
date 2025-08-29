import mongoose from "mongoose";

const credentialSchema = new mongoose.Schema({
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Participant",
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  type: {
    type: String,
    enum: ["certificate", "badge"],
    default: "certificate",
    required: true,
  },
  template: {
    type: String,
    default: "default",
  },
  data: {
    type: Map,
    of: String,
  },
  blockchainHash: String,
  qrCode: String,
  sharedWith: [String],
},
  { timestamps: true }
);
export default mongoose.model("Credential", credentialSchema);