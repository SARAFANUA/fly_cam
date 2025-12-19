// server/routes/cameras.js
import express from 'express';
import CryptoJS from 'crypto-js';

// Секретний ключ (має співпадати з клієнтським)
const SECRET_KEY = process.env.app_key || 'FlyKA_Secure_Key_2024_SOVA';

const ALLOWED_FILTERS = new Set([
  'oblast', 'raion', 'hromada',
  'camera_status', 'integration_status',
  'license_type', 'analytics_object', 'ka_access', 
  'system', 'camera_id_like'
]);

// Мапа нормалізації для зворотнього пошуку
const REVERSE_NORM_MAP = {
    'ні': ['ні', 'hi', 'no', 'false'],
    'так': ['так', 'yes', 'true'],
    'працює': ['працює', 'прцює', 'active', 'on'],
    'тимчасово не працює': ['тимчасово не працює', 'тимчасово непрацює', 'off']
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

    // 1. bbox logic
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

    // 2. Dynamic filters
    for (const [k, v] of Object.entries(req.query)) {
      if (!ALLOWED_FILTERS.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;
      const valStr = String(v).trim();

      // А. Поля-списки (Ліцензія, Аналітика, Система) -> використовуємо LIKE
      if (['license_type', 'analytics_object', 'system'].includes(k)) {
        const dbField = k === 'system' ? 'integrated_systems' : k;
        where.push(`${dbField} LIKE @${k}_like`);
        params[`${k}_like`] = `%${valStr}%`;
        continue;
      }

      // Б. Camera ID (Like)
      if (k === 'camera_id_like') {
        where.push('camera_id LIKE @camera_id_like_val');
        params.camera_id_like_val = `%${valStr}%`;
        continue;
      }

      // В. Поля з нормалізацією (Статус, КА)
      if (['camera_status', 'ka_access'].includes(k)) {
          const lowerVal = valStr.toLowerCase();
          const variants = REVERSE_NORM_MAP[lowerVal];
          
          if (variants) {
              // Шукаємо будь-який з варіантів
              const keyParams = variants.map((_, i) => `@${k}_${i}`);
              where.push(`lower(${k}) IN (${keyParams.join(',')})`);
              variants.forEach((varVal, i) => params[`${k}_${i}`] = varVal);
          } else {
              // Точний пошук
              where.push(`lower(${k}) = lower(@${k})`);
              params[k] = valStr;
          }
          continue;
      }

      // Г. Стандартні поля (Область, Район...)
      where.push(`${k} = @${k}`);
      params[k] = valStr;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // Додаємо LIMIT та OFFSET
    const sql = `SELECT * FROM cameras ${whereSql} LIMIT @limit OFFSET @offset`;

    try {
      const items = db.prepare(sql).all({ ...params, limit, offset });
      
      // --- ШИФРУВАННЯ ---
      // Формуємо об'єкт відповіді
      const responseData = { items, limit, offset };
      
      // Перетворюємо в рядок і шифруємо
      const dataString = JSON.stringify(responseData);
      const encrypted = CryptoJS.AES.encrypt(dataString, SECRET_KEY).toString();

      // Відправляємо зашифрований payload
      res.json({ ok: true, payload: encrypted });
      
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}