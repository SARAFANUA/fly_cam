// js/api/routingService.js

// OSRM Public Demo Server (має обмеження, для продакшену варто підняти свій)
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

export async function getRoute(coordinates, vehicleType = 'car') {
    if (!coordinates || coordinates.length < 2) return [];

    // OSRM ліміт ~100 точок на GET запит. 
    // Для великих маршрутів тут потрібна логіка розбиття (chunks), 
    // але для базової реалізації поки спростимо.
    
    // Формуємо рядок координат: lon,lat;lon,lat
    const coordsString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');

    try {
        // annotations=duration поверне час для кожного сегмента
        // overview=full поверне повну геометрію
        const url = `${OSRM_BASE_URL}/${coordsString}?overview=full&geometries=geojson&annotations=duration`;
        
        console.log(`OSRM Request (${coordinates.length} pts)`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`OSRM Error: ${response.statusText}`);
        
        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) return [];

        const route = data.routes[0];

        // Повертаємо об'єкт з геометрією ТА даними про сегменти
        return {
            geometry: route.geometry.coordinates.map(c => [c[1], c[0]]), // GeoJSON [lon, lat] -> Leaflet [lat, lon]
            legs: route.legs || [], // Масив сегментів між нашими точками
            duration: route.duration, // Загальний час (сек)
            distance: route.distance  // Загальна відстань (метри)
        };

    } catch (error) {
        console.warn("OSRM Failed, falling back to straight lines:", error);
        // Фолбек: повертаємо просто прямі лінії між точками
        return {
            geometry: coordinates,
            legs: [],
            duration: 0,
            distance: 0
        };
    }
}