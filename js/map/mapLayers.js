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

// Стилі за замовчуванням (коли нічого не вибрано)
const DEFAULT_STYLES = {
    oblast: { color: '#004a99', weight: 1.8, opacity: 0.9, dashArray: '5, 5', fill: false }, 
    raion: { color: '#454a5eff', weight: 1.5, opacity: 0.8, dashArray: '5, 5', fill: false },
    hromada: { color: '#999999', weight: 1, opacity: 0.6, fill: false }
};

// URL-адреси (локальні)
const URLS = {
    oblast: 'js/data/oblast.json',
    raion: 'js/data/raion.json',
    hromada: 'js/data/hromada.json'
};

const ZOOM_THRESHOLDS = { TO_RAION: 8, TO_HROMADA: 10 };

/**
 * Завантажує GeoJSON.
 */
async function loadGeoJsonLayer(url, styleOptions, map) {
    try {
        const finalUrl = `${url}?t=${Date.now()}`; 
        const response = await fetch(finalUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        return L.geoJSON(data, {
            style: styleOptions,
            interactive: false, 
            pane: 'bordersPane'
        });
    } catch (e) {
        console.warn(`[MapLayers] Failed to load layer from ${url}`, e);
        return null;
    }
}

/**
 * Оновлює видимість шарів залежно від зуму.
 */
function updateLayersVisibility(map) {
    const zoom = map.getZoom();
    
    // Визначаємо, які шари мають бути на карті
    // Якщо зум великий - показуємо детальніші кордони
    const showOblast = true;
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
 * Підсвічує територію (Область, Район або Громаду).
 * Решта карти затемнюється.
 * * @param {string|null} katottgCode - Код КАТОТТГ для виділення (або null для скидання).
 */
export function highlightTerritory(katottgCode) {
    // Якщо коду немає - скидаємо стилі на дефолтні
    if (!katottgCode) {
        resetStyles();
        return;
    }

    // console.log(`[MapLayers] Highlighting KATOTTG: ${katottgCode}`);

    const applyHighlight = (layer, type) => {
        if (!layer) return;

        layer.eachLayer(layerItem => {
            const props = layerItem.feature.properties;
            // Перевіряємо відповідність katottg_3 (як у GeoJSON)
            const featureCode = props.katottg_3 || props.katottg || ''; 

            // Порівнюємо як рядки, щоб уникнути проблем типів
            if (String(featureCode) === String(katottgCode)) {
                // ЦЕ ОБРАНА ТЕРИТОРІЯ:
                // Прозора заливка (щоб бачити карту), яскравий кордон
                layerItem.setStyle({
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    color: '#FFD700', // Золотий колір кордону
                    weight: 4,
                    opacity: 1,
                    dashArray: null
                });
            } else {
                // ЦЕ НЕВИБРАНА ТЕРИТОРІЯ (ФОН):
                // Темна напівпрозора заливка (ефект затемнення)
                layerItem.setStyle({
                    fillColor: '#000000',
                    fillOpacity: 0.6, // Сила затемнення
                    color: '#444',    // Тьмяний кордон
                    weight: 1,
                    opacity: 0.3,
                    dashArray: null
                });
            }
        });
    };

    // Застосовуємо логіку до всіх активних шарів
    applyHighlight(layersCache.oblast, 'oblast');
    applyHighlight(layersCache.raion, 'raion');
    applyHighlight(layersCache.hromada, 'hromada');
}

/**
 * Повертає стилі до початкового стану.
 */
function resetStyles() {
    if (layersCache.oblast) layersCache.oblast.setStyle(DEFAULT_STYLES.oblast);
    if (layersCache.raion) layersCache.raion.setStyle(DEFAULT_STYLES.raion);
    if (layersCache.hromada) layersCache.hromada.setStyle(DEFAULT_STYLES.hromada);
}


/**
 * Ініціалізація
 */
export async function initDynamicAdminBorders(map) {
    console.log('[MapLayers] Initializing dynamic borders (Highlight support)...');

    if (!map.getPane('bordersPane')) {
        map.createPane('bordersPane');
        map.getPane('bordersPane').style.zIndex = 250;
        map.getPane('bordersPane').style.pointerEvents = 'none';
    }

    // Завантаження шарів
    layersCache.oblast = await loadGeoJsonLayer(URLS.oblast, DEFAULT_STYLES.oblast, map);
    if (layersCache.oblast) updateLayersVisibility(map);

    loadGeoJsonLayer(URLS.raion, DEFAULT_STYLES.raion, map).then(l => {
        layersCache.raion = l;
        updateLayersVisibility(map);
    });

    loadGeoJsonLayer(URLS.hromada, DEFAULT_STYLES.hromada, map).then(l => {
        layersCache.hromada = l;
        updateLayersVisibility(map);
    });

    map.off('zoomend', updateLayersVisibility);
    map.on('zoomend', () => updateLayersVisibility(map));
}