// js/parser/zipParser.js

import { parseXlsx } from './xlsxParser.js';

/**
 * Парсить ZIP-архів, знаходить XLSX/XLS файл та зображення.
 * @param {File} file - ZIP-файл для парсингу.
 * @returns {Promise<{parsedData: Array<Object>, imageMap: Map<string, string>}>}
 */
export async function parseZip(file) {
    const zip = await JSZip.loadAsync(file);
    const imageMap = new Map();
    let xlsxBuffer = null;

    const filePromises = [];

    zip.forEach((relativePath, zipEntry) => {
        const lowerCasePath = relativePath.toLowerCase();

        // Шукаємо XLSX або XLS файл
        if ((lowerCasePath.endsWith('.xlsx') || lowerCasePath.endsWith('.xls')) && !zipEntry.dir) {
            filePromises.push(
                zipEntry.async('arraybuffer').then(buffer => {
                    xlsxBuffer = buffer;
                })
            );
        }
        // Шукаємо зображення
        else if (/\.(jpg|jpeg|png|gif|bmp)$/i.test(lowerCasePath) && !zipEntry.dir) {
            filePromises.push(
                zipEntry.async('blob').then(blob => {
                    const imageUrl = URL.createObjectURL(blob);
                    imageMap.set(zipEntry.name.split('/').pop(), imageUrl); // Ключ - тільки ім'я файлу
                })
            );
        }
    });

    await Promise.all(filePromises);

    if (!xlsxBuffer) {
        throw new Error('У ZIP-архіві не знайдено XLSX або XLS файл.');
    }

    const parsedData = parseXlsx(xlsxBuffer, 6); // Припускаємо, що заголовок на 6-му рядку

    return { parsedData, imageMap };
}