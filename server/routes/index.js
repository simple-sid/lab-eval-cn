import { Router } from 'express';
import pingRoute from './ping.js';
import questionsRoute from './questions.js';
import { saveFileToContainer, runAndEvaluate } from '../controllers/sshController.js';

const router = Router();

router.use('/ping', pingRoute);
router.use('/questions', questionsRoute);

// Save file to container
router.post('/save-file', async (req, res) => {
  try {
    // console.log('[API] save-file received:', req.body);
    const { userId = 'testuser123', filename, filePath, code } = req.body;
    if (!filename || !code) return res.status(400).json({ error: 'Missing filename or code' });
    await saveFileToContainer({ userId, filename, filePath, code });
    console.log('[API] save-file completed successfully');
    res.json({ success: true });
  } catch (err) {
    console.error('[API] save-file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Run code and evaluate protocol/test cases
router.post('/run-evaluate', async (req, res) => {
  try {
    const { 
      userId = 'testuser123', 
      filename, 
      code, 
      language, 
      evaluationScript = 'server_evaluator.py', 
      testCases = [],
      clientCount = 1,
      clientDelay = 0.5,
      evalType = 'default'
    } = req.body;
    if (!filename || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields (filename, code, language)' });
    }
    const result = await runAndEvaluate({ 
      userId, 
      filename, 
      code, 
      language, 
      evaluationScript, 
      testCases,
      clientCount,
      clientDelay,
      evalType
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] run-evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;