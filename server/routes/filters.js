// server/routes/filters.js
import express from 'express';

function normalizeStatus(v) {
  if (!v) return null;
  const s = String(v).trim();

  const lower = s.toLowerCase();
  if (lower === 'Прцює' || lower === 'Працює') return 'Працює';
  if (lower === 'Тимчасово не працює' || lower === 'Тимчасово не працюе' || lower === 'тИмчасово не працює'.toLowerCase())
    return 'Тимчасово не працює';

  // інші — як є, але з нормальним регістром першої літери (мінімально)
  return s;
}

function splitSystems(value) {
  if (!value) return [];
  // у тебе роздільник ", " (але зробимо стійко)
  return String(value)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export default function filtersRoutes(db) {
  const router = express.Router();

  // /api/filters?oblast=&raion=
  router.get('/', (req, res) => {
    const oblast = (req.query.oblast || '').trim() || null;
    const raion = (req.query.raion || '').trim() || null;

    // 1) Області з довідника
    const oblasts = db.prepare(`
      SELECT DISTINCT oblast
      FROM katottg_regions
      WHERE oblast IS NOT NULL AND TRIM(oblast) <> ''
      ORDER BY oblast
    `).all().map(r => r.oblast);

    // 2) Райони (залежні від області)
    const raions = oblast
      ? db.prepare(`
          SELECT DISTINCT raion
          FROM katottg_regions
          WHERE oblast = ? AND raion IS NOT NULL AND TRIM(raion) <> ''
          ORDER BY raion
        `).all(oblast).map(r => r.raion)
      : [];

    // 3) Громади (залежні від області+району)
    const hromadas = (oblast && raion)
      ? db.prepare(`
          SELECT DISTINCT hromada
          FROM katottg_regions
          WHERE oblast = ? AND raion = ? AND hromada IS NOT NULL AND TRIM(hromada) <> ''
          ORDER BY hromada
        `).all(oblast, raion).map(r => r.hromada)
      : [];

    // 4) Унікальні системи (розпилюємо рядки)
    const systemsRaw = db.prepare(`
      SELECT integrated_systems
      FROM cameras
      WHERE integrated_systems IS NOT NULL AND TRIM(integrated_systems) <> ''
    `).all();

    const systemsSet = new Set();
    for (const row of systemsRaw) {
      for (const s of splitSystems(row.integrated_systems)) systemsSet.add(s);
    }
    const systems = Array.from(systemsSet).sort((a, b) => a.localeCompare(b, 'uk'));

    // 5) Стани камер (нормалізуємо)
    const statusRaw = db.prepare(`
      SELECT DISTINCT camera_status AS s
      FROM cameras
      WHERE camera_status IS NOT NULL AND TRIM(camera_status) <> ''
    `).all();

    const statusSet = new Set();
    for (const r of statusRaw) statusSet.add(normalizeStatus(r.s));
    const camera_statuses = Array.from(statusSet).filter(Boolean).sort((a,b)=>a.localeCompare(b,'uk'));

    // 6) Доступ КА (Так/Ні)
    const kaSet = new Set(
      db.prepare(`
        SELECT DISTINCT ka_access AS v
        FROM cameras
        WHERE ka_access IS NOT NULL AND TRIM(ka_access) <> ''
      `).all().map(r => String(r.v).trim())
    );
    const ka_access_values = Array.from(kaSet).sort((a,b)=>a.localeCompare(b,'uk'));

    res.json({
      ok: true,
      oblasts,
      raions,
      hromadas,
      systems,
      camera_statuses,
      ka_access_values
    });
  });

  // /api/filters/suggest?camera_id_like=...&limit=20
  router.get('/suggest', (req, res) => {
    const q = String(req.query.camera_id_like || '').trim();
    const limit = Math.min(Number(req.query.limit || 20) || 20, 50);

    if (q.length < 2) {
      return res.json({ ok: true, items: [] });
    }

    const items = db.prepare(`
      SELECT camera_id, camera_name
      FROM cameras
      WHERE camera_id LIKE ?
      ORDER BY camera_id
      LIMIT ?
    `).all(`%${q}%`, limit);

    res.json({ ok: true, items });
  });

  return router;
}
