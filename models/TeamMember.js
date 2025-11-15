import mongoose from "mongoose";

// ------------------- Team Member Schema -------------------
const teamMemberSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true,
    unique: true
  },
  role: { 
    type: String, 
    enum: ["admin", "editor", "viewer"], 
    default: "viewer" 
  },
  status: { 
    type: String, 
    enum: ["active", "inactive"], 
    default: "active" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// ------------------- Export Model Only -------------------
const TeamMember = mongoose.models.TeamMember ||
  mongoose.model("TeamMember", teamMemberSchema);

export default TeamMember;
