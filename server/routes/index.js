import { Router } from 'express';
import pingRoute from './ping.js';
import { saveFileToContainer, runAndEvaluate } from '../controllers/sshController.js';

const router = Router();

// You can register multiple route files here
router.use('/ping', pingRoute);

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
    const { userId = 'testuser123', filename, code, language, evaluationScript, testCases } = req.body;
    if (!filename || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields (filename, code, language)' });
    }
    const result = await runAndEvaluate({ userId, filename, code, language, evaluationScript, testCases });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API] run-evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;