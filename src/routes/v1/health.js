import { Router } from 'express';
import db from '../../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable', ts: new Date().toISOString() });
  }
});

export default router;
