// server/routes/sync.js
import express from 'express';
import { syncAllSheets } from '../services/syncGoogleSheetToSqlite.js';

export default function syncRoutes(db) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    // Тут можна додати перевірку x-api-key, якщо потрібно
    try {
      console.log('[API] Starting sync...');
      const result = await syncAllSheets(db);
      console.log('[API] Sync finished:', result);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[API] Sync fatal error:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Sync failed' });
    }
  });

  return router;
}