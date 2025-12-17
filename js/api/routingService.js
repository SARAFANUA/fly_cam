// js/api/routingService.js

// --- ЗМІНЕНО ---
// URL змінено з локального сервера ('http://127.0.0.1:5000') на публічний демо-сервер OSRM.
// Це дозволяє додатку працювати без необхідності запускати локальний екземпляр OSRM.
const osrmBaseUrl = 'https://router.project-osrm.org';

/**
 * Отримує геометрію маршруту від OSRM для заданого набору координат.
 * @param {Array<[number, number]>} latLngs - Масив координат [широта, довгота].
 * @param {string} vehicleType - Тип транспорту ('car', 'truck', 'foot', 'train').
 * @returns {Promise<Array<[number, number]>>} - Проміс, що повертає масив координат для полілінії.
 */
export async function getRoute(latLngs, vehicleType = 'car') {
    if (!latLngs || latLngs.length < 2) {
        return [];
    }

    // --- Крок 3: Обробка нових типів маршрутів ---
    // Для залізниці повертаємо прямі лінії, оскільки OSRM не підтримує цей тип.
    // Це призведе до того, що на карті точки будуть з'єднані напряму.
    if (vehicleType === 'train') {
        console.log('Routing service: Використовуються прямі лінії для типу "залізниця".');
        return latLngs;
    }

    // OSRM має обмеження на кількість координат у запиті, тому розбиваємо довгі маршрути
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < latLngs.length; i += CHUNK_SIZE) {
        chunks.push(latLngs.slice(i, i + CHUNK_SIZE));
    }

    const allRoutePoints = [];
    let lastPoint = null;

    for (const chunk of chunks) {
        if (lastPoint) {
            chunk.unshift(lastPoint); // Додаємо останню точку попереднього чанку для з'єднання
        }

        const coordsString = chunk.map(p => `${p[1]},${p[0]}`).join(';');

        // Використовуємо відповідний профіль OSRM ('car', 'truck', 'foot')
        const url = `${osrmBaseUrl}/route/v1/${vehicleType}/${coordsString}?overview=full&geometries=geojson`;

        try {
            console.log('OSRM Request URL:', url);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Помилка OSRM: ${response.statusText}`);
            }
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const routePoints = data.routes[0].geometry.coordinates.map(p => [p[1], p[0]]); // OSRM повертає [lng, lat]
                allRoutePoints.push(...routePoints);
                lastPoint = chunk[chunk.length - 1]; // Зберігаємо останню точку
            } else {
                console.warn('OSRM: Маршрут не знайдено для одного з чанків.');
            }
        } catch (error) {
            console.error('Помилка запиту до OSRM:', error);
            // У разі помилки просто з'єднуємо точки напряму
            return latLngs;
        }
    }

    console.log(`OSRM: Знайдено маршрут з ${allRoutePoints.length} точок.`);
    return allRoutePoints;
}