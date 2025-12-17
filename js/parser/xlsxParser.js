// js/parser/xlsxParser.js

export function parseXLSX(file, headerRow = 0) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Конвертуємо аркуш у масив масивів, щоб отримати доступ до конкретного рядка заголовків
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (rows.length <= headerRow) {
                    throw new Error(`Рядок заголовків #${headerRow} не знайдено у файлі.`);
                }

                // Витягуємо заголовки та дані
                const headers = rows[headerRow].map(String); // Гарантуємо, що заголовки - це рядки
                const dataRows = rows.slice(headerRow + 1);

                // Перетворюємо масиви даних на об'єкти з ключами із заголовків
                const jsonData = dataRows.map(rowArray => {
                    const rowObj = {};
                    headers.forEach((header, index) => {
                        rowObj[header] = rowArray[index];
                    });
                    return rowObj;
                });

                resolve({ data: jsonData, headers });
            } catch (error) {
                reject(new Error(`Помилка парсингу XLSX: ${error.message}`));
            }
        };
        reader.onerror = (e) => reject(new Error('Не вдалося прочитати файл.'));
        reader.readAsArrayBuffer(file);
    });
}