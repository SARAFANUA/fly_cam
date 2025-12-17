// js/map/mapInitializer.js
import { setupLayerControls } from './mapLayers.js';

let currentMapInstance = null;

export function initializeMap() {
    if (currentMapInstance) {
        return currentMapInstance;
    }

    currentMapInstance = L.map('map', {
        zoomControl: false // Вимикаємо стандартний контроль, щоб додати його в іншому місці
    }).setView([49.0, 31.0], 7); // Центр України

    // Визначення базових шарів
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const cartoDB_Light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19
    });

    // Додаємо OSM за замовчуванням
    osm.addTo(currentMapInstance);

    const baseMaps = {
        "OpenStreetMap": osm,
        "CartoDB Light": cartoDB_Light
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