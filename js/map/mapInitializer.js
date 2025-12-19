// js/map/mapInitializer.js
import { setupLayerControls } from './mapLayers.js';

let currentMapInstance = null;

export function initializeMap() {
    if (currentMapInstance) {
        return currentMapInstance;
    }

    currentMapInstance = L.map('map', {
        zoomControl: false // Вимикаємо стандартний контроль
    }).setView([49.0, 31.0], 7); // Центр України

    // --- Варіанти дизайну карти ---

    // 1. Стандартна (OpenStreetMap)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
    });

    // 2. Світла тема (CartoDB Positron) - чиста, гарна для підкладок
    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    // 3. Темна тема (CartoDB Dark Matter) - ідеальна для яскравих маркерів
    const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    // 4. Супутник (Esri World Imagery)
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });

    // Встановлюємо шар за замовчуванням (наприклад, світлий, він виглядає сучасніше за OSM)
    cartoLight.addTo(currentMapInstance);

    // Формуємо перемикач
    const baseMaps = {
        "Світла (CartoDB)": cartoLight,
        "Темна (CartoDB)": cartoDark,
        "Супутник (Esri)": esriSatellite,
        "Стандартна (OSM)": osm
    };

    // Викликаємо функцію для налаштування контролю шарів
    setupLayerControls(currentMapInstance, baseMaps);
    
    // Додаємо контроль масштабу
    L.control.zoom({
        position: 'bottomright'
    }).addTo(currentMapInstance);

    console.log('Leaflet Map initialized.');
    return currentMapInstance;
}
