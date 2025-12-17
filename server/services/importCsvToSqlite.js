// server/services/importCsvToSqlite.js
import fs from 'fs';
import csv from 'csv-parser';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH) 
  : path.resolve('server/db/ksv.sqlite');

// Виправлений мапінг заголовків
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
  "Номер будинку": "building_number", // ✅ ВИПРАВЛЕНО: відповідає схемі БД
  "Перерестя з": "cross_street",
  "Номер траси": "highway_number",
  "Кілометр": "kilometer",

  // Координати
  "Координата широти": "lat",
  "Координата довготи": "lon",
  "Напрям огляду (азимут)": "azimuth", // ✅ ВИПРАВЛЕНО: відповідає схемі БД

  // Власник
  "Найменування власника": "owner_name",
  "Код ЄДРПОУ": "owner_edrpou",
  "Адреса реєстрації": "owner_reg_address",
  "Контактна особа": "contact_person",
  "Контактний номер телефону у форматі 38(0ХХ)-ХХХ-ХХ-ХХ": "contact_phone",
  
  // Технічні
  "Дата встановлення камери": "install_date",
  "Тип камери за форматом відеосигналу": "video_signal_type",
  "Тип камери за збереженням інформації": "storage_type",
  "Час збереження відеоархіву, діб": "video_archive_days",
  "Час збереження архіву фіксацій, діб": "fixations_archive_days",
  "Вид камери за формою та конструкцією": "camera_form_factor",
  "Виробник камери": "manufacturer",

  // Статуси та фільтри
  "Стан камери": "camera_status",
  "Стан інтеграції камери": "integration_status",
  "Функціонал камери/тип ліцензії": "license_type", // Важливо: перевірте точну назву в CSV (з пробілами чи без)
  "Функціонал камери/тип ліцензії \n": "license_type", // Варіант з переносом рядка
  "Об'єкт аналітики": "analytics_object",
  "Додатковий опис функціоналу (заповнюється, якщо відсутній у попередньому)": "functionality_desc",
  
  // Інтеграція
  "Наявність доступу КА": "ka_access",
  "Системи до яких інтегрована": "integrated_systems",
  "Інтегрована в Інтеграційну платформу НПУ": "integrated_npu_platform",
  "Інтегровано в Гарпун": "integrated_harpun",
  
  // Об'єкт
  "Вид об'єкту": "object_type",
  "Належність до об'єкту": "object_affiliation"
};

function cleanHeader(h) {
  // Очищення від BOM та зайвих символів
  return String(h || '')
    .replace(/^\uFEFF/, '') 
    .replace(/[\r\n]+/g, '') // Видаляємо переноси рядків всередині заголовка
    .trim();
}

function cleanValue(v) {
  const s = String(v || '').trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s;
}

export function importCsv(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return reject(new Error(`File not found: ${filePath}`));

    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const db = new Database(DB_PATH);
    const schemaPath = path.resolve('server/db/schema.sql');
    if (fs.existsSync(schemaPath)) db.exec(fs.readFileSync(schemaPath, 'utf8'));

    const rows = [];
    let total = 0;

    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => cleanHeader(header)
      }))
      .on('data', (data) => {
        // Пропускаємо сміттєві рядки
        if (!data['Камера_ID'] || data['Камера_ID'].includes('Cамостійно_колонку')) return;

        const row = {};
        for (const [csvHeader, dbCol] of Object.entries(HEADER_TO_DB)) {
            // Шукаємо заголовок (exact match після cleanHeader)
            if (data[csvHeader] !== undefined) {
                row[dbCol] = cleanValue(data[csvHeader]);
            }
        }

        // Додаткова логіка для License Type, якщо заголовок специфічний
        // (csv-parser іноді лишає сміття, якщо cleanHeader не спрацював ідеально)
        const rawLicense = data['Функціонал камери/тип ліцензії'] || data['Функціонал камери/тип ліцензії \n'];
        if (rawLicense && !row.license_type) row.license_type = cleanValue(rawLicense);

        if (row.lat) row.lat = parseFloat(row.lat.replace(',', '.'));
        if (row.lon) row.lon = parseFloat(row.lon.replace(',', '.'));
        
        row.updated_at = new Date().toISOString();

        if (row.camera_id && !isNaN(row.lat) && !isNaN(row.lon)) {
          rows.push(row);
        }
        total++;
      })
      .on('end', () => {
        try {
          // Динамічно формуємо SQL, щоб не помилитися з полями
          if (rows.length === 0) {
              console.warn("No valid rows found to insert!");
              db.close();
              return resolve({ count: 0 });
          }
          
          const sample = rows[0];
          const cols = Object.keys(sample);
          const placeholders = cols.map(c => `@${c}`).join(', ');
          const updateStr = cols.map(c => `${c}=excluded.${c}`).join(', ');

          const stmt = db.prepare(`
            INSERT INTO cameras (${cols.join(', ')}) 
            VALUES (${placeholders})
            ON CONFLICT(camera_id) DO UPDATE SET ${updateStr}
          `);

          const insertMany = db.transaction((items) => {
            for (const item of items) stmt.run(item);
          });

          insertMany(rows);
          console.log(`[Import] Successfully imported ${rows.length} cameras. Total CSV rows: ${total}`);
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

// CLI
if (process.argv[1] === import.meta.filename || process.argv[1].endsWith('importCsvToSqlite.js')) {
  const file = process.argv[2];
  if (file) {
    importCsv(file).catch(err => { console.error(err); process.exit(1); });
  } else {
    console.log('Usage: node server/services/importCsvToSqlite.js <path-to-csv>');
  }
}