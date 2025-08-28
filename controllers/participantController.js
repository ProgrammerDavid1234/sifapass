import Participant from "../models/Participant.js";
import { Parser } from "json2csv";

export const exportParticipants = async (req, res) => {
  try {
    const participants = await Participant.find().lean();
    const fields = ["_id", "fullName", "email", "createdAt"];
    const parser = new Parser({ fields });
    const csv = parser.parse(participants);

    res.header("Content-Type", "text/csv");
    res.attachment("participants.csv");
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "Failed to export participants" });
  }
};

export default { exportParticipants };