// server/services/importCsvToSqlite.js
import fs from 'fs';
import csv from 'csv-parser';
import Database from 'better-sqlite3';
import path from 'path';

// Визначаємо шлях до БД
const DB_PATH = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH) 
  : path.resolve('server/db/ksv.sqlite');

// Співставлення заголовків CSV -> колонки БД
const HEADER_TO_DB = {
  "Камера_ID": "camera_id",
  "Назва камери у системі": "camera_name",
  "Область": "oblast",
  "Район": "raion",
  "Територіальна громада": "hromada",
  "КАТОТТГ": "katottg",
  
  // Адреса
  "Тип населеного пункту": "settlement_type",
  "Назва населеного пункту": "settlement_name",
  "Тип вулиці": "street_type",
  "Назва": "street_name", 
  "Номер будинку": "building_number", // ✅ Виправлено (було house_number)
  "Перерестя з": "cross_street",
  "Номер траси": "highway_number",
  "Кілометр": "kilometer",

  // Координати
  "Координата широти": "lat",
  "Координата довготи": "lon",
  "Напрям огляду (азимут)": "azimuth", // ✅ Виправлено (було view_direction)

  // Власник та контакти
  "Найменування власника": "owner_name",
  "Код ЄДРПОУ": "owner_edrpou",
  "Адреса реєстрації": "owner_reg_address",
  "Контактна особа": "contact_person",
  "Контактний номер телефону у форматі 38(0ХХ)-ХХХ-ХХ-ХХ": "contact_phone",
  
  // Технічні параметри
  "Дата встановлення камери": "install_date",
  "Тип камери за форматом відеосигналу": "video_signal_type",
  "Тип камери за збереженням інформації": "storage_type",
  "Час збереження відеоархіву, діб": "video_archive_days",
  "Час збереження архіву фіксацій, діб": "fixations_archive_days",
  "Вид камери за формою та конструкцією": "camera_form_factor",
  "Виробник камери": "manufacturer",

  // Фільтри та статус
  "Стан камери": "camera_status",
  "Стан інтеграції камери": "integration_status",
  "Функціонал камери/тип ліцензії": "license_type",
  "Об'єкт аналітики": "analytics_object",
  "Додатковий опис функціоналу (заповнюється, якщо відсутній у попередньому)": "functionality_desc",
  
  // Інтеграція та доступ
  "Наявність доступу КА": "ka_access",
  "Системи до яких інтегрована": "integrated_systems",
  "Інтегрована в Інтеграційну платформу НПУ": "integrated_npu_platform",
  "Інтегровано в Гарпун": "integrated_harpun",
  
  // Об'єкт
  "Вид об'єкту": "object_type",
  "Належність до об'єкту": "object_affiliation"
};

function cleanHeader(h) {
  return String(h || '')
    .replace(/^\uFEFF/, '') 
    .replace(/[\r\n]+/g, ' ') 
    .replace(/\s+/g, ' ') 
    .trim();
}

function cleanValue(v) {
  const s = String(v || '').trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s;
}

export function importCsv(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    // Переконуємось, що папка для БД існує
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const db = new Database(DB_PATH);
    
    // Схема
    const schemaPath = path.resolve('server/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      db.exec(fs.readFileSync(schemaPath, 'utf8'));
    }

    const rows = [];
    let total = 0;

    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => cleanHeader(header)
      }))
      .on('data', (data) => {
        // Пропускаємо технічні рядки
        if (!data['Камера_ID'] || data['Камера_ID'].includes('Cамостійно_колонку')) return;

        const row = {};
        for (const [csvHeader, dbCol] of Object.entries(HEADER_TO_DB)) {
          if (csvHeader in data) {
            row[dbCol] = cleanValue(data[csvHeader]);
          }
        }

        // Парсинг чисел
        if (row.lat) row.lat = parseFloat(row.lat.replace(',', '.'));
        if (row.lon) row.lon = parseFloat(row.lon.replace(',', '.'));
        if (row.azimuth) row.azimuth = parseFloat(row.azimuth.replace(',', '.'));
        if (row.kilometer) row.kilometer = parseFloat(row.kilometer.replace(',', '.'));
        if (row.video_archive_days) row.video_archive_days = parseInt(row.video_archive_days, 10);
        if (row.fixations_archive_days) row.fixations_archive_days = parseInt(row.fixations_archive_days, 10);

        row.updated_at = new Date().toISOString();

        if (row.camera_id && !isNaN(row.lat) && !isNaN(row.lon)) {
          rows.push(row);
        }
        total++;
      })
      .on('end', () => {
        try {
          const insert = db.prepare(`
            INSERT OR REPLACE INTO cameras (
              camera_id, oblast, camera_name, install_date,
              video_signal_type, storage_type, video_archive_days, fixations_archive_days,
              camera_form_factor, license_type, analytics_object, functionality_desc,
              manufacturer, owner_name, owner_edrpou, owner_reg_address,
              contact_person, contact_phone, camera_status, integration_status,
              integrated_systems, integrated_npu_platform, integrated_harpun, ka_access,
              lat, lon, object_affiliation, object_type, azimuth,
              raion, hromada, katottg, settlement_type, settlement_name,
              street_type, street_name, building_number, cross_street,
              highway_number, kilometer, updated_at
            ) VALUES (
              @camera_id, @oblast, @camera_name, @install_date,
              @video_signal_type, @storage_type, @video_archive_days, @fixations_archive_days,
              @camera_form_factor, @license_type, @analytics_object, @functionality_desc,
              @manufacturer, @owner_name, @owner_edrpou, @owner_reg_address,
              @contact_person, @contact_phone, @camera_status, @integration_status,
              @integrated_systems, @integrated_npu_platform, @integrated_harpun, @ka_access,
              @lat, @lon, @object_affiliation, @object_type, @azimuth,
              @raion, @hromada, @katottg, @settlement_type, @settlement_name,
              @street_type, @street_name, @building_number, @cross_street,
              @highway_number, @kilometer, @updated_at
            )
          `);

          const insertMany = db.transaction((items) => {
            for (const item of items) insert.run(item);
          });

          insertMany(rows);
          console.log(`[Import] Imported ${rows.length} cameras into ${DB_PATH} (total CSV rows processed: ${total})`);
          db.close();
          resolve({ count: rows.length });
        } catch (e) {
          db.close();
          reject(e);
        }
      })
      .on('error', reject);
  });
}

// CLI run
if (process.argv[1] === import.meta.filename || process.argv[1].endsWith('importCsvToSqlite.js')) {
  const file = process.argv[2];
  if (file) {
    importCsv(file).catch(err => {
      console.error(err);
      process.exit(1);
    });
  } else {
    console.log('Usage: node server/services/importCsvToSqlite.js <path-to-csv>');
  }
}