import TeamMember from "../models/TeamMember.js"

// Get all team members
export const getMembers = async (req, res) => {
  try {
    const members = await TeamMember.find();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add new member
export const addMember = async (req, res) => {
  try {
    const member = new TeamMember(req.body);
    await member.save();
    res.status(201).json(member);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Edit member
export const updateMember = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(member);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete member
export const deleteMember = async (req, res) => {
  try {
    await TeamMember.findByIdAndDelete(req.params.id);
    res.json({ message: "Member deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
