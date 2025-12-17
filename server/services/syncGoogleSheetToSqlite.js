// server/services/syncGoogleSheetToSqlite.js
//
// Google Sheet -> SQLite UPSERT
// Правило: пропускаємо рівно 1 перший рядок даних після заголовків.
//
// ENV:
//   GOOGLE_SHEET_ID
//   GOOGLE_SHEET_TAB
//   GOOGLE_SERVICE_ACCOUNT_JSON   (шлях до json файла)  АБО
//   GOOGLE_SERVICE_ACCOUNT_B64    (base64 json)
//   DB_PATH (optional)

import fs from 'node:fs';
import { google } from 'googleapis';

import { importRowsToDb } from './syncHelpers.js';

function loadServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_B64) {
    const json = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
    return JSON.parse(json);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const json = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8');
    return JSON.parse(json);
  }
  throw new Error('Service account not configured (GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_B64)');
}

export async function syncGoogleSheetToSqlite(db) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tab = process.env.GOOGLE_SHEET_TAB;

  if (!sheetId || !tab) {
    throw new Error('Missing GOOGLE_SHEET_ID or GOOGLE_SHEET_TAB');
  }

  const sa = loadServiceAccount();

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A:ZZ`,
  });

  const values = resp.data.values || [];
  if (values.length < 2) {
    return { rows_upserted: 0, message: 'No data rows' };
  }

  const headers = values[0];
  let dataRows = values.slice(1);

  // ✅ пропускаємо рівно 1 перший рядок даних
  if (dataRows.length > 0) dataRows = dataRows.slice(1);

  const rowsAsObjects = dataRows.map((row) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[String(h)] = row[idx] ?? ''; });
    return obj;
  });

  const rowsUpserted = importRowsToDb(db, rowsAsObjects);

  db.prepare(`
    UPDATE sync_state
    SET source=@source, sheet_id=@sheet_id, tab_name=@tab_name, last_sync_at=@last_sync_at, rows_upserted=@rows_upserted
    WHERE id=1
  `).run({
    source: 'google_sheets',
    sheet_id: sheetId,
    tab_name: tab,
    last_sync_at: new Date().toISOString(),
    rows_upserted: rowsUpserted,
  });

  return { rows_upserted: rowsUpserted };
}
