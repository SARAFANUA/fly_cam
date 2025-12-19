// js/map/mapLayers.js

/**
 * Ініціалізує контроль базових шарів.
 * @param {L.Map} map - Екземпляр карти Leaflet.
 * @param {Object} baseMaps - Об'єкт з базовими шарами.
 */
export function setupLayerControls(map, baseMaps) {
    L.control.layers(baseMaps, null, { collapsed: true }).addTo(map);
}

// Кеш для шарів
const layersCache = {
    oblast: null,
    raion: null,
    hromada: null
};

// --- ЗМІНЕНО: Використовуємо локальні файли ---
// Файли мають бути завантажені скриптом download_geo.js у папку js/data/
const URLS = {
    oblast: 'js/data/oblast.json',
    raion: 'js/data/raion.json',
    hromada: 'js/data/hromada.json'
};

// Поріг зуму для перемикання
const ZOOM_THRESHOLDS = {
    TO_RAION: 8,   // zoom >= 8 -> +Райони
    TO_HROMADA: 10 // zoom >= 10 -> +Громади
};

/**
 * Завантажує GeoJSON за URL (локальним).
 */
async function loadGeoJsonLayer(url, styleOptions, map) {
    try {
        // Додаємо timestamp для локальної розробки (кеш браузера)
        const finalUrl = `${url}?t=${Date.now()}`; 
        
        console.log(`[MapLayers] Fetching: ${url}`);
        const response = await fetch(finalUrl);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        return L.geoJSON(data, {
            style: styleOptions,
            interactive: false, 
            pane: 'bordersPane'
        });
    } catch (e) {
        console.warn(`[MapLayers] Failed to load layer from ${url}. Did you run "node download_geo.js"?`, e);
        return null;
    }
}

/**
 * Оновлює видимість шарів залежно від поточного зуму.
 */
function updateLayersVisibility(map) {
    const zoom = map.getZoom();
    
    // Показувати завжди (основа)
    const showOblast = true;
    
    // Показувати при наближенні
    const showRaion = zoom >= ZOOM_THRESHOLDS.TO_RAION;
    const showHromada = zoom >= ZOOM_THRESHOLDS.TO_HROMADA;

    const toggle = (type, shouldShow) => {
        const layer = layersCache[type];
        if (!layer) return; 

        if (shouldShow) {
            if (!map.hasLayer(layer)) {
                map.addLayer(layer);
            }
        } else {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    };

    toggle('oblast', showOblast);
    toggle('raion', showRaion);
    toggle('hromada', showHromada);
}

/**
 * Ініціалізує динамічні адміністративні кордони.
 * @param {L.Map} map 
 */
export async function initDynamicAdminBorders(map) {
    console.log('[MapLayers] Initializing dynamic borders (LOCAL mode)...');

    // 1. Створюємо спеціальний Pane (шар) для кордонів
    if (!map.getPane('bordersPane')) {
        map.createPane('bordersPane');
        map.getPane('bordersPane').style.zIndex = 250; // Між картою (0) і маркерами (600)
        map.getPane('bordersPane').style.pointerEvents = 'none';
    }

    // 2. Стилі
    const styles = {
        oblast: { 
            color: '#004a99', weight: 1.8, opacity: 0.9, dashArray: '5, 5', fill: false 
        }, 
        raion: { 
            color: '#2d3f66ff', weight: 1.5, opacity: 0.8, dashArray: '5, 5', fill: false 
        },
        hromada: { 
            color: '#3f4181ff', weight: 1.2, opacity: 0.6, fill: false 
        }
    };

    // 3. Завантажуємо Області (Першочергово)
    layersCache.oblast = await loadGeoJsonLayer(URLS.oblast, styles.oblast, map);
    if (layersCache.oblast) {
        updateLayersVisibility(map);
    } else {
        console.error('[MapLayers] Oblast NOT loaded. Run "node download_geo.js" first.');
    }

    // 4. Завантажуємо Райони та Громади у фоні
    loadGeoJsonLayer(URLS.raion, styles.raion, map).then(layer => {
        if (layer) {
            layersCache.raion = layer;
            updateLayersVisibility(map);
        }
    });

    loadGeoJsonLayer(URLS.hromada, styles.hromada, map).then(layer => {
        if (layer) {
            layersCache.hromada = layer;
            updateLayersVisibility(map);
        }
    });

    // 5. Підписуємось на зміну зуму
    map.off('zoomend', updateLayersVisibility);
    map.on('zoomend', () => updateLayersVisibility(map));
}