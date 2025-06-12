// routes/index.js
import { Router } from 'express';
import pingRoute from './ping.js';

const router = Router();

// You can register multiple route files here
router.use('/ping', pingRoute);

export default router;