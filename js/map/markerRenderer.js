// js/map/markerRenderer.js

let currentMapInstance;
const renderedLayers = new Map();
let highlightLayer = null;

const markerClusterGroup = L.markerClusterGroup({
    // ... (конфіг кластерів без змін)
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let sizeClass = 'route-cluster-small';
        if (count > 50) sizeClass = 'route-cluster-large';
        else if (count > 10) sizeClass = 'route-cluster-medium';

        return L.divIcon({
            html: `<span>${count}</span>`,
            className: `route-cluster ${sizeClass}`,
            iconSize: L.point(40, 40)
        });
    }
});

let nonClusteredMarkersLayer = L.layerGroup(); 

function findClosestPointIndex(targetPoint, geometry) {
     if (!geometry || !Array.isArray(geometry)) return -1;
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

// ✅ Використовуємо класи CSS map.css
function createMarkerIcon(index, totalCount, isAnomaly) {
    let typeClass = '';
    let text = (index + 1).toString();
    
    if (index === 0) {
        typeClass = 'marker-start'; text = 'S';
    } else if (index === totalCount - 1) {
        typeClass = 'marker-finish'; text = 'F';
    } else if (isAnomaly === 'high') {
        typeClass = 'marker-danger'; // Червоний
    } else if (isAnomaly === 'medium') {
        typeClass = 'marker-warning'; // Жовтий
    }

    return L.divIcon({
        className: `custom-marker-icon ${typeClass}`,
        html: `<div class="marker-pin"></div><div class="marker-number">${text}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -40]
    });
}

function formatDuration(sec) {
    if(!sec) return '0с';
    const m = Math.floor(Math.abs(sec) / 60);
    const s = Math.floor(Math.abs(sec) % 60);
    return (sec < 0 ? '-' : '') + (m > 0 ? `${m}хв ` : '') + `${s}с`;
}

export async function renderMarkers(route, map, routeColor, isClusteringEnabled, dateFilter, renderOrder, onPointMove) {
    if (!route || !route.normalizedPoints) return;

    clearRouteLayers(route.id);
    
    // Фільтрація
    let pointsToRender = route.normalizedPoints;
    if (dateFilter && dateFilter.size > 0 && !route.isLocked) {
        pointsToRender = route.normalizedPoints.filter(p => {
            return dateFilter.has(new Date(p.timestamp).toLocaleDateString('uk-UA'));
        });
    }
    if (pointsToRender.length === 0) return;

    const markers = [];
    
    pointsToRender.forEach((point, displayIndex) => {
        const originalIndex = route.normalizedPoints.indexOf(point);
        // ✅ Читаємо розрахований рівень аномалії
        const isAnomaly = point.anomalyLevel || null;
        
        const icon = createMarkerIcon(displayIndex, pointsToRender.length, isAnomaly);
        
        const marker = L.marker([point.latitude, point.longitude], { 
            icon: icon, 
            draggable: true,
            originalIndex: originalIndex 
        });

        // ✅ Розширений попап
        const timeStr = new Date(point.timestamp).toLocaleString('uk-UA');
        let popupContent = `
            <div style="font-size:1.1em; margin-bottom:5px;"><b>Точка №${displayIndex + 1}</b></div>
            <div><i class="fa-regular fa-clock"></i> ${timeStr}</div>
        `;

        if (point.timingInfo) {
            const { expected, actual, diff, percent } = point.timingInfo;
            const color = percent > 0 ? 'red' : 'green';
            const sign = percent > 0 ? '+' : '';
            
            popupContent += `
                <hr style="margin:5px 0; border:0; border-top:1px solid #ccc;">
                <div style="display:grid; grid-template-columns: 1fr auto; gap:5px; font-size:0.95em;">
                    <span>Очікувано (OSRM):</span> <b>${formatDuration(expected)}</b>
                    <span>Фактично:</span> <b>${formatDuration(actual)}</b>
                    <span>Різниця:</span> <b style="color:${color}">${sign}${formatDuration(diff)}</b>
                    <span>Відхилення:</span> <b style="color:${color}">${sign}${percent}%</b>
                </div>
            `;
        }

        if (point.originalData) {
            popupContent += `<hr style="margin:5px 0;"><div style="font-size:0.85em; color:#666;">`;
            for (const key in point.originalData) {
                popupContent += `<div>${key}: ${point.originalData[key]}</div>`;
            }
            popupContent += `</div>`;
        }

        marker.bindPopup(popupContent);

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
    
    // Малювання лінії (беремо з кешу OSRM, якщо є)
    let polyline = null;
    if (pointsToRender.length > 1) {
        // Якщо OSRM координати є і ми не фільтруємо (бо фільтр ламає цілісність лінії OSRM), використовуємо їх
        // Якщо фільтр активний - малюємо прямі лінії між видимими точками
        let geometry = [];
        
        const isFiltered = (dateFilter && dateFilter.size > 0 && !route.isLocked);
        
        if (!isFiltered && route.osrmCoordinates && route.osrmCoordinates.length > 0) {
            geometry = route.osrmCoordinates;
        } else {
            // Прямі лінії
            geometry = pointsToRender.map(p => [p.latitude, p.longitude]);
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

    renderedLayers.set(route.id, { markers, polyline });
}

// ... (clearRouteLayers, clearAllMarkers, highlightSegment без суттєвих змін) ...
export function highlightSegment(routeId, originalIndex) {
    const layers = renderedLayers.get(routeId);
    if (!layers || !layers.markers) return;
    const marker = layers.markers.find(m => m.options.originalIndex === originalIndex);
    if (marker) {
        if (markerClusterGroup.hasLayer(marker)) markerClusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
        else { currentMapInstance.setView(marker.getLatLng(), 15); marker.openPopup(); }
    }
}
export function clearRouteLayers(routeId) {
    if (renderedLayers.has(routeId)) {
        const layers = renderedLayers.get(routeId);
        if (layers.markers) layers.markers.forEach(m => { markerClusterGroup.removeLayer(m); nonClusteredMarkersLayer.removeLayer(m); });
        if (layers.polyline) currentMapInstance?.removeLayer(layers.polyline);
        renderedLayers.delete(routeId);
    }
}
export function clearAllMarkers() {
    markerClusterGroup.clearLayers();
    nonClusteredMarkersLayer.clearLayers();
    for (const layers of renderedLayers.values()) if (layers.polyline) currentMapInstance?.removeLayer(layers.polyline);
    renderedLayers.clear();
}