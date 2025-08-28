import Participant from "../models/Participant.js";
import Event from "../models/Event.js";
import Credential from "../models/Credentials.js";
import Plan from "../models/Plan.js";

export const getMetrics = async (req, res) => {
  try {
    const participants = await Participant.countDocuments();
    const events = await Event.countDocuments();
    const credentials = await Credential.countDocuments();
    const plans = await Plan.countDocuments();

    res.json({ participants, events, credentials, plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
