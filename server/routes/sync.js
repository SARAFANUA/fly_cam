// server/routes/sync.js
import express from 'express';
import { syncGoogleSheetToSqlite } from '../services/syncGoogleSheetToSqlite.js';

export default function syncRoutes(db) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const key = process.env.SYNC_API_KEY || '';
    if (key) {
      const got = req.header('x-api-key') || '';
      if (got !== key) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
    }

    try {
      const result = await syncGoogleSheetToSqlite(db);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[sync] error:', err);
      res.status(500).json({ ok: false, error: err?.message || 'sync failed' });
    }
  });

  return router;
}
