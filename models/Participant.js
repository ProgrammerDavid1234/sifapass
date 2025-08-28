import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetToken: { type: String },           // for password reset
    resetTokenExpiry: { type: Date },
    registeredEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    phone: { type: String },
    events: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }], // linked events
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    reconciled: { type: Boolean, default: false },
    preferences: Object,
    settings: {
        theme: { type: String, default: "light" },
        notifications: { type: Boolean, default: true },
    },
    credentials: [{ type: mongoose.Schema.Types.ObjectId, ref: "Credential" }],
}, { timestamps: true });

export default mongoose.model("Participant", participantSchema);
