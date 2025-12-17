// server/services/importRegionsToSqlite.js
//
// CLI:
// node server/services/importRegionsToSqlite.js "path/to/Регіони_КАТОТТГ - КАТОТТГ.csv"
//
// Твій CSV має колонки:
// 1_id_Область, 1_Область, 2_id_Район, 2_Район, 3_id_Громада, 3_Територіальна громада
//
// Ми пишемо у katottg_regions:
// katottg = 3_id_Громада
// oblast  = 1_Область
// raion   = 2_Район
// hromada = 3_Територіальна громада

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import Papa from 'papaparse';

function cleanHeader(h) {
  return String(h || '')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function normText(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function ensureSchema(db) {
  const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

function detectDelimiter(csvText) {
  const firstLine = (csvText.split(/\r?\n/)[0] || '').trim();
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  return (tabCount > semicolonCount && tabCount > commaCount) ? '\t'
       : (semicolonCount > commaCount) ? ';'
       : ',';
}

export function importRegionsToSqlite({ csvPath, dbPath }) {
  const db = new Database(dbPath);
  ensureSchema(db);

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const delimiter = detectDelimiter(csvText);

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  });

  if (parsed.errors?.length) {
    console.error(parsed.errors);
    throw new Error('Regions CSV parse errors');
  }

  const rows = (parsed.data || []).map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) out[cleanHeader(k)] = v;
    return out;
  });

  const stmt = db.prepare(`
    INSERT INTO katottg_regions (katottg, oblast, raion, hromada)
    VALUES (@katottg, @oblast, @raion, @hromada)
    ON CONFLICT(katottg) DO UPDATE SET
      oblast=excluded.oblast,
      raion=excluded.raion,
      hromada=excluded.hromada
  `);

  const tx = db.transaction((items) => {
    let ok = 0;

    for (const r of items) {
      // ✅ головне: katottg з 3_id_Громада
      const katottg = normText(pick(r, [
        '3_id_Громада',
        '3_id_Громади',
        '3_id_ТГ',
        'katottg', 'КАТОТТГ', 'KATOTTG', 'KATOTTH', 'katotth'
      ]));
      if (!katottg) continue;

      const oblast = normText(pick(r, ['1_Область', 'Область', 'oblast']));
      const raion = normText(pick(r, ['2_Район', 'Район', 'raion']));
      const hromada = normText(pick(r, ['3_Територіальна громада', 'Територіальна громада', 'Громада', 'hromada']));

      stmt.run({ katottg, oblast, raion, hromada });
      ok++;
    }

    return ok;
  });

  const upserted = tx(rows);
  return { upserted, delimiter };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('importRegionsToSqlite.js')) {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node server/services/importRegionsToSqlite.js path/to/regions.csv');
    process.exit(1);
  }

  const resolvedCsv = path.resolve(csvPath);
  const resolvedDb = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.resolve(process.cwd(), 'server', 'db', 'ksv.sqlite');

  const result = importRegionsToSqlite({ csvPath: resolvedCsv, dbPath: resolvedDb });
  console.log('[importRegionsToSqlite]', result);
}
