import Submission from '../models/Submission.js';
import { parse } from 'csv-parse/sync';

export async function processEvaluationResults(resultFiles) {
  // in the API endpoint that handles submission,
  // runEvaluation is called and the result returned is passed here

  const records = parse(resultFiles.evaluated, {
    columns: true,
    skip_empty_lines: true
  });

  if (!records.length) throw new Error('No evaluation records found');

  // Extract student_id and question_id from the first record
  const student_id = records[0].student_id;
  const question_id = records[0]['question.testcase'].split('.')[0];


  const submission = new Submission({
    userId: student_id,
    questionId: question_id,
    evaluationResults: records,
    submittedAt: new Date(),
  });
  await submission.save();

  // Mark as best if it's the only or best submission
  const prevBest = await Submission.findOne({
    userId: student_id,
    questionId: question_id,
    isBestSubmission: true
  });
  
  if (!prevBest || prevBest.score < submission.score) {
    if (prevBest) {
      prevBest.isBestSubmission = false;
      await prevBest.save();
    }

    submission.isBestSubmission = true;
    await submission.save();
  }

  return submission;
}



export async function calculateScore(evaluationResults) {
  // score calculate logic
}