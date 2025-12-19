// js/map/warLayer.js

let warLayerGroup = null;

// Стилі
const STYLES = {
    'occupied': {
        color: '#b91c1c',      // Темно-червоний контур
        fillColor: '#dc2626',  // Червона заливка
        fillOpacity: 0.15,     // Легка прозорість
        weight: 1,
        dashArray: null,
        interactive: false
    },
    'uncertain': { 
        color: '#4b5563',
        fillColor: '#6b7280',
        fillOpacity: 0.15,
        weight: 1,
        dashArray: '5, 5',
        interactive: false
    }
};

// Приблизні межі України (Bounding Box) + Запас
// Lat: 44.0 (Крим) - 53.0 (Північ)
// Lon: 22.0 (Захід) - 41.0 (Схід)
const UA_BOUNDS = {
    minLat: 44.0,
    maxLat: 53.0,
    minLon: 22.0,
    maxLon: 41.0
};

// Перевірка, чи полігон знаходиться в межах України
function isInsideUkraine(feature) {
    // 1. Отримуємо першу точку полігону для перевірки координат
    let coords = null;
    const geom = feature.geometry;

    if (geom.type === 'Polygon') {
        coords = geom.coordinates[0][0]; // [lon, lat]
    } else if (geom.type === 'MultiPolygon') {
        coords = geom.coordinates[0][0][0]; // [lon, lat]
    }

    if (!coords) return false;

    const lon = coords[0];
    const lat = coords[1];

    // 2. Географічний фільтр (відсіює Фінляндію, Грузію, Японію, Калінінград)
    if (lat < UA_BOUNDS.minLat || lat > UA_BOUNDS.maxLat) return false;
    if (lon < UA_BOUNDS.minLon || lon > UA_BOUNDS.maxLon) return false;

    // 3. Текстовий фільтр для сусідів, які потрапляють у координати (Придністров'я)
    const name = (feature.properties.name || '').toLowerCase();
    const desc = (feature.properties.description || '').toLowerCase();
    
    // Список слів-виключень
    const excludeKeywords = [
        'придністров', 'молдов', 'transnistria', 'moldova', // Молдова
        'abkhazia', 'абхазі', // Грузія (якщо зачепить край)
        'south ossetia', 'осеті'
    ];

    if (excludeKeywords.some(kw => name.includes(kw) || desc.includes(kw))) {
        return false;
    }

    return true;
}

function determineZoneType(props) {
    if (!props) return null;
    
    if (props.type) return props.type;

    const name = (props.name || '').toLowerCase();
    const desc = (props.description || '').toLowerCase();

    // 1. Відсіюємо звільнені
    if (name.includes('звільнено') || desc.includes('звільнено')) {
        return 'liberated'; 
    }

    // 2. Визначаємо сіру зону
    if (name.includes('сіра зона') || name.includes('grey zone') || desc.includes('сіра зона')) {
        return 'uncertain';
    }

    return 'occupied';
}

export async function initWarLayer(map) {
    if (warLayerGroup) return;

    warLayerGroup = L.layerGroup().addTo(map);
    
    if (!map.getPane('warPane')) {
        map.createPane('warPane');
        map.getPane('warPane').style.zIndex = 390;
        map.getPane('warPane').style.pointerEvents = 'none';
    }

    try {
        await loadDeepStateData(map);
    } catch (e) {
        console.error('[WarLayer] Error:', e);
    }
}

async function loadDeepStateData(map) {
    const res = await fetch('/api/war/state');
    if (!res.ok) return;
    
    const geoJson = await res.json();
    if (!geoJson || !geoJson.features) return;

    L.geoJSON(geoJson, {
        pane: 'warPane',
        
        filter: (feature) => {
            if (!feature || !feature.properties) return false;
            
            // 1. Прибираємо маркери (точки)
            if (feature.geometry && feature.geometry.type === 'Point') return false;

            // 2. Тільки Україна (координати + назва)
            if (!isInsideUkraine(feature)) return false;

            // 3. Тільки окупація (без сірих зон)
            const type = determineZoneType(feature.properties);
            return type === 'occupied'; 
        },

        style: (feature) => {
            return STYLES['occupied'];
        }
    }).addTo(warLayerGroup);
}

export function updateWarLayer() {
    if (!warLayerGroup) return;
    warLayerGroup.clearLayers();
}