// js/utils/dataNormalizer.js

const LATITUDE_KEYS = [
    'lat', 'latitude', 'широта', 'широта (lat)', 'lat.', 'latitude, dd', 'y',
    'vehicle latitude'
];
const LONGITUDE_KEYS = [
    'lon', 'lng', 'longitude', 'довгота', 'довгота (lng)', 'long.', 'longitude, dd', 'x',
    'vehicle longitude'
];
const TIMESTAMP_KEYS = [
    'timestamp', 'time', 'datetime', 'час фіксації', 'date time', 'pass time', 'час',
    'час отримання', // <-- ДОДАНО для файлів "Passing Vehicle Search"
    'дата та час'    // <-- ДОДАНО для файлів "Шулявка-БЦ"
];

/**
 * Розбирає дату з кастомного формату 'ДД.ММ.РРРР ГГ:хх:сс'.
 * @param {string} dateString - Рядок з датою.
 * @returns {Date|null} - Об'єкт Date або null, якщо розбір не вдався.
 */
function parseCustomDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return null;
    }
    
    // ОНОВЛЕНО: Прибираємо " о " для підтримки формату 'ДД.ММ.РРРР о ГГ:хх:сс'
    const cleanDateString = dateString.replace(' о ', ' ').trim();
    
    // Розділяємо на дату і час
    const parts = cleanDateString.split(' ');
    if (parts.length < 2) return null;

    const datePart = parts[0];
    const timePart = parts[1];

    // Розділяємо дату на день, місяць, рік
    const dateSegments = datePart.split('.');
    if (dateSegments.length < 3) return null;

    const [day, month, year] = dateSegments;

    // Складаємо у формат ISO (YYYY-MM-DDTHH:mm:ss), який JavaScript розуміє надійно
    const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${timePart}`;
    
    const date = new Date(isoString);
    // Перевіряємо, чи дата валідна
    return isNaN(date.getTime()) ? null : date;
}


/**
 * Знаходить ключ для певного типу даних (широта, довгота, час) у списку заголовків.
 */
function findKey(headers, keyList) {
    for (const header of headers) {
        if (keyList.includes(header.toLowerCase().trim())) {
            return header;
        }
    }
    return null;
}

/**
 * Нормалізує дані з різних форматів файлів до єдиної структури.
 */
export function normalizeData(data, headers) {
    console.log('normalizeData: Заголовки, отримані від парсера:', headers);
    const latKey = findKey(headers, LATITUDE_KEYS);
    const lonKey = findKey(headers, LONGITUDE_KEYS);
    const timeKey = findKey(headers, TIMESTAMP_KEYS);

    console.log(`normalizeData: Знайдено широту за ключем: ${latKey}`);
    console.log(`normalizeData: Знайдено довготу за ключем: ${lonKey}`);
    console.log(`normalizeData: Знайдено час за ключем: ${timeKey}`);
    
    if (!latKey || !lonKey || !timeKey) {
        throw new Error('Не вдалося знайти необхідні колонки (широта, довгота, час).');
    }

    const normalizedPoints = [];
    data.forEach(row => {
        // Додаємо .trim() до значень, щоб прибрати зайві пробіли або символи переносу рядка
        const lat = parseFloat(String(row[latKey]).replace(',', '.').trim());
        const lon = parseFloat(String(row[lonKey]).replace(',', '.').trim());
        const timeValue = String(row[timeKey]).trim();
        
        let date;

        // 1. Спочатку пробуємо розпізнати кастомний формат 'ДД.ММ.РРРР ГГ:хх:сс'
        date = parseCustomDate(timeValue);

        // 2. Якщо не вийшло, пробуємо інші стандартні методи
        if (!date || isNaN(date.getTime())) {
            if (typeof timeValue === 'number' || !isNaN(Number(timeValue))) {
                // 2а. Схоже на Excel дату (кількість днів з 1900 року)
                date = new Date((Number(timeValue) - 25569) * 86400 * 1000);
            } else {
                // 2б. Остання спроба - стандартний парсер JavaScript
                date = new Date(timeValue);
            }
        }
        
        // Перевіряємо, чи всі дані валідні
        if (!isNaN(lat) && !isNaN(lon) && date && !isNaN(date.getTime())) {
            normalizedPoints.push({
                latitude: lat,
                longitude: lon,
                timestamp: date.toISOString(),
                originalData: row,
            });
        }
    });
    
    if (normalizedPoints.length === 0 && data.length > 0) {
        throw new Error('Не вдалося нормалізувати жодної точки. Перевірте формат даних.');
    }
    
    console.log(`normalizeData: Повернуто ${normalizedPoints.length} дійсних точок.`);
    return normalizedPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}