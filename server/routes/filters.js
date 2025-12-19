// server/routes/filters.js
import express from 'express';

// Словник для виправлення одруківок та нормалізації
const NORMALIZATION_MAP = {
  // КА Доступ
  'hi': 'Ні',
  'ні': 'Ні',
  'так': 'Так',
  'yes': 'Так',
  'no': 'Ні',
  
  // Статуси
  'прцює': 'Працює',
  'працює': 'Працює',
  'тимчасово не працює': 'Тимчасово не працює', // Вирівнювання регістру
  'виведена з ладу': 'Виведена з ладу',
  'відключена': 'Відключена',
  'знищена': 'Знищена',
  'демонтована': 'Демонтована'
};

function normalizeValue(val) {
  if (!val) return val;
  const lower = String(val).toLowerCase().trim();
  return NORMALIZATION_MAP[lower] || String(val).trim(); // Повертаємо виправлене або оригінал (почищений)
}

export default function filtersRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { oblast, raion } = req.query;

    const result = {};

    // 1. Прості поля (без змін логіки)
    const simpleFields = ['oblast', 'raion', 'hromada'];
    for (const f of simpleFields) {
      try {
        let sql = `SELECT DISTINCT ${f} as val FROM cameras WHERE ${f} IS NOT NULL AND TRIM(${f}) <> ''`;
        const params = [];
        if (f === 'raion' && oblast) { sql += ` AND oblast = ?`; params.push(oblast); }
        if (f === 'hromada') {
            if (raion) { sql += ` AND raion = ?`; params.push(raion); }
            else if (oblast) { sql += ` AND oblast = ?`; params.push(oblast); }
        }
        sql += ` ORDER BY ${f}`;
        result[f] = db.prepare(sql).all(...params).map(r => r.val);
      } catch (e) { result[f] = []; }
    }

    // 2. Поля зі списком значень (split) - Ліцензії, Аналітика, Системи
    const splitFields = {
      'license_type': 'license_type',
      'analytics_object': 'analytics_object',
      'integrated_systems': 'systems' // мапінг назви в БД -> назва в JSON
    };

    for (const [dbField, jsonKey] of Object.entries(splitFields)) {
      try {
        const rows = db.prepare(`SELECT DISTINCT ${dbField} as val FROM cameras WHERE ${dbField} IS NOT NULL`).all();
        const uniqueSet = new Set();
        
        rows.forEach(r => {
          // Розбиваємо по комі, крапці з комою або новому рядку
          const parts = String(r.val).split(/[,;\n]/); 
          parts.forEach(p => {
            let clean = p.trim();
            // Прибираємо зайві пробіли всередині
            clean = clean.replace(/\s+/g, ' '); 
            // Нормалізуємо першу літеру
            if (clean.length > 1) clean = clean.charAt(0).toUpperCase() + clean.slice(1);
            
            if (clean.length > 2) uniqueSet.add(clean);
          });
        });
        result[jsonKey] = Array.from(uniqueSet).sort();
      } catch (e) { result[jsonKey] = []; }
    }

    // 3. Поля для нормалізації (Статус, КА)
    const normFields = {
      'camera_status': 'camera_statuses',
      'ka_access': 'ka_access_values'
    };

    for (const [dbField, jsonKey] of Object.entries(normFields)) {
      try {
        const rows = db.prepare(`SELECT DISTINCT ${dbField} as val FROM cameras WHERE ${dbField} IS NOT NULL`).all();
        const uniqueSet = new Set();
        rows.forEach(r => {
           const norm = normalizeValue(r.val);
           if (norm) uniqueSet.add(norm);
        });
        result[jsonKey] = Array.from(uniqueSet).sort();
      } catch (e) { result[jsonKey] = []; }
    }

    res.json({ ok: true, filters: result });
  });

  // ... (suggest та regions/search залишаються без змін) ...
  // Скопіюйте сюди код для router.get('/suggest') та router.get('/regions/search') з попередньої версії
  // Якщо потрібно, я можу надати повний файл, але ці частини не змінилися.
  
  // 2. SUGGEST
  router.get('/suggest', (req, res) => {
    try {
      const { camera_id_like, limit = 20 } = req.query;
      if (!camera_id_like || camera_id_like.length < 1) return res.json({ ok: true, items: [] });
      const sql = `SELECT camera_id, camera_name FROM cameras WHERE lower(camera_id) LIKE lower(?) ORDER BY 1 LIMIT ?`;
      const rows = db.prepare(sql).all(`%${camera_id_like}%`, limit);
      res.json({ ok: true, items: rows }); 
    } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
  });

  // 3. REGIONS SEARCH
  router.get('/regions/search', (req, res) => {
    try {
        const { type, query } = req.query; 
        if (!query || query.length < 2) return res.json({ ok: true, items: [] });
        let sql = '', params = [`${query}%`]; 
        if (type === 'hromada') sql = `SELECT DISTINCT hromada, raion, oblast FROM katottg_regions WHERE lower(hromada) LIKE lower(?) ORDER BY hromada LIMIT 20`;
        else if (type === 'raion') sql = `SELECT DISTINCT raion, oblast FROM katottg_regions WHERE lower(raion) LIKE lower(?) ORDER BY raion LIMIT 20`;
        else sql = `SELECT DISTINCT oblast FROM katottg_regions WHERE lower(oblast) LIKE lower(?) ORDER BY oblast LIMIT 20`;
        const items = db.prepare(sql).all(...params);
        res.json({ ok: true, items });
    } catch (err) { res.json({ ok: true, items: [] }); }
  });

  return router;
}