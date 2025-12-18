// js/api/routingService.js

const osrmBaseUrl = 'https://router.project-osrm.org';

/**
 * Отримує розширені дані маршруту (координати + сегменти часу).
 * @returns {Promise<{coordinates: Array, legs: Array}>}
 */
export async function getRouteData(latLngs, vehicleType = 'car') {
    if (!latLngs || !Array.isArray(latLngs) || latLngs.length < 2) {
        return { coordinates: [], legs: [] };
    }

    if (vehicleType === 'train') {
        // Для залізниці OSRM не працює, повертаємо прямі лінії і порожні леги
        return { coordinates: latLngs, legs: [] };
    }

    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < latLngs.length; i += CHUNK_SIZE) {
        chunks.push(latLngs.slice(i, i + CHUNK_SIZE));
    }

    const allCoordinates = [];
    const allLegs = [];
    let lastPoint = null;

    for (const chunk of chunks) {
        if (lastPoint) {
            chunk.unshift(lastPoint);
        }

        const coordsString = chunk.map(p => `${p[1]},${p[0]}`).join(';');
        // Запитуємо steps=true або annotations=duration, щоб отримати час проїзду
        const url = `${osrmBaseUrl}/route/v1/${vehicleType}/${coordsString}?overview=full&geometries=geojson&steps=true`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`OSRM Error ${response.status}: повертаємо прямі лінії.`);
                // Fallback: повертаємо вхідні точки як координати
                return { coordinates: latLngs, legs: [] }; 
            }
            
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                
                // Координати (swap [lng, lat] -> [lat, lng])
                const routeCoords = route.geometry.coordinates.map(p => [p[1], p[0]]);
                allCoordinates.push(...routeCoords);
                
                // Сегменти (тривалість між точками)
                if (route.legs) {
                    allLegs.push(...route.legs);
                }

                lastPoint = chunk[chunk.length - 1];
            } else {
                console.warn('OSRM: Маршрут не знайдено, використовую прямі лінії.');
                allCoordinates.push(...chunk);
            }
        } catch (error) {
            console.error('Помилка запиту до OSRM:', error);
            return { coordinates: latLngs, legs: [] };
        }
    }

    return { coordinates: allCoordinates, legs: allLegs };
}