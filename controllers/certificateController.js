import Certificate from "../models/Certificate.js";

// Create a certificate (admin only)
export const createCertificate = async (req, res) => {
  try {
    const { participantId, eventId, title, downloadLink } = req.body;

    const certificate = new Certificate({
      participantId,
      eventId,
      title,
      downloadLink,
    });

    await certificate.save();
    res.status(201).json({ message: "Certificate created successfully", certificate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create certificate" });
  }
};

// Get all certificates (admin only)
export const getCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate("participantId", "fullName email")
      .populate("eventId", "title date");

    res.status(200).json(certificates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch certificates" });
  }
};

// Get certificates for the logged-in participant
export const getParticipantCertificates = async (req, res) => {
  try {
    const participantId = req.user.id; // assuming `authenticate` adds user info to req

    const certificates = await Certificate.find({ participantId })
      .populate("eventId", "title date")
      .sort({ issuedAt: -1 });

    res.status(200).json(certificates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch your certificates" });
  }
};
