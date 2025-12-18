// js/services/anomalyService.js

export const anomalyService = {
    calculate(route, thresholds) {
        const points = route.normalizedPoints;
        const legs = route.osrmLegs || [];

        // Очищаємо старі дані
        points.forEach(p => {
            delete p.anomalyLevel;
            delete p.timingInfo;
        });

        // Якщо немає даних від OSRM, ми не можемо рахувати аномалії
        if (!legs || legs.length === 0) return;

        // legs[i] відповідає сегменту від points[i] до points[i+1]
        // Але оскільки ми могли запитувати маршрут чанками, потрібно бути обережним з індексами.
        // Для спрощення припускаємо, що points і legs синхронізовані (1 до 1, окрім останньої точки).
        
        let legIndex = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const startPoint = points[i];
            const endPoint = points[i + 1];

            // Фактичний час
            const t1 = new Date(startPoint.timestamp).getTime();
            const t2 = new Date(endPoint.timestamp).getTime();
            const factDurationSec = (t2 - t1) / 1000;

            // Еталонний час (OSRM)
            const osrmLeg = legs[legIndex];
            // Якщо масиви розсинхронізовані (наприклад через чанки), це проста евристика.
            // В ідеалі треба склеювати legs при запиті.
            
            if (osrmLeg) {
                const osrmDurationSec = osrmLeg.duration;

                if (osrmDurationSec > 0 && factDurationSec > 0) {
                    const diffPercent = ((factDurationSec - osrmDurationSec) / osrmDurationSec) * 100;
                    
                    let status = 'normal';
                    if (diffPercent >= thresholds.danger) status = 'high';
                    else if (diffPercent >= thresholds.warning) status = 'medium';

                    endPoint.anomalyLevel = status === 'normal' ? null : status;
                    
                    endPoint.timingInfo = {
                        expected: Math.round(osrmDurationSec),
                        actual: Math.round(factDurationSec),
                        diff: Math.round(factDurationSec - osrmDurationSec),
                        percent: Math.round(diffPercent)
                    };
                }
                legIndex++;
            }
        }
    }
};