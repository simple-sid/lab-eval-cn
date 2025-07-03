import mongoose from "mongoose";

// a set of questions assigned together in a lab session
const ModuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    lab: { type: mongoose.Types.ObjectId, ref: "Lab", required: true },
    questions: [{ type: mongoose.Types.ObjectId, ref: "Question", required: true }],
    creator: { type: mongoose.Types.ObjectId, ref: "User", required: true }, // The teacher who created the module
    maxMarks: { type: Number }, // total marks for the module
    moduleType: { type: String, required: true }
  },
  { timestamps: true, discriminatorKey: "moduleType" }
);

const Module = mongoose.model("Module", ModuleSchema);

const CNModuleSchema = new mongoose.Schema({}, { _id: false });
const CNModule = Module.discriminator("CNModule", CNModuleSchema);

export { Module, CNModule };