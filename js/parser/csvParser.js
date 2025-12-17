// js/parser/csvParser.js

export function parseCSV(file, headerRow = 0) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false, // Ми самі визначимо заголовки
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const rows = results.data;
                    if (rows.length <= headerRow) {
                        throw new Error(`Рядок заголовків #${headerRow} не знайдено у файлі.`);
                    }

                    const headers = rows[headerRow].map(String);
                    const dataRows = rows.slice(headerRow + 1);

                    const jsonData = dataRows.map(rowArray => {
                        const rowObj = {};
                        headers.forEach((header, index) => {
                            rowObj[header] = rowArray[index];
                        });
                        return rowObj;
                    });

                    resolve({ data: jsonData, headers });
                } catch (error) {
                    reject(new Error(`Помилка обробки CSV: ${error.message}`));
                }
            },
            error: (error) => {
                reject(new Error(`Помилка парсингу CSV: ${error.message}`));
            }
        });
    });
}