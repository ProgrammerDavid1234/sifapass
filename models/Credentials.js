import mongoose from "mongoose";

const credentialSchema = new mongoose.Schema(
  {
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
    template: {
      type: String, // e.g., default template or customized HTML/JSON template
      default: "default",
    },
    data: {
      type: Map,
      of: String, // key-value pairs for credential details
    },
    blockchainHash: {
      type: String, // For verification via blockchain
    },
    qrCode: {
      type: String, // Base64 or URL to QR code
    },
    sharedWith: [
      {
        type: String, // emails/user IDs with whom this credential is shared
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Credential", credentialSchema);
