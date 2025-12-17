// server/routes/meta.js
import express from 'express';

export default function metaRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM cameras').get().cnt;
    const state = db.prepare('SELECT * FROM sync_state WHERE id=1').get();

    res.json({
      ok: true,
      cameras_count: count,
      sync: {
        source: state?.source ?? null,
        sheet_id: state?.sheet_id ?? null,
        tab_name: state?.tab_name ?? null,
        last_sync_at: state?.last_sync_at ?? null,
        rows_upserted: state?.rows_upserted ?? 0,
      },
    });
  });

  return router;
}
