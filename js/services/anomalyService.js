// js/services/anomalyService.js

export const anomalyService = {
    calculate(route, thresholds) {
        const points = route.normalizedPoints;
        const legs = route.osrmLegs || [];

        // 1. Очищаємо старі дані перед перерахунком
        points.forEach(p => {
            delete p.anomalyLevel;
            delete p.segmentDuration;
            delete p.expectedDuration;
        });

        // legs[i] відповідає сегменту від points[i] до points[i+1]
        let legIndex = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const startPoint = points[i];
            const endPoint = points[i + 1];

            // А. Фактичний час (різниця timestamps)
            const t1 = new Date(startPoint.timestamp).getTime();
            const t2 = new Date(endPoint.timestamp).getTime();
            
            // Час у секундах
            const factDurationSec = (t2 - t1) / 1000;
            
            // ЗАПИСУЄМО В КОРІНЬ ОБ'ЄКТА (саме це поле шукає таблиця!)
            endPoint.segmentDuration = Math.round(factDurationSec);

            // Б. Еталонний час (OSRM)
            if (legs && legs[legIndex]) {
                const osrmDurationSec = legs[legIndex].duration;
                
                // ЗАПИСУЄМО В КОРІНЬ ОБ'ЄКТА
                endPoint.expectedDuration = Math.round(osrmDurationSec);

                // В. Перевірка аномалій (Тільки якщо є обидва значення)
                if (osrmDurationSec > 0) {
                    // Різниця в хвилинах
                    const diffMin = (factDurationSec - osrmDurationSec) / 60;

                    // Пороги (використовуємо timeWarning/timeDanger)
                    const limitWarn = thresholds.timeWarning !== undefined ? thresholds.timeWarning : 40;
                    const limitDanger = thresholds.timeDanger !== undefined ? thresholds.timeDanger : 120;

                    let level = null;
                    if (diffMin >= limitDanger) {
                        level = 'high';   // Червоний
                    } else if (diffMin >= limitWarn) {
                        level = 'medium'; // Жовтий
                    }

                    if (level) {
                        endPoint.anomalyLevel = level;
                    }
                }
                legIndex++;
            }
        }
    }
};