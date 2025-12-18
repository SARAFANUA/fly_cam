// js/services/anomalyService.js

export const anomalyService = {
    /**
     * Розраховує аномалії для маршруту
     * @param {Object} route - Об'єкт маршруту
     * @param {Object} thresholds - { warning: 20, danger: 100 }
     */
    calculate(route, thresholds) {
        const points = route.normalizedPoints;
        const legs = route.osrmLegs || []; // Отримуємо збережені леги OSRM

        // Якщо немає даних від OSRM або вони не збігаються з кількістю сегментів
        // (legs.length має бути points.length - 1)
        if (!legs || legs.length === 0) {
            console.warn('AnomalyService: Немає даних OSRM для розрахунку.');
            return;
        }

        // Очищаємо попередні статуси
        points.forEach(p => {
            delete p.anomalyLevel;
            delete p.timingInfo;
        });

        for (let i = 0; i < points.length - 1; i++) {
            const startPoint = points[i];
            const endPoint = points[i + 1];

            // 1. Фактичний час (різниця timestamp)
            const t1 = new Date(startPoint.timestamp).getTime();
            const t2 = new Date(endPoint.timestamp).getTime();
            const factDurationSec = (t2 - t1) / 1000;

            // 2. Еталонний час (OSRM duration)
            // Важливо: OSRM повертає леги по порядку. legs[i] відповідає сегменту Point[i] -> Point[i+1]
            // Але якщо OSRM будував маршрут чанками, масиви можуть мати розбіжності, якщо точки не лягли ідеально.
            // Для спрощення беремо за індексом, якщо масиви синхронні.
            const osrmLeg = legs[i];
            const osrmDurationSec = osrmLeg ? osrmLeg.duration : 0;

            if (osrmDurationSec > 0 && factDurationSec > 0) {
                // 3. Розрахунок відхилення у %
                // (Fact - OSRM) / OSRM * 100
                const diffPercent = ((factDurationSec - osrmDurationSec) / osrmDurationSec) * 100;

                let status = 'normal';
                if (diffPercent >= thresholds.danger) status = 'high';     // Червоний
                else if (diffPercent >= thresholds.warning) status = 'medium'; // Жовтий

                // Записуємо дані у КІНЦЕВУ точку сегмента (вона показує, як ми до неї їхали)
                endPoint.anomalyLevel = status === 'normal' ? null : status;
                
                endPoint.timingInfo = {
                    expected: Math.round(osrmDurationSec),
                    actual: Math.round(factDurationSec),
                    diff: Math.round(factDurationSec - osrmDurationSec),
                    percent: Math.round(diffPercent)
                };
            }
        }
    }
};