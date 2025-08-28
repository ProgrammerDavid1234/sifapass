import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// REGISTER ADMIN
export const registerAdmin = async (req, res) => {
  try {
    const { fullName, organization, email, password } = req.body;

    const adminExists = await Admin.findOne({ email });
    if (adminExists) return res.status(400).json({ msg: "Admin already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new Admin({
      fullName,
      organization,
      email,
      password: hashedPassword,
    });

    await admin.save();
    res.status(201).json({ msg: "Admin account created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN ADMIN
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({
      token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        organization: admin.organization,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET METRICS
export const getMetrics = async (req, res) => {
  try {
    const metrics = await SomeMetricsModel.find(); // replace with real logic
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DOWNLOAD REPORT
export const downloadReport = async (req, res) => {
  const format = req.query.format || "csv";
  try {
    const data = await generateReport(); // replace with real report logic
    if (format === "csv") {
      res.setHeader("Content-Disposition", "attachment; filename=report.csv");
      res.setHeader("Content-Type", "text/csv");
      res.send(convertToCSV(data)); // implement convertToCSV function
    } else {
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
