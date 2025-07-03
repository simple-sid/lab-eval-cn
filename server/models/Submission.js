import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  questionId: { type: String, required: true },
  sessionId: { type: String, required: true },
  module: { type: String, required: true },
  sourceCode: { type: Object,
                required: true,
              },
  language: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
  passedCount: { type: Number, required: true },
  totalTestCases: { type: Number, required: true }
}, {collection: 'submissions', timestamps: true });

export default mongoose.model('Submission', submissionSchema);