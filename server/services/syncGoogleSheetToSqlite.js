// server/services/syncGoogleSheetToSqlite.js
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import { importRowsToDb } from './syncHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Шлях до конфігу зі списку ID
const CONFIG_PATH = path.join(__dirname, '../config/sheets.json');

function loadSheetIds() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.warn(`[Config] Warning: ${CONFIG_PATH} not found.`);
    return [];
  }
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`[Config] Error parsing sheets.json:`, err);
    return [];
  }
}

function loadServiceAccount() {
  // Пріоритет 1: Base64 з ENV (для продакшену)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_B64) {
    const json = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
    return JSON.parse(json);
  }
  // Пріоритет 2: Файл JSON через шлях в ENV
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const jsonPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (fs.existsSync(jsonPath)) {
        const json = fs.readFileSync(jsonPath, 'utf8');
        return JSON.parse(json);
    }
  }
  throw new Error('Service account not configured (GOOGLE_SERVICE_ACCOUNT_JSON not found)');
}

async function fetchOneSheet(sheetsClient, sheetId, tabName) {
  try {
    const resp = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A:ZZ`,
    });
    return resp.data.values || [];
  } catch (err) {
    console.error(`[Sync] Error fetching sheet ${sheetId}: ${err.message}`);
    return [];
  }
}

export async function syncAllSheets(db) {
  const sheetIds = loadSheetIds();
  const tab = process.env.GOOGLE_SHEET_TAB || 'Sheet1'; 

  if (sheetIds.length === 0) {
    return { error: 'No sheet IDs found in server/config/sheets.json' };
  }

  const sa = loadServiceAccount();
  
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  let totalUpserted = 0;
  const processedSheets = [];
  const errors = [];

  console.log(`[Sync] Found ${sheetIds.length} sheets. Starting sync...`);

  for (const sheetId of sheetIds) {
    const values = await fetchOneSheet(sheets, sheetId, tab);

    if (values.length < 2) {
        if(values.length === 0) errors.push(`${sheetId}: Empty or Auth Error`);
        continue;
    }

    const headers = values[0];
    let dataRows = values.slice(1);

    // Пропускаємо 1-й рядок прикладів (ваше правило)
    if (dataRows.length > 0) dataRows = dataRows.slice(1);

    const rowsAsObjects = dataRows.map((row) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[String(h)] = row[idx] ?? ''; });
      return obj;
    });

    try {
        const count = importRowsToDb(db, rowsAsObjects);
        totalUpserted += count;
        processedSheets.push(sheetId);
    } catch (e) {
        console.error(`[Sync] DB Error ${sheetId}:`, e.message);
        errors.push(`${sheetId}: DB Error`);
    }

    // Пауза 200мс щоб не отримати бан від Google API
    await new Promise(r => setTimeout(r, 200));
  }

  // Оновлення статусу в БД
  db.prepare(`
    UPDATE sync_state
    SET source='google_sheets_multi', sheet_id=?, tab_name=?, last_sync_at=?, rows_upserted=?
    WHERE id=1
  `).run(
    `Batch (${processedSheets.length}/${sheetIds.length})`,
    tab,
    new Date().toISOString(),
    totalUpserted
  );

  return { 
      total_sheets: sheetIds.length, 
      processed: processedSheets.length,
      rows_upserted: totalUpserted,
      errors 
  };
}