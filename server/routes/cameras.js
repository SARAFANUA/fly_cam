// server/routes/cameras.js
import express from 'express';

// ✅ ДОДАНО: Всі поля, які ми хочемо фільтрувати
const ALLOWED_FILTERS = new Set([
  'oblast',
  'raion',
  'hromada',
  'camera_status',
  'integration_status',
  'license_type',       // Новий
  'analytics_object',   // Новий
  'ka_access',          // Новий
  'system',             // Новий (спеціальна обробка)
  'camera_id_like'      // Новий (для пошуку по ID)
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

      // ✅ 1. Фільтр по Системі (LIKE, бо в полі список через кому)
      if (k === 'system') {
        where.push('integrated_systems LIKE @system_like');
        params.system_like = `%${String(v).trim()}%`; 
        continue;
      }

      // ✅ 2. Фільтр по ID камери (LIKE, для часткового збігу)
      if (k === 'camera_id_like') {
        where.push('camera_id LIKE @camera_id_like_val');
        params.camera_id_like_val = `%${String(v).trim()}%`;
        continue;
      }

      // ✅ 3. Стандартні точні фільтри (license_type, ka_access, oblast...)
      where.push(`${k} = @${k}`);
      params[k] = String(v);
    }

    // q: загальний пошук
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

    const countSql = `SELECT COUNT(*) AS cnt FROM cameras ${whereSql}`;

    try {
      const items = db.prepare(sql).all({ ...params, limit, offset });
      const total = db.prepare(countSql).get(params).cnt;
      res.json({ ok: true, total, limit, offset, items });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Endpoint для отримання списків фільтрів
  router.get('/filters', (req, res) => {
    const fields = [
      'oblast', 'raion', 'hromada',
      'camera_status', 'integration_status',
      'license_type', 'analytics_object',
      'object_type', 'settlement_type',
      'ka_access' // ✅ Додано
    ];

    const result = {};

    // Збираємо унікальні значення для простих полів
    for (const f of fields) {
      try {
        const rows = db.prepare(`
          SELECT DISTINCT ${f} AS v
          FROM cameras
          WHERE ${f} IS NOT NULL AND TRIM(${f}) <> ''
          ORDER BY ${f}
          LIMIT 1000
        `).all();
        // Для фронтенду ka_access очікується як ka_access_values, але можна і так
        // Якщо треба адаптувати під фронт:
        if (f === 'ka_access') result.ka_access_values = rows.map(r => r.v);
        else if (f === 'camera_status') result.camera_statuses = rows.map(r => r.v);
        else result[f] = rows.map(r => r.v);
      } catch (err) {
        console.error(`Error loading filter ${f}:`, err.message);
      }
    }

    // ✅ Збираємо системи (розбиваємо рядок через кому)
    try {
      const rows = db.prepare(`
        SELECT integrated_systems 
        FROM cameras 
        WHERE integrated_systems IS NOT NULL AND TRIM(integrated_systems) <> ''
      `).all();
      
      const sysSet = new Set();
      rows.forEach(r => {
        String(r.integrated_systems).split(/[,;]/).forEach(s => {
          const val = s.trim();
          if (val) sysSet.add(val);
        });
      });
      result.systems = Array.from(sysSet).sort();
    } catch (err) {
      console.error("Error loading systems:", err.message);
      result.systems = [];
    }

    res.json({ ok: true, filters: result });
  });

  return router;
}