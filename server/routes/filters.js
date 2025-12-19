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
  'тимчасово не працює': 'Тимчасово не працює',
  'виведена з ладу': 'Виведена з ладу',
  'відключена': 'Відключена',
  'знищена': 'Знищена',
  'демонтована': 'Демонтована'
};

function normalizeValue(val) {
  if (!val) return val;
  const lower = String(val).toLowerCase().trim();
  return NORMALIZATION_MAP[lower] || String(val).trim();
}

export default function filtersRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    // Отримуємо параметри регіонів
    const { oblast, raion, hromada } = req.query;

    const result = {};

    // 1. Прості поля (Регіони) - тут фільтрація не потрібна, це джерело для автокомпліту
    const simpleFields = ['oblast', 'raion', 'hromada'];
    for (const f of simpleFields) {
      try {
        // Тут ми навмисно не фільтруємо, щоб автокомпліт працював глобально
        // (або можна фільтрувати, якщо хочете "залежні" регіони, але це вже робить клієнт)
        let sql = `SELECT DISTINCT ${f} as val FROM cameras WHERE ${f} IS NOT NULL AND TRIM(${f}) <> '' ORDER BY ${f}`;
        result[f] = db.prepare(sql).all().map(r => r.val);
      } catch (e) { result[f] = []; }
    }

    // 2. Поля зі списком значень (Ліцензії, Аналітика, СИСТЕМИ)
    // ТУТ ВПРОВАДЖУЄМО ФІЛЬТРАЦІЮ ПО РЕГІОНУ
    const splitFields = {
      'license_type': 'license_type',
      'analytics_object': 'analytics_object',
      'integrated_systems': 'systems' 
    };

    for (const [dbField, jsonKey] of Object.entries(splitFields)) {
      try {
        let sql = `SELECT DISTINCT ${dbField} as val FROM cameras WHERE ${dbField} IS NOT NULL`;
        const params = [];

        // Динамічно додаємо умови, якщо параметри передані
        if (oblast) {
            sql += ` AND oblast = ?`;
            params.push(oblast);
        }
        if (raion) {
            sql += ` AND raion = ?`;
            params.push(raion);
        }
        if (hromada) {
            sql += ` AND hromada = ?`;
            params.push(hromada);
        }

        const rows = db.prepare(sql).all(...params);
        const uniqueSet = new Set();
        
        rows.forEach(r => {
          // Розбиваємо по комі, крапці з комою або новому рядку
          const parts = String(r.val).split(/[,;\n]/); 
          parts.forEach(p => {
            let clean = p.trim();
            clean = clean.replace(/\s+/g, ' '); 
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
        // Тут також можна додати фільтрацію, якщо хочете бачити тільки актуальні статуси для регіону
        // Але поки залишимо глобально, щоб не плутати користувача
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

  // 3. REGIONS SEARCH З КОДАМИ
  router.get('/regions/search', (req, res) => {
    try {
        const { type, query } = req.query; 
        if (!query || query.length < 2) return res.json({ ok: true, items: [] });
        
        let sql = '', params = [`${query}%`]; 
        
        // Повертаємо також коди (katottg, code_raion, code_oblast)
        if (type === 'hromada') {
            sql = `SELECT DISTINCT hromada, katottg as code, raion, code_raion, oblast, code_oblast FROM katottg_regions WHERE lower(hromada) LIKE lower(?) ORDER BY hromada LIMIT 20`;
        } else if (type === 'raion') {
             sql = `SELECT DISTINCT raion, code_raion as code, oblast, code_oblast FROM katottg_regions WHERE lower(raion) LIKE lower(?) ORDER BY raion LIMIT 20`;
        } else {
             sql = `SELECT DISTINCT oblast, code_oblast as code FROM katottg_regions WHERE lower(oblast) LIKE lower(?) ORDER BY oblast LIMIT 20`;
        }
        
        const items = db.prepare(sql).all(...params);
        res.json({ ok: true, items });
    } catch (err) { res.json({ ok: true, items: [] }); }
  });

  return router;
}