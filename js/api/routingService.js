// js/api/routingService.js

const osrmBaseUrl = 'https://router.project-osrm.org';

export async function getRouteData(latLngs, vehicleType = 'car') {
    if (!latLngs || !Array.isArray(latLngs) || latLngs.length < 2) {
        return { coordinates: [], legs: [] };
    }

    if (vehicleType === 'train') {
        // Для поїзда OSRM не працює, повертаємо фіктивні дані
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
        // Додаємо annotations=duration, щоб отримати час
        const url = `${osrmBaseUrl}/route/v1/${vehicleType}/${coordsString}?overview=full&geometries=geojson&steps=true`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`OSRM Error ${response.status}`);
                // Fallback: повертаємо вхідні дані без сегментів
                return { coordinates: latLngs, legs: [] };
            }
            
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                
                // Координати для малювання лінії
                const routeCoords = route.geometry.coordinates.map(p => [p[1], p[0]]);
                allCoordinates.push(...routeCoords);
                
                // Сегменти (тривалість між точками)
                if (route.legs) {
                    allLegs.push(...route.legs);
                }

                lastPoint = chunk[chunk.length - 1];
            } else {
                // Fallback
                allCoordinates.push(...chunk);
            }
        } catch (error) {
            console.error('Помилка OSRM:', error);
            return { coordinates: latLngs, legs: [] };
        }
    }

    return { coordinates: allCoordinates, legs: allLegs };
}