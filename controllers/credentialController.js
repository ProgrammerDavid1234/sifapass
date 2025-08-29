// controllers/credentialController.js
import Credential from "../models/Credentials.js";
import QRCode from "qrcode";
import crypto from "crypto";

/**
 * Create or Import Credential
 */
export const createCredential = async (req, res) => {
  try {
    // req.body will contain all text fields as strings
    const { participantId, eventId, title, type } = req.body;

    if (!participantId || !eventId || !title || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["certificate", "badge"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'certificate' or 'badge'" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "File upload is required" });
    }

    const downloadLink = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    const blockchainHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ participantId, eventId, title, type }) + Date.now())
      .digest("hex");

    const qrCode = await QRCode.toDataURL(blockchainHash);

    const credential = await Credential.create({
      participantId,
      eventId,
      title,
      type,
      downloadLink,
      blockchainHash,
      qrCode,
    });

    res.status(201).json({ message: `${type} created successfully`, credential });
  } catch (error) {
    res.status(500).json({ message: "Failed to create credential", error: error.message });
  }
};



/**
 * Get All Credentials (for user)
 */
export const getCredentials = async (req, res) => {
    try {
        const credentials = await Credential.find({ userId: req.user.id });
        res.json({ success: true, credentials });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Edit Credential
 */
export const updateCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const credential = await Credential.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true }
        );

        if (!credential) return res.status(404).json({ success: false, message: "Credential not found" });

        res.json({ success: true, credential });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Share Credential with other users
 */
export const shareCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body; // array of users to share with

        const credential = await Credential.findByIdAndUpdate(
            id,
            { $addToSet: { sharedWith: { $each: userIds } } },
            { new: true }
        );

        if (!credential) return res.status(404).json({ success: false, message: "Credential not found" });

        res.json({ success: true, credential });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Verify Credential (Blockchain + QR)
 */
export const verifyCredential = async (req, res) => {
    try {
        const { hash } = req.query;

        const credential = await Credential.findOne({ blockchainHash: hash });
        if (!credential) {
            return res.status(404).json({ success: false, message: "Invalid or tampered credential" });
        }

        res.json({ success: true, message: "Credential verified successfully", credential });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const customizeCredential = async (req, res) => {
    try {
        const credential = await Credential.findById(req.params.id);
        if (!credential) return res.status(404).json({ message: "Not found" });

        credential.customData = req.body.customData || credential.customData;
        await credential.save();

        res.status(200).json({ message: "Credential customized", credential });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};
export const editCredential = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, password, description } = req.body;

        const updatedCredential = await Credential.findByIdAndUpdate(
            id,
            { name, username, password, description },
            { new: true } // return updated document
        );

        if (!updatedCredential) {
            return res.status(404).json({ message: 'Credential not found' });
        }

        res.status(200).json({ message: 'Credential updated successfully', data: updatedCredential });
    } catch (error) {
        res.status(500).json({ message: 'Error updating credential', error: error.message });
    }
};
export const getDefaultTemplate = async (req, res) => {
    try {
        // Define your default credential template structure
        const defaultTemplate = {
            title: "New Credential",
            description: "Enter your credential details here...",
            fields: [
                { label: "Full Name", type: "text", required: true },
                { label: "Email", type: "email", required: true },
                { label: "Phone Number", type: "text", required: false },
                { label: "Address", type: "text", required: false }
            ],
            createdAt: new Date(),
        };

        return res.status(200).json({
            success: true,
            message: "Default template fetched successfully",
            data: defaultTemplate,
        });
    } catch (error) {
        console.error("Error fetching default template:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch default template",
            error: error.message,
        });
    }
};

// -------------------- IMPORT CREDENTIAL --------------------
export const importCredential = async (req, res) => {
    try {
        const { user_id, credentials } = req.body;

        if (!user_id || !Array.isArray(credentials)) {
            return res.status(400).json({ error: "Invalid input format" });
        }

        const values = credentials.map(c => [user_id, c.service_name, c.username, c.password]);

        if (values.length === 0) {
            return res.status(400).json({ error: "No credentials to import" });
        }

        await pool.query(
            "INSERT INTO credentials (user_id, service_name, username, password) VALUES ?",
            [values]
        );

        res.status(201).json({ message: "Credentials imported successfully", count: values.length });
    } catch (error) {
        console.error("Error importing credentials:", error);
        res.status(500).json({ error: "Server error" });
    }
};
// Reconcile certificates
export const reconcileCertificates = async (req, res) => {
    try {
        const { participantId, credentialId } = req.body;

        // check if credential belongs to participant
        const cred = await Credential.findById(credentialId);
        if (!cred) return res.status(404).json({ message: "Credential not found" });

        if (String(cred.participant) !== participantId) {
            cred.participant = participantId;
            await cred.save();
        }

        res.json({ message: "Certificate reconciled", credential: cred });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export default {
    createCredential,
    getCredentials,
    updateCredential,
    shareCredential,
    verifyCredential,
    customizeCredential,
    editCredential
};