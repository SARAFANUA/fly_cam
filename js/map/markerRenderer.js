// js/map/markerRenderer.js
import { getRouteData } from '../api/routingService.js';
import { 
    createMarkerIcon, 
    createClusterIcon, 
    generatePopupContent, 
    findClosestPointIndex 
} from './markerUtils.js';

let currentMapInstance;
const renderedLayers = new Map();
let segmentHighlightLayer = null; // ✅ Шар для лінії сегмента

// ... (markerClusterGroup, nonClusteredMarkersLayer залишаються без змін) ...
const markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: createClusterIcon
});
let nonClusteredMarkersLayer = L.layerGroup(); 

export function setMapInstance(map) {
    currentMapInstance = map;
    currentMapInstance.addLayer(markerClusterGroup);
    currentMapInstance.addLayer(nonClusteredMarkersLayer);
}

// ... (renderMarkers залишається без змін) ...
export async function renderMarkers(route, map, routeColor, isClusteringEnabled, dateFilter = new Set(), renderOrder = { index: 0, total: 1 }, vehicleType = 'car', onPointMove = null) {
    // (весь код функції renderMarkers, який ми вже писали раніше)
    if (!route || !route.normalizedPoints || route.normalizedPoints.length === 0) return;
    clearRouteLayers(route.id);
    let pointsToRender = route.normalizedPoints;
    if (dateFilter.size > 0 && !route.isLocked) {
        pointsToRender = route.normalizedPoints.filter(p => dateFilter.has(new Date(p.timestamp).toLocaleDateString('uk-UA')));
    }
    if (pointsToRender.length === 0) return;
    const markers = [];
    pointsToRender.forEach((point, displayIndex) => {
        const originalIndex = route.normalizedPoints.indexOf(point);
        const isAnomaly = point.anomalyLevel || null;
        const icon = createMarkerIcon(displayIndex, pointsToRender.length, isAnomaly);
        const marker = L.marker([point.latitude, point.longitude], { icon, draggable: true, originalIndex });
        marker.bindPopup(generatePopupContent(point, displayIndex));
        marker.on('dragend', (e) => { if (onPointMove) onPointMove(route.id, originalIndex, e.target.getLatLng().lat, e.target.getLatLng().lng); });
        markers.push(marker);
    });
    if (isClusteringEnabled) markerClusterGroup.addLayers(markers);
    else markers.forEach(m => nonClusteredMarkersLayer.addLayer(m));
    
    let polyline = null;
    if (pointsToRender.length > 1) {
        let geometry = [];
        if (!dateFilter.size && route.osrmCoordinates) geometry = route.osrmCoordinates;
        else geometry = pointsToRender.map(p => [p.latitude, p.longitude]);
        const weight = 12 - (renderOrder.index * (8 / (renderOrder.total || 1)));
        polyline = L.polyline(geometry, { color: routeColor, weight, opacity: 0.85 }).addTo(map);
        polyline.options.fullGeometry = geometry;
    }
    renderedLayers.set(route.id, { markers, polyline, originalPoints: route.normalizedPoints, filteredPoints: pointsToRender, color: routeColor });
}

// ... (updateRoutePolyline залишається без змін) ...
export async function updateRoutePolyline(routeId, updatedPoints, vehicleType) {
    // (код з попередньої ітерації)
    const layerData = renderedLayers.get(routeId);
    if (!layerData?.polyline) return;
    const coords = updatedPoints.map(p => [p.latitude, p.longitude]);
    try {
        const data = await getRouteData(coords, vehicleType);
        const newGeometry = data?.coordinates?.length ? data.coordinates : coords;
        layerData.polyline.setLatLngs(newGeometry);
        layerData.polyline.options.fullGeometry = newGeometry;
    } catch(e) { console.error(e); }
}

// ✅ НОВЕ: Очищення підсвітки
function clearSegmentHighlight() {
    if (segmentHighlightLayer) {
        currentMapInstance.removeLayer(segmentHighlightLayer);
        segmentHighlightLayer = null;
    }
}

// ✅ НОВЕ: Підсвічування сегмента (лінія + зум до маркера)
export async function highlightSegment(routeId, originalIndex) {
    const layers = renderedLayers.get(routeId);
    if (!layers || !layers.markers) return;

    // 1. Знаходимо маркер
    const marker = layers.markers.find(m => m.options.originalIndex === originalIndex);
    
    // 2. Очищаємо попереднє виділення
    clearSegmentHighlight();

    if (marker) {
        // Зум до маркера
        if (markerClusterGroup.hasLayer(marker)) {
            markerClusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
        } else {
            currentMapInstance.setView(marker.getLatLng(), 16);
            marker.openPopup();
        }

        // 3. Малюємо лінію від попередньої точки до поточної (якщо це не перша точка)
        if (originalIndex > 0) {
            const prevPoint = layers.originalPoints[originalIndex - 1];
            const currPoint = layers.originalPoints[originalIndex];
            
            // Якщо маємо OSRM леги, можна спробувати витягнути точну геометрію,
            // але для простоти і швидкодії малюємо пряму або запитуємо маленький маршрут
            // Тут використовуємо пряму лінію для миттєвої реакції, але стилізуємо її
            const segmentCoords = [
                [prevPoint.latitude, prevPoint.longitude],
                [currPoint.latitude, currPoint.longitude]
            ];

            // Малюємо "світіння"
            segmentHighlightLayer = L.polyline(segmentCoords, {
                color: 'yellow', // Контрастний колір
                weight: 10,
                opacity: 0.7,
                dashArray: '10, 10',
                lineCap: 'round'
            }).addTo(currentMapInstance);
            
            // Можна додати анімацію або видалення через час, якщо треба
        }
    }
}

export function clearRouteLayers(routeId) {
    if (renderedLayers.has(routeId)) {
        const layers = renderedLayers.get(routeId);
        if (layers.markers) layers.markers.forEach(m => { markerClusterGroup.removeLayer(m); nonClusteredMarkersLayer.removeLayer(m); });
        if (layers.polyline) currentMapInstance?.removeLayer(layers.polyline);
        renderedLayers.delete(routeId);
    }
    clearSegmentHighlight();
}

export function clearAllMarkers() {
    markerClusterGroup.clearLayers();
    nonClusteredMarkersLayer.clearLayers();
    for (const layers of renderedLayers.values()) if (layers.polyline) currentMapInstance?.removeLayer(layers.polyline);
    renderedLayers.clear();
    clearSegmentHighlight();
}