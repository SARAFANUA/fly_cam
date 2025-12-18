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
let segmentHighlightLayer = null;

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

export async function renderMarkers(route, map, routeColor, isClusteringEnabled, dateFilter = new Set(), renderOrder = { index: 0, total: 1 }, vehicleType = 'car', onPointMove = null) {
    if (!route || !route.normalizedPoints || route.normalizedPoints.length === 0) return;

    clearRouteLayers(route.id);
    
    let pointsToRender = route.normalizedPoints;
    const isFiltered = (dateFilter.size > 0 && !route.isLocked);

    if (isFiltered) {
        pointsToRender = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return dateFilter.has(pointDate);
        });
    }

    if (pointsToRender.length === 0) return;

    const markers = [];
    
    pointsToRender.forEach((point, displayIndex) => {
        const originalIndex = route.normalizedPoints.indexOf(point);
        const isAnomaly = point.anomalyLevel || null;
        
        const icon = createMarkerIcon(displayIndex, pointsToRender.length, isAnomaly);
        
        const marker = L.marker([point.latitude, point.longitude], { 
            icon: icon, 
            draggable: true,
            originalIndex: originalIndex 
        });

        marker.bindPopup(generatePopupContent(point, displayIndex));

        marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            if (onPointMove) onPointMove(route.id, originalIndex, newPos.lat, newPos.lng);
        });

        markers.push(marker);
    });

    if (isClusteringEnabled) {
        markerClusterGroup.addLayers(markers);
    } else {
        markers.forEach(marker => nonClusteredMarkersLayer.addLayer(marker));
    }
    
    let polyline = null;
    if (pointsToRender.length > 1) {
        let geometry = [];
        
        // 1. Якщо фільтра немає і є кеш -> беремо кеш
        if (!isFiltered && route.osrmCoordinates && route.osrmCoordinates.length > 0) {
            geometry = route.osrmCoordinates;
        } 
        // 2. Якщо фільтр Є або кешу немає -> робимо запит
        else {
            const coords = pointsToRender.map(p => [p.latitude, p.longitude]);
            try {
                // Використовуємо getRouteData (який повертає {coordinates, legs})
                const data = await getRouteData(coords, vehicleType);
                // Беремо саме координати з відповіді
                geometry = data.coordinates; 
            } catch (e) {
                console.error("OSRM failed inside renderer:", e);
                geometry = coords; // Fallback на прямі лінії
            }
        }

        const maxWeight = 12;
        const minWeight = 4;
        const weightStep = (maxWeight - minWeight) / (renderOrder.total || 1);
        const weight = maxWeight - (renderOrder.index * weightStep);

        polyline = L.polyline(geometry, { 
            color: routeColor, 
            weight: weight, 
            opacity: 0.85 
        }).addTo(map);
        
        polyline.options.fullGeometry = geometry;
    }

    renderedLayers.set(route.id, { 
        markers, 
        polyline, 
        originalPoints: route.normalizedPoints, 
        filteredPoints: pointsToRender,
        color: routeColor 
    });
}

export async function updateRoutePolyline(routeId, updatedPoints, vehicleType) {
    const layerData = renderedLayers.get(routeId);
    if (!layerData || !layerData.polyline) return;

    const coords = updatedPoints.map(p => [p.latitude, p.longitude]);
    if (coords.length < 2) {
        layerData.polyline.setLatLngs([]);
        return;
    }

    try {
        const data = await getRouteData(coords, vehicleType);
        const newGeometry = (data && data.coordinates && data.coordinates.length > 0) 
            ? data.coordinates 
            : coords;
        
        layerData.polyline.setLatLngs(newGeometry);
        layerData.polyline.options.fullGeometry = newGeometry;
    } catch (e) {
        console.error("Помилка оновлення полілінії:", e);
    }
}

function resetHighlight() {
    if (segmentHighlightLayer) {
        currentMapInstance.removeLayer(segmentHighlightLayer);
        segmentHighlightLayer = null;
    }
    renderedLayers.forEach(layers => {
        if (layers.polyline) {
            layers.polyline.setStyle({ opacity: 0.85 });
        }
    });
}

// ✅ Оновлена функція підсвічування: малює маршрут по дорогах
export async function highlightSegment(routeId, originalIndex, vehicleType = 'car') {
    const layers = renderedLayers.get(routeId);
    if (!layers || !layers.markers) return;

    const marker = layers.markers.find(m => m.options.originalIndex === originalIndex);
    
    // Очищаємо попереднє підсвічування
    if (segmentHighlightLayer) {
        currentMapInstance.removeLayer(segmentHighlightLayer);
        segmentHighlightLayer = null;
    }

    if (marker) {
        // Зум до маркера
        if (markerClusterGroup.hasLayer(marker)) {
            markerClusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
        } else {
            currentMapInstance.setView(marker.getLatLng(), 16);
            marker.openPopup();
        }

        // Малюємо лінію від попередньої точки
        if (originalIndex > 0) {
            const prev = layers.originalPoints[originalIndex - 1];
            const curr = layers.originalPoints[originalIndex];
            
            const segmentPoints = [
                [prev.latitude, prev.longitude], 
                [curr.latitude, curr.longitude]
            ];

            let geometry = segmentPoints; // За замовчуванням пряма

            try {
                // Запитуємо маршрут для цього сегмента
                const data = await getRouteData(segmentPoints, vehicleType);
                if (data && data.coordinates && data.coordinates.length > 0) {
                    geometry = data.coordinates;
                }
            } catch (e) {
                console.warn("Не вдалося побудувати детальний маршрут сегмента, малюю пряму.", e);
            }
            
            segmentHighlightLayer = L.polyline(geometry, {
                color: '#ffff00', // Жовтий хайлайт
                weight: 8,
                opacity: 0.8,
                dashArray: '10, 15',
                lineCap: 'round'
            }).addTo(currentMapInstance);
        }
    }
}

export function clearRouteLayers(routeId) {
    if (renderedLayers.has(routeId)) {
        const layers = renderedLayers.get(routeId);
        if (layers.markers) {
            layers.markers.forEach(marker => {
                markerClusterGroup.removeLayer(marker);
                nonClusteredMarkersLayer.removeLayer(marker);
            });
        }
        if (layers.polyline) currentMapInstance?.removeLayer(layers.polyline);
        renderedLayers.delete(routeId);
    }
    // Очищаємо хайлайт при видаленні шару
    resetHighlight();
}

export function clearAllMarkers() {
    markerClusterGroup.clearLayers();
    nonClusteredMarkersLayer.clearLayers();
    for (const routeId of renderedLayers.keys()) {
        const layers = renderedLayers.get(routeId);
        if (layers.polyline) currentMapInstance?.removeLayer(layers.polyline);
    }
    renderedLayers.clear();
    resetHighlight();
}