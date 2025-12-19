/* =========================================================
   MAP LAYERS – NPU BRAND EDITION
========================================================= */

export function setupLayerControls(map, baseMaps) {
    console.log('[MapLayers] setupLayerControls');
    L.control.layers(baseMaps, null, { collapsed: true }).addTo(map);
}

/* =========================
   GLOBAL STATE
========================= */
const layersCache = {
    oblast: null,
    raion: null,
    hromada: null
};

let lastHighlightedCode = null;
let fitBoundsTimer = null;

/* =========================
   NPU BRAND COLORS
========================= */
const COLORS = {
    NPU_BLUE: '#152A65',
    NPU_DARK_BLUE: '#0C183B',
    NPU_YELLOW: '#FFDD00',
    NPU_GRAY: '#9D9D9D'
};

/* =========================
   STYLES
========================= */
const DEFAULT_STYLES = {
    oblast: {
        color: COLORS.NPU_BLUE,
        weight: 1.2,
        opacity: 0.9,
        fill: false
    },
    raion: {
        color: COLORS.NPU_GRAY,
        weight: 0.9,
        opacity: 0.8,
        dashArray: '4,4',
        fill: false
    },
    hromada: {
        color: COLORS.NPU_GRAY,
        weight: 1,
        opacity: 0.6,
        fill: false
    }
};

/* =========================
   CONFIG
========================= */
const URLS = {
    oblast: 'js/data/oblast.json',
    raion: 'js/data/raion.json',
    hromada: 'js/data/hromada.json'
};

const ZOOM_THRESHOLDS = {
    TO_RAION: 8,
    TO_HROMADA: 10
};

/* =========================
   HELPERS
========================= */
function detectLevel(code) {
    if (!code || !code.startsWith('UA')) return 'unknown';
    if (/^UA\d{2}0{10}\d{5}$/.test(code)) return 'oblast';
    if (/^UA\d{4}0{8}\d{5}$/.test(code)) return 'raion';
    if (/^UA\d{17}$/.test(code)) return 'hromada';
    return 'unknown';
}

function getCandidateCodes(props, level) {
    if (!props) return [];
    if (level === 'oblast') {
        return [
            props['1_id_Область'],
            props['КАТОТТГ_hromada_L1_id'],
            props.code
        ].filter(Boolean);
    }
    if (level === 'raion') {
        return [
            props['2_id_Район'],
            props['КАТОТТГ_hromada_L2_id'],
            props.code
        ].filter(Boolean);
    }
    return [
        props.katottg,
        props.katotth_3,
        props.katottg_3,
        props.code
    ].filter(Boolean);
}

function resetStyles() {
    for (const type of ['oblast', 'raion', 'hromada']) {
        const layer = layersCache[type];
        if (!layer) continue;
        layer.eachLayer(l => layer.resetStyle(l));
        layer.setStyle(DEFAULT_STYLES[type]);
    }
}

/* =========================
   LOAD GEOJSON
========================= */
async function loadGeoJsonLayer(url, style, map, name) {
    console.log(`[MapLayers] loading ${name} from`, url);
    const data = await fetch(`${url}?t=${Date.now()}`).then(r => r.json());

    const layer = L.geoJSON(data, {
        style,
        pane: 'bordersPane',
        interactive: false
    }).addTo(map);

    console.log(`[MapLayers] ${name} features:`, data.features?.length);
    return layer;
}

/* =========================
   VISIBILITY
========================= */
function updateLayersVisibility(map) {
    const z = map.getZoom();

    const rules = {
        oblast: true,
        raion: z >= ZOOM_THRESHOLDS.TO_RAION,
        hromada: z >= ZOOM_THRESHOLDS.TO_HROMADA
    };

    for (const k of Object.keys(layersCache)) {
        const l = layersCache[k];
        if (!l) continue;
        rules[k] ? map.addLayer(l) : map.removeLayer(l);
    }
}

/* =========================
   NAVIGATION LOGIC
========================= */
function navigateToRegion(map, bounds, level, codeChanged) {
    if (!bounds?.isValid()) return;

    const current = map.getBounds();
    const center = bounds.getCenter();

    if (!codeChanged && current.contains(bounds)) {
        console.log('[MapLayers] region already in viewport → pan only');
        map.panTo(center, { animate: true, duration: 0.4 });
        return;
    }

    if (!codeChanged) return;

    const maxZoom = level === 'oblast' ? 8 : level === 'raion' ? 11 : 13;

    clearTimeout(fitBoundsTimer);
    fitBoundsTimer = setTimeout(() => {
        console.log('[MapLayers] fitBounds to selected region');
        map.fitBounds(bounds, {
            padding: [24, 24],
            maxZoom,
            animate: true,
            duration: 0.6
        });
    }, 250);
}

/* =========================
   HIGHLIGHT
========================= */
export function highlightTerritory(code) {
    console.log('[MapLayers] highlightTerritory:', code);

    if (!code) {
        resetStyles();
        lastHighlightedCode = null;
        return;
    }

    const targetCode = String(code).trim();
    const level = detectLevel(targetCode);
    const map = window.__leafletMap__;

    if (!map || !layersCache[level]) return;

    const codeChanged = targetCode !== lastHighlightedCode;
    lastHighlightedCode = targetCode;

    resetStyles();

    let unionBounds = null;

    layersCache[level].eachLayer(l => {
        const props = l.feature?.properties;
        const match = getCandidateCodes(props, level).includes(targetCode);

        if (match) {
            const b = l.getBounds?.();
            if (b?.isValid()) {
                unionBounds = unionBounds ? unionBounds.extend(b) : b;
            }

            l.setStyle({
                color: COLORS.NPU_YELLOW,
                weight: 4,
                opacity: 1,
                fill: false
            });
            l.bringToFront?.();
        } else {
            l.setStyle({
                fill: true,
                fillColor: COLORS.NPU_DARK_BLUE,
                fillOpacity: 0.12,
                color: COLORS.NPU_GRAY,
                weight: 1,
                opacity: 0.3
            });
        }
    });

    navigateToRegion(map, unionBounds, level, codeChanged);
}

/* =========================
   INIT
========================= */
export async function initDynamicAdminBorders(map) {
    console.log('[MapLayers] INIT dynamic borders');
    window.__leafletMap__ = map;

    if (!map.getPane('bordersPane')) {
        map.createPane('bordersPane');
        map.getPane('bordersPane').style.zIndex = 250;
        map.getPane('bordersPane').style.pointerEvents = 'none';
    }

    layersCache.oblast  = await loadGeoJsonLayer(URLS.oblast,  DEFAULT_STYLES.oblast,  map, 'oblast');
    layersCache.raion   = await loadGeoJsonLayer(URLS.raion,   DEFAULT_STYLES.raion,   map, 'raion');
    layersCache.hromada = await loadGeoJsonLayer(URLS.hromada, DEFAULT_STYLES.hromada, map, 'hromada');

    updateLayersVisibility(map);
    map.on('zoomend', () => updateLayersVisibility(map));

    console.log('[MapLayers] INIT complete');
}
