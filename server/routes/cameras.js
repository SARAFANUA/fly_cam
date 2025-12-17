// server/routes/cameras.js
import express from 'express';

// 1. Додаємо нові поля у білий список
const ALLOWED_FILTERS = new Set([
  'oblast',
  'raion',
  'hromada',
  'camera_status',
  'integration_status',
  'license_type',       // <-- Додано
  'analytics_object',   // <-- Додано
  'ka_access',          // <-- Додано
  'system'              // <-- Додано (спеціальна обробка нижче)
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

    // bbox
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

    // Точні та спеціальні фільтри
    for (const [k, v] of Object.entries(req.query)) {
      if (!ALLOWED_FILTERS.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;

      // Спеціальна обробка для системи (integrated_systems LIKE ...)
      if (k === 'system') {
        where.push('integrated_systems LIKE @system_like');
        params.system_like = `%${String(v).trim()}%`; 
        continue;
      }

      // Стандартна обробка (точне співпадіння)
      where.push(`${k} = @${k}`);
      params[k] = String(v);
    }

    // Пошук (q)
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

    try {
      const items = db.prepare(sql).all({ ...params, limit, offset });
      const total = db.prepare(countSql).get(params).cnt;
      res.json({ ok: true, total, limit, offset, items });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // /filters endpoint залишаємо без змін...
  router.get('/filters', (req, res) => {
     // ... (старий код для filters, він був ок)
     // Скопіюйте сюди ту частину, що була у попередньому файлі, 
     // або залиште як є, якщо ви не змінювали логіку заповнення списків.
     // Для стислості тут опускаю, головне - виправити router.get('/')
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
      } catch { }
    }
    
    // Окремо системи, бо вони через кому
     const systemsRaw = db.prepare(`
      SELECT integrated_systems
      FROM cameras
      WHERE integrated_systems IS NOT NULL AND TRIM(integrated_systems) <> ''
    `).all();
    const systemsSet = new Set();
    systemsRaw.forEach(r => {
        String(r.integrated_systems).split(',').forEach(s => systemsSet.add(s.trim()));
    });
    result.systems = Array.from(systemsSet).filter(Boolean).sort();
    
    // Окремо статуси
     const statusSet = new Set(db.prepare(`SELECT DISTINCT camera_status FROM cameras`).all().map(r=>r.camera_status));
     result.camera_statuses = Array.from(statusSet).filter(Boolean).sort();

     // Окремо КА
     const kaSet = new Set(db.prepare(`SELECT DISTINCT ka_access FROM cameras`).all().map(r=>r.ka_access));
     result.ka_access_values = Array.from(kaSet).filter(Boolean).sort();

    res.json({ ok: true, filters: result });
  });

  return router;
}