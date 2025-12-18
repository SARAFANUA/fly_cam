// js/map/markerRenderer.js
import { getRoute } from '../api/routingService.js';

let currentMapInstance;
const renderedLayers = new Map();
let highlightLayer = null;
let currentlyHighlighted = null;

const markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let sizeClass = 'route-cluster-small';
        let size = 35;

        if (count > 50) {
            sizeClass = 'route-cluster-large';
            size = 50;
        } else if (count > 10) {
            sizeClass = 'route-cluster-medium';
            size = 42;
        }

        return L.divIcon({
            html: `<span>${count}</span>`,
            className: `route-cluster ${sizeClass}`,
            iconSize: L.point(size, size)
        });
    }
});

let nonClusteredMarkersLayer = L.layerGroup(); 

function findClosestPointIndex(targetPoint, geometry) {
    let closestIndex = -1;
    let minDistance = Infinity;
    geometry.forEach((coords, index) => {
        const point = L.latLng(coords[0], coords[1]);
        const distance = targetPoint.distanceTo(point);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });
    return closestIndex;
}

export function setMapInstance(map) {
    currentMapInstance = map;
    currentMapInstance.addLayer(markerClusterGroup);
    currentMapInstance.addLayer(nonClusteredMarkersLayer);
}

// Функція створення іконки маркера з урахуванням типу (Старт/Фініш/Аномалія)
function createMarkerIcon(index, totalCount, isAnomaly) {
    let typeClass = '';
    let text = (index + 1).toString();
    
    // 1. Старт (перша точка)
    if (index === 0) {
        typeClass = 'marker-start';
        text = 'S';
    } 
    // 2. Фініш (остання точка)
    else if (index === totalCount - 1) {
        typeClass = 'marker-finish';
        text = 'F';
    } 
    // 3. Аномалії
    else if (isAnomaly === 'high') {
        typeClass = 'marker-danger';
    } 
    else if (isAnomaly === 'medium') {
        typeClass = 'marker-warning';
    }

    return L.divIcon({
        className: `custom-marker-icon ${typeClass}`,
        html: `<div class="marker-pin"></div><div class="marker-number">${text}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -40]
    });
}

// ОНОВЛЕНА ФУНКЦІЯ: додано параметр onPointMove
export async function renderMarkers(route, map, routeColor, isClusteringEnabled, dateFilter = new Set(), renderOrder = { index: 0, total: 1 }, vehicleType = 'car', onPointMove = null) {
    if (!route || !route.normalizedPoints || route.normalizedPoints.length === 0) {
        return;
    }

    clearRouteLayers(route.id);
    
    // 1. Фільтрація точок
    let pointsToRender = route.normalizedPoints;

    if (dateFilter.size > 0 && !route.isLocked) {
        pointsToRender = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return dateFilter.has(pointDate);
        });
    }

    if (pointsToRender.length === 0) {
        return;
    }

    const markers = [];
    
    // 2. Створення маркерів
    pointsToRender.forEach((point, displayIndex) => {
        // Зберігаємо оригінальний індекс для прив'язки до даних
        const originalIndex = route.normalizedPoints.indexOf(point);
        
        // Тут буде логіка аномалій (поки що беремо з даних, якщо є)
        const isAnomaly = point.anomalyLevel || null;

        const icon = createMarkerIcon(displayIndex, pointsToRender.length, isAnomaly);
        
        const marker = L.marker([point.latitude, point.longitude], { 
            icon: icon, 
            draggable: true, // Вмикаємо можливість перетягування
            originalIndex: originalIndex 
        });

        // Формуємо вміст попапу
        const timeStr = new Date(point.timestamp).toLocaleString('uk-UA');
        let popupContent = `<b>Точка №${displayIndex + 1}</b><br>${timeStr}`;
        
        if (point.originalData) {
            popupContent += `<ul>`;
            for (const key in point.originalData) {
                // Відображаємо додаткові дані, якщо є
                popupContent += `<li><strong>${key}:</strong> ${point.originalData[key]}</li>`;
            }
            popupContent += `</ul>`;
        }
        marker.bindPopup(popupContent);

        // Обробка події завершення перетягування
        marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            if (onPointMove) {
                // Викликаємо колбек, який оновить Store і перезапустить рендер
                onPointMove(route.id, originalIndex, newPos.lat, newPos.lng);
            }
        });

        markers.push(marker);
    });

    // 3. Додавання маркерів на карту (кластеризовано або ні)
    if (isClusteringEnabled) {
        markerClusterGroup.addLayers(markers);
    } else {
        markers.forEach(marker => nonClusteredMarkersLayer.addLayer(marker));
    }
    
    // 4. Побудова лінії маршруту (якщо точок більше однієї)
    let polyline = null;
    if (pointsToRender.length > 1) {
        const maxWeight = 12;
        const minWeight = 4;
        const weightStep = (maxWeight - minWeight) / (renderOrder.total || 1);
        const weight = maxWeight - (renderOrder.index * weightStep);

        const coords = pointsToRender.map(p => [p.latitude, p.longitude]);
        
        // Отримуємо геометрію дороги від OSRM
        const roadLatLngs = await getRoute(coords, vehicleType);
        
        polyline = L.polyline(roadLatLngs, { 
            color: routeColor, 
            weight: weight, 
            opacity: 0.85 
        }).addTo(map);
        
        // Зберігаємо прив'язку точок до сегментів лінії (для майбутнього хайлайту)
        const pointIndexMap = pointsToRender.map(p => findClosestPointIndex(L.latLng(p.latitude, p.longitude), roadLatLngs));

        polyline.options.fullGeometry = roadLatLngs;
        polyline.options.pointIndexMap = pointIndexMap;
    }

    // Зберігаємо посилання на шари
    renderedLayers.set(route.id, { markers, polyline, originalPoints: route.normalizedPoints, filteredPoints: pointsToRender });
}

function resetHighlight() {
    if (highlightLayer) {
        currentMapInstance.removeLayer(highlightLayer);
        highlightLayer = null;
    }
    renderedLayers.forEach(layers => {
        if (layers.polyline) {
            layers.polyline.setStyle({ opacity: 0.85 });
        }
    });
    currentlyHighlighted = null;
}

export function highlightSegment(routeId, originalIndex) {
    const layers = renderedLayers.get(routeId);
    if (!layers || !layers.markers) return;

    // Знаходимо маркер за оригінальним індексом
    const marker = layers.markers.find(m => m.options.originalIndex === originalIndex);
    
    if (marker) {
        if (markerClusterGroup.hasLayer(marker)) {
            markerClusterGroup.zoomToShowLayer(marker, () => {
                marker.openPopup();
            });
        } else {
            currentMapInstance.setView(marker.getLatLng(), 15);
            marker.openPopup();
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