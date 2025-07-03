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

router.post('/db', async (req, res) => {
  try {
    const {
      userId,
      questionId,
      module,
      sourceCode,
      language,
      passedCount,
      totalTestCases,
    } = req.body;

    if (!questionId || !module || !sourceCode || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sessionId = generateSessionId();

    const submission = new Submission({
      userId,
      questionId,
      sessionId,
      module,
      sourceCode,
      language,
      passedCount,
      totalTestCases,
      submittedAt: new Date(),
    });

    await submission.save();

    res.json({ success: true, message: 'Submission stored to DB' });
  } catch (err) {
    console.error('[API] /submission/db error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

export default router;