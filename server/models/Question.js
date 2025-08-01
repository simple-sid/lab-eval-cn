import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema({
  input: { type: String },
  expectedOutput: { type: String, required: true },
  description: { type: String },
  points: { type: Number, default: 0 },
  matchType: { type: String, default: 'contains' },
  clientCount: { type: Number }
}, { _id: false });

const baseQuestionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    course: { type: mongoose.Types.ObjectId, ref: "Course" }, // Aligned with their Question model
    lab: { type: String }, // Keep for backward compatibility
    tags: [{ type: String }], // Aligned with their Question model
    maxMarks: { type: Number, default: 15 },
    moduleType: { type: String, required: true },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" }, // Aligned with their Question model
    creatorId: { type: String }, // For backward compatibility
    details: { type: Object, default: {} } // For compatibility with their dynamic fields
  },
  { timestamps: true, discriminatorKey: "moduleType" }
);

const Question = mongoose.model("Question", baseQuestionSchema);

const CNQuestionSchema = new mongoose.Schema(
  {
    // image: { type: String }, // image URL or path
    precode: { type: mongoose.Schema.Types.Mixed }, // Object with starter code files
    clientPrecode: { type: mongoose.Schema.Types.Mixed },
    solution: { type: mongoose.Schema.Types.Mixed },
    clientSolution: { type: mongoose.Schema.Types.Mixed },
    clientCount: { type: Number, default: 1 },
    clientDelay: { type: Number, default: 0.5 },
    testCases: {
      server: [testCaseSchema],
      client: [testCaseSchema]
    },
    evaluationScript: { type: String }
  },
  { _id: false }
);

const CNQuestion = Question.discriminator("CNQuestion", CNQuestionSchema);

export { Question, CNQuestion };