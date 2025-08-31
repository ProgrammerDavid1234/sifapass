import Organization from "../models/Organization.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// REGISTER ORGANIZATION
export const registerOrganization = async (req, res) => {
    try {
        const { fullName, organization, email, password, location } = req.body;

        // check if org already exists (by email or org name)
        const orgExists = await Organization.findOne({ email });
        if (orgExists) {
            return res.status(400).json({ error: "Organization already exists" });
        }

        // hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // create org
        const org = new Organization({
            fullName,
            organization,
            email,
            password: hashedPassword,
            location
        });

        await org.save();

        // generate JWT
        const token = jwt.sign({ id: org._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.status(201).json({
            message: "Organization registered successfully",
            token,
            org: {
                id: org._id,
                fullName: org.fullName,
                organization: org.organization,
                email: org.email,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// LOGIN ORGANIZATION
export const loginOrganization = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1️⃣ find the organization that contains this member
        const org = await Organization.findOne({ "teamMembers.email": email });
        if (!org) return res.status(400).json({ error: "Invalid credentials" });

        // 2️⃣ find the member
        const member = org.teamMembers.find(m => m.email === email);

        // 3️⃣ compare passwords
        const isMatch = await bcrypt.compare(password, member.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        // 4️⃣ generate JWT
        const token = jwt.sign(
            { email: member.email, role: member.role, orgId: org._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                email: member.email,
                fullName: member.fullName,
                role: member.role,
                mustChangePassword: member.mustChangePassword
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};


// METRICS
export const getMetrics = async (req, res) => {
    try {
        // placeholder: replace with real logic
        res.json({ users: 100, events: 25 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// REPORT DOWNLOAD
export const downloadReport = async (req, res) => {
    try {
        const format = req.query.format || "json";
        const data = [{ event: "Sample Event", attendees: 50 }]; // dummy data

        if (format === "csv") {
            res.setHeader("Content-Disposition", "attachment; filename=report.csv");
            res.setHeader("Content-Type", "text/csv");
            res.send("event,attendees\nSample Event,50");
        } else {
            res.json(data);
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
