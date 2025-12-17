// server/services/syncHelpers.js
import Database from 'better-sqlite3';

const HEADER_TO_DB = {
  "Камера_ID": "camera_id",
  "Область": "oblast",
  "Назва камери у системі": "camera_name",
  "Дата встановлення камери": "install_date",
  "Тип камери за форматом відеосигналу": "video_signal_type",
  "Тип камери за збереженням інформації": "storage_type",
  "Час збереження відеоархіву, діб": "video_archive_days",
  "Час збереження архіву фіксацій, діб": "fixations_archive_days",
  "Вид камери за формою та конструкцією": "camera_form_factor",
  "Функціонал камери/тип ліцензії": "license_type",
  "Об'єкт аналітики": "analytics_object",
  "Додатковий опис функціоналу (заповнюється, якщо відсутній у попередньому)": "functionality_desc",
  "Виробник камери": "manufacturer",
  "Найменування власника": "owner_name",
  "Код ЄДРПОУ": "owner_edrpou",
  "Адреса реєстрації": "owner_reg_address",
  "Контактна особа": "contact_person",
  "Контактний номер телефону у форматі 38(0ХХ)-ХХХ-ХХ-ХХ": "contact_phone",
  "Стан камери": "camera_status",
  "Стан інтеграції камери": "integration_status",
  "Системи до яких інтегрована": "integrated_systems",
  "Інтегрована в Інтеграційну платформу НПУ": "integrated_npu_platform",
  "Інтегровано в Гарпун": "integrated_harpun",
  "Наявність доступу КА": "ka_access",
  "Координата широти": "lat",
  "Координата довготи": "lon",
  "Належність до об'єкту": "object_affiliation",
  "Вид об'єкту": "object_type",
  "Напрям огляду (азимут)": "azimuth",
  "Район": "raion",
  "Територіальна громада": "hromada",
  "КАТОТТГ": "katottg",
  "Тип населеного пункту": "settlement_type",
  "Назва населеного пункту": "settlement_name",
  "Тип вулиці": "street_type",
  "Назва": "street_name",
  "Номер будинку": "building_number",
  "Перерестя з": "cross_street",
  "Номер траси": "highway_number",
  "Кілометр": "kilometer",
};

const NUM_FIELDS = new Set([
  "video_archive_days",
  "fixations_archive_days",
  "lat",
  "lon",
  "azimuth",
  "kilometer",
]);

function cleanHeader(h) {
  return String(h || '')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumberMaybe(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row) {
  const out = {};
  for (const optingKey of Object.keys(row)) {
    const keyClean = cleanHeader(optingKey);
    const dbKey = HEADER_TO_DB[keyClean];
    if (!dbKey) continue;

    const rawVal = row[optingKey];
    if (NUM_FIELDS.has(dbKey)) {
      out[dbKey] = parseNumberMaybe(rawVal);
    } else {
      const s = rawVal === null || rawVal === undefined ? null : String(rawVal).trim();
      out[dbKey] = s === '' ? null : s;
    }
  }

  if (!out.camera_id) return null;
  out.updated_at = new Date().toISOString();
  return out;
}

function makeUpsert(db) {
  const cols = [
    "camera_id",
    "oblast","camera_name","install_date",
    "video_signal_type","storage_type","video_archive_days","fixations_archive_days",
    "camera_form_factor","license_type","analytics_object","functionality_desc",
    "manufacturer","owner_name","owner_edrpou","owner_reg_address",
    "contact_person","contact_phone",
    "camera_status","integration_status","integrated_systems","integrated_npu_platform","integrated_harpun","ka_access",
    "lat","lon",
    "object_affiliation","object_type","azimuth",
    "raion","hromada","katottg",
    "settlement_type","settlement_name","street_type","street_name","building_number","cross_street",
    "highway_number","kilometer",
    "updated_at",
  ];

  const placeholders = cols.map(c => `@${c}`).join(',');
  const updates = cols
    .filter(c => c !== 'camera_id')
    .map(c => `${c}=excluded.${c}`)
    .join(',');

  const sql = `
    INSERT INTO cameras (${cols.join(',')})
    VALUES (${placeholders})
    ON CONFLICT(camera_id) DO UPDATE SET ${updates}
  `;
  return db.prepare(sql);
}

export function importRowsToDb(db, rows) {
  const upsert = makeUpsert(db);

  const tx = db.transaction((items) => {
    let ok = 0;
    for (const r of items) {
      const norm = normalizeRow(r);
      if (!norm) continue;
      upsert.run(norm);
      ok++;
    }
    return ok;
  });

  return tx(rows || []);
}
