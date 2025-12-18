// js/map/markerRenderer.js
import { getRoute } from '../api/routingService.js';
import { anomalyService } from '../services/anomalyService.js';

let currentMapInstance;
const renderedLayers = new Map();
let highlightLayer = null;
let currentlyHighlighted = null;

// Налаштування кластеризації
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

// Допоміжна функція для пошуку індексу точки на лінії
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

// Функція створення іконки (Старт/Фініш/Аномалії)
function createMarkerIcon(index, totalCount, isAnomaly) {
    let typeClass = '';
    let text = (index + 1).toString();
    
    // 1. Старт
    if (index === 0) {
        typeClass = 'marker-start';
        text = 'S';
    } 
    // 2. Фініш
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

// ГОЛОВНА ФУНКЦІЯ РЕНДЕРУ
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

    // 2. Отримання маршруту та Аналіз аномалій
    // Ми робимо це ДО створення маркерів, щоб знати, які маркери фарбувати
    let routeGeometry = null; // Геометрія для малювання лінії
    
    if (pointsToRender.length > 1) {
        const coords = pointsToRender.map(p => [p.latitude, p.longitude]);
        
        // Отримуємо об'єкт { geometry, legs, duration, distance }
        const routeData = await getRoute(coords, vehicleType);
        
        if (routeData) {
            routeGeometry = routeData.geometry || coords; // Фолбек на прямі лінії
            
            // Якщо є сегменти (legs), запускаємо аналіз
            if (routeData.legs && routeData.legs.length > 0) {
                // Ця функція поверне новий масив точок з доданим полем anomalyLevel
                pointsToRender = anomalyService.analyzeRoute(pointsToRender, routeData.legs);
            }
        }
    }

    // 3. Створення маркерів (вже з даними про аномалії)
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

        // Попап з деталями
        const timeStr = new Date(point.timestamp).toLocaleString('uk-UA');
        let popupContent = `<b>Точка №${displayIndex + 1}</b><br>${timeStr}`;
        
        // Якщо є аналіз затримки
        if (point.analysis && point.analysis.delay > 60) {
             const delayStr = anomalyService.formatDelay(point.analysis.delay);
             const colorStyle = isAnomaly === 'high' ? 'color:#b91c1c;font-weight:bold' : (isAnomaly === 'medium' ? 'color:#d97706;font-weight:bold' : '');
             popupContent += `<br><span style="${colorStyle}">⚠️ Затримка: ${delayStr}</span>`;
             popupContent += `<hr style="margin:5px 0; opacity:0.3">`;
             popupContent += `<small>Очікувано: ${(point.analysis.expected/60).toFixed(1)} хв</small><br>`;
             popupContent += `<small>Фактично: ${(point.analysis.fact/60).toFixed(1)} хв</small>`;
        }

        // Додаткові дані з файлу
        if (point.originalData) {
            popupContent += `<hr style="margin:5px 0; opacity:0.3"><ul>`;
            for (const key in point.originalData) {
                popupContent += `<li><strong>${key}:</strong> ${point.originalData[key]}</li>`;
            }
            popupContent += `</ul>`;
        }

        marker.bindPopup(popupContent);

        // Drag & Drop
        marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            if (onPointMove) {
                onPointMove(route.id, originalIndex, newPos.lat, newPos.lng);
            }
        });

        markers.push(marker);
    });

    // 4. Додавання маркерів на шар
    if (isClusteringEnabled) {
        markerClusterGroup.addLayers(markers);
    } else {
        markers.forEach(marker => nonClusteredMarkersLayer.addLayer(marker));
    }
    
    // 5. Малювання лінії
    let polyline = null;
    if (routeGeometry && routeGeometry.length > 0) {
        const maxWeight = 12;
        const minWeight = 4;
        const weightStep = (maxWeight - minWeight) / (renderOrder.total || 1);
        const weight = maxWeight - (renderOrder.index * weightStep);

        polyline = L.polyline(routeGeometry, { 
            color: routeColor, 
            weight: weight, 
            opacity: 0.85 
        }).addTo(map);
        
        // Індексація для хайлайту
        const pointIndexMap = pointsToRender.map(p => findClosestPointIndex(L.latLng(p.latitude, p.longitude), routeGeometry));
        polyline.options.fullGeometry = routeGeometry;
        polyline.options.pointIndexMap = pointIndexMap;
    }

    // Збереження шарів
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