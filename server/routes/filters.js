// server/routes/filters.js
import express from 'express';

export default function filtersRoutes(db) {
  const router = express.Router();

  // 1. Отримати всі списки для фільтрів
  router.get('/', (req, res) => {
    const { oblast, raion } = req.query;

    const simpleFields = [
      'oblast', 'raion', 'hromada',
      'camera_status', 
      'license_type',
      'analytics_object',
      'ka_access'
    ];

    const result = {};

    for (const f of simpleFields) {
      try {
        let sql = `SELECT DISTINCT ${f} as val FROM cameras WHERE ${f} IS NOT NULL AND TRIM(${f}) <> ''`;
        const params = [];

        // Каскадна логіка фільтрації
        if (f === 'raion' && oblast) {
            sql += ` AND oblast = ?`;
            params.push(oblast);
        }
        if (f === 'hromada') {
            if (raion) {
                sql += ` AND raion = ?`;
                params.push(raion);
            } else if (oblast) {
                sql += ` AND oblast = ?`;
                params.push(oblast);
            }
        }

        sql += ` ORDER BY ${f}`;
        
        const rows = db.prepare(sql).all(...params);
        result[f === 'ka_access' ? 'ka_access_values' : f] = rows.map(r => r.val);
      } catch (err) {
        console.error(`Error fetching filter ${f}:`, err.message);
        result[f] = [];
      }
    }
    
    result.camera_statuses = result.camera_status;
    delete result.camera_status;

    // Системи
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
      result.systems = [];
    }

    res.json({ ok: true, filters: result });
  });

  // 2. АВТОДОПОВНЕННЯ (Suggest) для ID камери
  // ЗАЛИШАЄМО "CONTAINS" (містить) -> %...%
  router.get('/suggest', (req, res) => {
    try {
      const { camera_id_like, limit = 20 } = req.query;
      
      if (!camera_id_like || camera_id_like.length < 1) {
        return res.json({ ok: true, items: [] });
      }

      const sql = `
        SELECT camera_id, camera_name
        FROM cameras
        WHERE lower(camera_id) LIKE lower(?) 
        ORDER BY 
          CASE WHEN lower(camera_id) LIKE lower(?) THEN 1 ELSE 2 END,
          camera_id ASC
        LIMIT ?
      `;
      
      const pattern = `%${camera_id_like}%`; // <-- Залишили % на початку (пошук входження)
      const startPattern = `${camera_id_like}%`;
      
      const rows = db.prepare(sql).all(pattern, startPattern, limit);
      
      res.json({ ok: true, items: rows }); 

    } catch (err) {
      console.error("Suggest error:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 3. Розумний пошук регіонів
  // ЗМІНЕНО НА "STARTS WITH" (починається з) -> ...%
  router.get('/regions/search', (req, res) => {
    try {
        const { type, query } = req.query; // type: 'oblast' | 'raion' | 'hromada'
        if (!query || query.length < 2) return res.json({ ok: true, items: [] });

        let sql = '';
        // ✅ ЗМІНА ТУТ: Прибрали % на початку. Тепер шукає тільки ті, що починаються на query
        let params = [`${query}%`]; 

        if (type === 'hromada') {
            sql = `
                SELECT DISTINCT hromada, raion, oblast 
                FROM katottg_regions 
                WHERE lower(hromada) LIKE lower(?) 
                ORDER BY hromada LIMIT 20
            `;
        } else if (type === 'raion') {
            sql = `
                SELECT DISTINCT raion, oblast 
                FROM katottg_regions 
                WHERE lower(raion) LIKE lower(?) 
                ORDER BY raion LIMIT 20
            `;
        } else {
            // oblast
            sql = `
                SELECT DISTINCT oblast 
                FROM katottg_regions 
                WHERE lower(oblast) LIKE lower(?) 
                ORDER BY oblast LIMIT 20
            `;
        }

        const items = db.prepare(sql).all(...params);
        res.json({ ok: true, items });

    } catch (err) {
        console.error("Region search error:", err);
        res.json({ ok: true, items: [] }); 
    }
  });

  return router;
}