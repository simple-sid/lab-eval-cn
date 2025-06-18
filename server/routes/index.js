import { Router } from 'express';
import pingRoute from './ping.js';
import { saveFileToContainer } from '../controllers/sshController.js';

const router = Router();

// You can register multiple route files here
router.use('/ping', pingRoute);

// Save file to container
router.post('/save-file', async (req, res) => {
  try {
    const { userId = 'testuser123', filename, code } = req.body;
    if (!filename || !code) return res.status(400).json({ error: 'Missing filename or code' });
    await saveFileToContainer({ userId, filename, code });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;