import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  description: { type: String },
  points: { type: Number, default: 0 },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String }, // image URL or path
  precode: { type: mongoose.Schema.Types.Mixed }, // Object with starter code files
  clientPrecode: { type: mongoose.Schema.Types.Mixed },
  solution: { type: mongoose.Schema.Types.Mixed },
  clientSolution: { type: mongoose.Schema.Types.Mixed },
  testCases: { type: [testCaseSchema], default: [] },
  evaluationScript: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Question', questionSchema);
