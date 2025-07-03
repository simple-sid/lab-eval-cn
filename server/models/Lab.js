import mongoose from "mongoose";

const baseLabSchema = new mongoose.Schema(
  {
    lab_name: { type: String, required: true, unique: true },
    course_id: { type: mongoose.Types.ObjectId, ref: "Course", required: true },
    semester: { type: Number },
    teachers: [{ type: mongoose.Types.ObjectId, ref: "User", required: true }],
    students: [{ type: mongoose.Types.ObjectId, ref: "User" }],
    modules: [{ type: mongoose.Types.ObjectId, ref: "Module" }],
    labType: { type: String, required: true },
  },
  { timestamps: true, discriminatorKey: "labType" }
);

const Lab = mongoose.model("Lab", baseLabSchema);

const CNLabSchema = new mongoose.Schema(
  {
    serverTimeout: { type: Number, default: 30 },
    clientTimeout: { type: Number, default: 15 },
    
    // Environment settings
    allowedPorts: { 
      type: [Number], 
      default: [8080, 9090] // Default ports students are allowed to use
    },
    
    enableServerEvaluation: { type: Boolean, default: true },
    enableClientEvaluation: { type: Boolean, default: true },
    enablePeerTesting: { type: Boolean, default: false }, // Allow students to test against each other
    
    // Protocol settings
    supportedProtocols: { 
      type: [String], 
      default: ['tcp', 'udp'] 
    },

    // Security settings
    allowSystemCommands: { type: Boolean, default: false },
  },
  { _id: false }
);

const CNLab = Lab.discriminator("CNLab", CNLabSchema);

export { Lab, CNLab };