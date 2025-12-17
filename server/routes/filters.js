// server/routes/filters.js
import express from 'express';

export default function filtersRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    // Поля, для яких ми просто беремо унікальні значення
    const simpleFields = [
      'oblast', 'raion', 'hromada',
      'camera_status', 
      'license_type',      // <-- Важливо
      'analytics_object',  // <-- Важливо
      'ka_access'          // <-- Важливо
    ];

    const result = {};

    // 1. Прості списки
    for (const f of simpleFields) {
      try {
        const rows = db.prepare(`
          SELECT DISTINCT ${f} as val 
          FROM cameras 
          WHERE ${f} IS NOT NULL AND TRIM(${f}) <> ''
          ORDER BY ${f}
        `).all();
        result[f === 'ka_access' ? 'ka_access_values' : f] = rows.map(r => r.val);
      } catch (err) {
        console.error(`Error fetching filter ${f}:`, err.message);
        result[f] = [];
      }
    }
    
    // Перейменування ключів для фронтенду (якщо треба)
    result.camera_statuses = result.camera_status;
    delete result.camera_status;

    // 2. Системи (integrated_systems) - розділяємо через кому, якщо там список
    try {
      const rows = db.prepare(`
        SELECT integrated_systems 
        FROM cameras 
        WHERE integrated_systems IS NOT NULL AND TRIM(integrated_systems) <> ''
      `).all();
      
      const sysSet = new Set();
      rows.forEach(r => {
        // Якщо роздільник кома або крапка з комою
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

  return router;
}