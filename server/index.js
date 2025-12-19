// server/index.js
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import filtersRoutes from './routes/filters.js';
import warRoutes from './routes/war.js';

import camerasRoutes from './routes/cameras.js';
import metaRoutes from './routes/meta.js';
import syncRoutes from './routes/sync.js';

dotenv.config();

// ✅ ПРАВИЛЬНИЙ __dirname для ESM + Windows
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'db', 'ksv.sqlite');

const SCHEMA_PATH = path.join(__dirname, 'db', 'schema.sql');

// ✅ Гарантуємо існування папки
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// DB init
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// --- ВИПРАВЛЕННЯ ДЛЯ ПОШУКУ (Кирилиця) ---
// SQLite за замовчуванням не вміє робити lower() для кирилиці.
// Ми перевизначаємо цю функцію, використовуючи JavaScript .toLowerCase(), 
// який чудово працює з українською мовою.
db.function('lower', { deterministic: true }, (str) => {
  return str ? String(str).toLowerCase() : null;
});
// -------------------------------------------

// Apply schema
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSql);

// App
const app = express();
app.use(express.json({ limit: '5mb' }));

// Static frontend
const frontendRoot = path.resolve(__dirname, '..');
app.use(express.static(frontendRoot));

// API
app.use('/api/cameras', camerasRoutes(db));
app.use('/api/meta', metaRoutes(db));
app.use('/api/sync', syncRoutes(db));
app.use('/api/filters', filtersRoutes(db));
app.use('/api/war', warRoutes());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] db: ${DB_PATH}`);
});