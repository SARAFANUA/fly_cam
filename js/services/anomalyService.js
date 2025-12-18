// js/services/anomalyService.js

export const anomalyService = {
    // Налаштування за замовчуванням
    defaultSettings: {
        warningThreshold: 1.2, // +20% часу -> Жовтий
        dangerThreshold: 2.0   // +100% часу (в 2 рази довше) -> Червоний
        // Або можна використовувати абсолютні значення (наприклад, > 10 хв затримки)
    },

    /**
     * Аналізує маршрут та розраховує аномалії
     * @param {Array} points - масив точок з timestamp
     * @param {Array} osrmLegs - масив сегментів від OSRM (route.legs)
     * @param {Object} settings - порогові значення
     */
    analyzeRoute(points, osrmLegs, settings = {}) {
        const config = { ...this.defaultSettings, ...settings };
        
        // Якщо OSRM не повернув legs або їх кількість не співпадає з відрізками (N точок = N-1 відрізків)
        if (!osrmLegs || osrmLegs.length === 0 || osrmLegs.length !== points.length - 1) {
            console.warn("AnomalyService: Кількість сегментів OSRM не співпадає з точками. Аналіз неможливий.");
            return points.map(p => ({ ...p, anomalyLevel: null, delayDetails: null }));
        }

        return points.map((point, index) => {
            // Для останньої точки аномалії немає (вона фінішна)
            if (index === points.length - 1) {
                return { ...point, anomalyLevel: null };
            }

            const nextPoint = points[index + 1];
            const leg = osrmLegs[index]; // Відрізок від поточної до наступної

            // 1. Фактичний час (різниця timestamp)
            const factTimeMs = new Date(nextPoint.timestamp).getTime() - new Date(point.timestamp).getTime();
            const factSeconds = factTimeMs / 1000;

            // 2. Еталонний час (OSRM duration)
            const expectedSeconds = leg.duration; // OSRM повертає секунди

            // Захист від ділення на нуль (якщо точки ідентичні)
            if (expectedSeconds < 1) {
                return { ...point, anomalyLevel: null };
            }

            // 3. Коефіцієнт
            const ratio = factSeconds / expectedSeconds;
            
            // Розрахунок затримки для відображення
            const delaySeconds = factSeconds - expectedSeconds;

            let level = null;
            if (ratio >= config.dangerThreshold) level = 'high';       // Червоний
            else if (ratio >= config.warningThreshold) level = 'medium'; // Жовтий

            // Додаємо дані про аналіз до точки
            return {
                ...point,
                anomalyLevel: level,
                analysis: {
                    expected: expectedSeconds,
                    fact: factSeconds,
                    ratio: ratio.toFixed(2),
                    delay: delaySeconds
                }
            };
        });
    },

    // Форматування тексту затримки для UI
    formatDelay(seconds) {
        if (!seconds || seconds <= 0) return '';
        const m = Math.floor(seconds / 60);
        if (m < 1) return '< 1 хв';
        const h = Math.floor(m / 60);
        const min = m % 60;
        
        if (h > 0) return `+${h} год ${min} хв`;
        return `+${min} хв`;
    }
};