// js/parser/fileHandler.js

import { parseCSV } from './csvParser.js';
import { parseXLSX } from './xlsxParser.js';
import { normalizeData } from '../utils/dataNormalizer.js';

async function processAndNormalize(file, parser, headerRow) {
    try {
        const { data, headers } = await parser(file, headerRow);
        
        if (!Array.isArray(headers)) {
            throw new Error('Парсер повернув некоректний формат заголовків.');
        }

        const normalizedPoints = normalizeData(data, headers);
        return { normalizedPoints };
    } catch (error) {
        throw new Error(`Помилка нормалізації даних файлу "${file.name}": ${error.message}`);
    }
}

export async function handleFileLoad(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    let parser;

    switch (extension) {
        case 'csv':
            parser = parseCSV;
            break;
        case 'xlsx':
        case 'xls':
            parser = parseXLSX;
            break;
        default:
            throw new Error(`Непідтримуваний формат файлу: .${extension}`);
    }
    
    // Спроба 1: припустити, що заголовок у першому рядку (індекс 0)
    try {
        console.log(`fileHandler: Спроба 1 (рядок 0) для "${file.name}"...`);
        return await processAndNormalize(file, parser, 0);
    } catch (error) {
        // --- ЗМІНА ТУТ ---
        const secondAttemptHeaderRow = 5; // Пробуємо 6-й рядок (індекс 5)
        console.warn(`fileHandler: Спроба 1 (рядок 0) для "${file.name}" не вдалася. Спроба 2: Рядок заголовків - ${secondAttemptHeaderRow}...`);
        
        try {
            const result = await processAndNormalize(file, parser, secondAttemptHeaderRow);
            console.log(`fileHandler: Нормалізовано ${result.normalizedPoints.length} точок для файлу "${file.name}" (Рядок заголовків: ${secondAttemptHeaderRow}).`);
            return result;
        } catch (finalError) {
            console.error(`fileHandler: Остаточна помилка для "${file.name}":`, finalError);
            throw finalError;
        }
    }
}