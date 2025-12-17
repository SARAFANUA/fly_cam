// server/routes/cameras.js
import express from 'express';

const ALLOWED_FILTERS = new Set([
  'oblast',
  'raion',
  'hromada',
  'camera_status',
  'integration_status',
]);

function parseIntSafe(v, def) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : def;
}

export default function camerasRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const limit = Math.min(parseIntSafe(req.query.limit, 50000), 200000);
    const offset = Math.max(parseIntSafe(req.query.offset, 0), 0);

    const where = [];
    const params = {};

    // bbox = "south,west,north,east"
    if (req.query.bbox) {
      const parts = String(req.query.bbox).split(',').map(s => parseFloat(s));
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [south, west, north, east] = parts;
        where.push('lat BETWEEN @south AND @north');
        where.push('lon BETWEEN @west AND @east');
        params.south = south;
        params.north = north;
        params.west = west;
        params.east = east;
      }
    }

    // точні фільтри
    for (const [k, v] of Object.entries(req.query)) {
      if (!ALLOWED_FILTERS.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;
      where.push(`${k} = @${k}`);
      params[k] = String(v);
    }

    // q: пошук по кількох полях
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where.push(`(
        camera_id LIKE @q OR
        camera_name LIKE @q OR
        owner_name LIKE @q OR
        settlement_name LIKE @q OR
        street_name LIKE @q OR
        integrated_systems LIKE @q
      )`);
      params.q = q;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT *
      FROM cameras
      ${whereSql}
      LIMIT @limit OFFSET @offset
    `;

    const countSql = `
      SELECT COUNT(*) AS cnt
      FROM cameras
      ${whereSql}
    `;

    const items = db.prepare(sql).all({ ...params, limit, offset });
    const total = db.prepare(countSql).get(params).cnt;

    res.json({ ok: true, total, limit, offset, items });
  });

  // Простий endpoint для генерації фільтрів (v1)
  router.get('/filters', (req, res) => {
    const fields = [
      'oblast', 'raion', 'hromada',
      'camera_status', 'integration_status',
      'license_type', 'analytics_object',
      'object_type', 'settlement_type',
    ];

    const result = {};
    for (const f of fields) {
      try {
        const rows = db.prepare(`
          SELECT ${f} AS v
          FROM cameras
          WHERE ${f} IS NOT NULL AND TRIM(${f}) <> ''
          GROUP BY ${f}
          ORDER BY ${f}
          LIMIT 500
        `).all();
        result[f] = rows.map(r => r.v);
      } catch {
        // якщо поля немає — ігноруємо
      }
    }

    res.json({ ok: true, filters: result });
  });

  return router;
}
