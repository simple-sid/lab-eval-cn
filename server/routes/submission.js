import { Router } from 'express';
import Submission from '../models/Submission.js'

const router = Router();

function generateSessionId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  const period = now.getHours() < 12 ? 'FN' : 'AN';
  return `${year}${month}${day}_${period}`;
}

router.get('/fetch', async (req, res) => {
  try {
    const userId = req.query.userId; // assume frontend passes this
    const questionId = req.query.questionId; 
    const sessionId = generateSessionId();

    const query = { userId, questionId, sessionId };
    if (sessionId) query.sessionId = sessionId;

    const submissions = await Submission.find(query).sort({ submittedAt: -1 });

    const formatted = submissions.map(sub => ({
      id: sub._id,
      status: sub.passedCount === sub.totalTestCases ? 'Accepted' : 'Wrong Answer',
      timestamp: new Date(sub.submittedAt).toLocaleString(),
      sourceCode: sub.sourceCode,
      language: sub.language,
      passed: sub.passedCount,
      total: sub.totalTestCases,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('[GET] /api/submission/fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});



// ========================= STUDENT ENDPOINTS =========================

router.post('/evaluate/:studentId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { questionId, serverCode, clientCode } = req.body;

    if (!userId || !questionId || !serverCode || !clientCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Run evaluation in container
    const resultFiles = await runEvaluation(userId, questionId, serverCode, clientCode);
    
    // Process and store results
    const submission = await processEvaluationResults(resultFiles);
    
    res.json({
      success: true,
      submissionId: submission._id,
      isBest: submission.isBestSubmission,
      score: submission.score,
      code: submission.sourceCode
    });
  } catch (err) {
    console.error('[API] /submission/evaluate error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get all submissions for a student in the current session
router.get('/student-submissions/:studentId', async (req, res) => {
  try {
    const userId = req.params.studentId;
    const sessionId = generateSessionId();
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    // Return all submissions for this student in this session
    const submissions = await Submission.find({ userId, sessionId }).sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (err) {
    console.error('[GET] /api/submission/student-submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch student submissions' });
  }
});

// ========================= TEACHER ENDPOINTS =========================

// Get all best submissions for the current session (for teacher dashboard)
router.get('/best-submissions', async (req, res) => {
  try {
    const sessionId = generateSessionId();
    // Return all best submissions for this session, grouped by userId
    const bestSubs = await Submission.find({ sessionId, isBestSubmission: true }).lean();
    const grouped = {};
    for (const sub of bestSubs) {
      if (!grouped[sub.userId]) grouped[sub.userId] = [];
      grouped[sub.userId].push(sub);
    }
    res.json(grouped);
  } catch (err) {
    console.error('[GET] /api/submission/best-submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch best submissions' });
  }
});

// Export all best submissions as a CSV file (for teacher report download)
router.get('/export-best-csv', async (req, res) => {
  try {
    const sessionId = generateSessionId();
    const bestSubs = await Submission.find({ sessionId, isBestSubmission: true }).lean();
    if (!bestSubs.length) return res.status(404).send('No submissions found');

    // Collect all rows from all evaluationResults, using the original evaluated.csv format
    let header = null;
    const rows = [];
    for (const sub of bestSubs) {
      if (Array.isArray(sub.evaluationResults) && sub.evaluationResults.length > 0) {
        if (!header) header = Object.keys(sub.evaluationResults[0]);
        for (const rec of sub.evaluationResults) {
          rows.push(header.map(h => (rec[h] !== undefined ? String(rec[h]).replace(/"/g, '""') : '')).join(','));
        }
      }
    }
    if (!header) return res.status(404).send('No evaluation results found');
    const csv = [header.join(',')].concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="best_submissions.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[GET] /api/submission/export-best-csv error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;