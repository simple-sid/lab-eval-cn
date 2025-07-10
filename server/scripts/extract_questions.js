import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define schema for Question model based on existing model
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
    course: { type: mongoose.Types.ObjectId, ref: "Course" },
    lab: { type: String },
    tags: [{ type: String }],
    maxMarks: { type: Number, default: 15 },
    moduleType: { type: String, required: true },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" },
    creatorId: { type: String },
    details: { type: Object, default: {} }
  },
  { timestamps: true, discriminatorKey: "moduleType" }
);

const CNQuestionSchema = new mongoose.Schema(
  {
    precode: { type: mongoose.Schema.Types.Mixed },
    clientPrecode: { type: mongoose.Schema.Types.Mixed },
    solution: { type: mongoose.Schema.Types.Mixed },
    clientSolution: { type: mongoose.Schema.Types.Mixed },
    clientCount: { type: Number, default: 1 },
    clientDelay: { type: Number, default: 0.5 },
    testCases: {
      server: [testCaseSchema],
      client: [testCaseSchema]
    },
    evaluationScript: { type: String },
    image: { type: String } // Added image field as it's mentioned in the requirements
  },
  { _id: false }
);

async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is not defined. Please check your .env file.');
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    // Define models
    const Question = mongoose.model('Question', baseQuestionSchema);
    Question.discriminator('CNQuestion', CNQuestionSchema);
    
    // Retrieve all questions from the database
    console.log('Retrieving questions...');
    const questions = await Question.find({});
    console.log(`Retrieved ${questions.length} questions`);
    
    // Format questions for sample_bulk_questions.json
    const formattedQuestions = questions.map(q => {
      const question = q.toObject();
      
      // Create a simplified version with only the needed fields for sample_bulk_questions.json
      return {
        title: question.title,
        description: question.description,
        maxMarks: question.maxMarks || 15,
        precode: question.precode || {},
        solution: question.solution || {},
        clientPrecode: question.clientPrecode || {},
        clientSolution: question.clientSolution || {},
        clientCount: question.clientCount || 1,
        clientDelay: question.clientDelay || 0.5,
        testCases: question.testCases || { server: [], client: [] },
        evaluationScript: question.evaluationScript || '',
        image: question.image || null
      };
    });
    
    // Create output file path
    const outputPath = path.resolve(__dirname, '../../client/public/sample_bulk_questions.json');
    
    // Write to file
    console.log(`Writing questions to ${outputPath}...`);
    await fs.writeFile(outputPath, JSON.stringify(formattedQuestions, null, 2));
    console.log(`Successfully wrote ${formattedQuestions.length} questions to ${outputPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
