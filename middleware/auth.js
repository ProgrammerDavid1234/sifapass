import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import Participant from "../models/Participant.js";

/* ===============================
   1. ADMIN OR PARTICIPANT
================================= */
export const authenticateAdminOrParticipant = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try Admin first
    let admin = await Admin.findById(decoded.id).select("-password");
    if (admin) {
      if (!admin.isVerified) return res.status(401).json({ msg: "Email not verified" });
      if (!admin.isActive || admin.accountSuspended)
        return res.status(401).json({ msg: "Account is suspended or inactive" });

      req.user = { id: admin._id, role: "admin", email: admin.email };
      req.admin = admin;
      return next();
    }

    // Otherwise check Participant
    let participant = await Participant.findById(decoded.id).select("-password");
    if (participant) {
      req.user = { id: participant._id, role: "participant", email: participant.email };
      req.participant = participant;
      return next();
    }

    return res.status(401).json({ msg: "User not found or unauthorized" });
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};

/* ===============================
   2. ADMIN ONLY
================================= */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin) return res.status(401).json({ msg: "Admin not found" });

    if (!admin.isVerified) return res.status(401).json({ msg: "Email not verified" });
    if (!admin.isActive || admin.accountSuspended)
      return res.status(401).json({ msg: "Account is suspended or inactive" });

    req.user = { id: admin._id, role: "admin", email: admin.email };
    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin auth error:", error.message);
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};

/* ===============================
   3. PARTICIPANT ONLY
================================= */
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const participant = await Participant.findById(decoded.id).select("-password");
    if (!participant) return res.status(401).json({ msg: "Participant not found" });

    req.user = { id: participant._id, role: "participant", email: participant.email };
    req.participant = participant;
    next();
  } catch (error) {
    console.error("Participant auth error:", error.message);
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};
