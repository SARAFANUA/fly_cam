// server/routes/cameras.js
import express from 'express';

const ALLOWED_FILTERS = new Set([
  'oblast', 'raion', 'hromada',
  'camera_status', 'integration_status',
  'license_type', 'analytics_object', 'ka_access', 
  'system', 'camera_id_like'
]);

// Мапа нормалізації для зворотнього пошуку (якщо користувач вибрав "Ні", шукаємо і "Ні", і "Hi", і "no")
const REVERSE_NORM_MAP = {
    'ні': ['ні', 'hi', 'no'],
    'так': ['так', 'yes'],
    'працює': ['працює', 'прцює', 'active'],
    'тимчасово не працює': ['ТИмчасово не працює', 'тимчасово не працює','тимчасово непрацює']
};

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

    // bbox logic (без змін)
    if (req.query.bbox) {
      const parts = String(req.query.bbox).split(',').map(s => parseFloat(s));
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [south, west, north, east] = parts;
        where.push('lat BETWEEN @south AND @north');
        where.push('lon BETWEEN @west AND @east');
        params.south = south; params.north = north; params.west = west; params.east = east;
      }
    }

    for (const [k, v] of Object.entries(req.query)) {
      if (!ALLOWED_FILTERS.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;
      const valStr = String(v).trim();

      // 1. Поля-списки (Ліцензія, Аналітика, Система) -> використовуємо LIKE
      if (['license_type', 'analytics_object', 'system'].includes(k)) {
        // system фільтруємо по полю integrated_systems
        const dbField = k === 'system' ? 'integrated_systems' : k;
        where.push(`${dbField} LIKE @${k}_like`);
        params[`${k}_like`] = `%${valStr}%`;
        continue;
      }

      // 2. Camera ID (Like)
      if (k === 'camera_id_like') {
        where.push('camera_id LIKE @camera_id_like_val');
        params.camera_id_like_val = `%${valStr}%`;
        continue;
      }

      // 3. Поля з нормалізацією (Статус, КА)
      if (['camera_status', 'ka_access'].includes(k)) {
          const lowerVal = valStr.toLowerCase();
          const variants = REVERSE_NORM_MAP[lowerVal];
          
          if (variants) {
              // Якщо є варіанти, шукаємо будь-який з них: status IN ('Працює', 'Прцює')
              // SQLite не чутливий до регістру для ASCII, але для кирилиці краще використати COLLATE NOCASE або lower()
              // Тут використаємо параметризований IN
              const keyParams = variants.map((_, i) => `@${k}_${i}`);
              where.push(`lower(${k}) IN (${keyParams.join(',')})`);
              variants.forEach((varVal, i) => params[`${k}_${i}`] = varVal);
          } else {
              // Точний пошук (case-insensitive)
              where.push(`lower(${k}) = lower(@${k})`);
              params[k] = valStr;
          }
          continue;
      }

      // 4. Стандартні поля (Область, Район...)
      where.push(`${k} = @${k}`);
      params[k] = valStr;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT * FROM cameras ${whereSql} LIMIT @limit OFFSET @offset`;

    try {
      const items = db.prepare(sql).all({ ...params, limit, offset });
      res.json({ ok: true, limit, offset, items }); // total не обов'язково рахувати кожен раз для швидкодії
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ... (router.get('/filters') перенесено в окремий файл filters.js, тут його не дублюємо) ...

  return router;
}