// js/map/markerRenderer.js

import { getRoute } from '../api/routingService.js';

let currentMapInstance;
const renderedLayers = new Map();
let highlightLayer = null;
let currentlyHighlighted = null;

const markerClusterGroup = L.markerClusterGroup();
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

export async function renderMarkers(route, map, routeColor, isClusteringEnabled, dateFilter = new Set(), renderOrder = { index: 0, total: 1 }, vehicleType = 'car') {
    if (!route || !route.normalizedPoints || route.normalizedPoints.length === 0) {
        return;
    }

    clearRouteLayers(route.id);
    
    let pointsForMarkers = route.normalizedPoints;

    // --- ОСНОВНА ЗМІНА ТУТ ---
    // Фільтруємо по набору дат, якщо маршрут не "заблокований"
    if (dateFilter.size > 0 && !route.isLocked) {
        pointsForMarkers = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return dateFilter.has(pointDate); // Перевіряємо, чи є дата в наборі
        });
    }

    if (pointsForMarkers.length === 0) {
        return;
    }

    let pointsToRender = [...pointsForMarkers];

    if (!isClusteringEnabled && pointsToRender.length > 0) {
        const pointGroups = new Map();
        
        pointsToRender.forEach(point => {
            const key = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
            if (!pointGroups.has(key)) {
                pointGroups.set(key, []);
            }
            pointGroups.get(key).push(point);
        });

        const newPoints = [];
        const offsetRadiusMeters = 15;

        pointGroups.forEach(group => {
            if (group.length <= 1) {
                newPoints.push(...group);
            } else {
                const centerLat = group[0].latitude;
                const centerLng = group[0].longitude;
                
                const latOffset = offsetRadiusMeters / 111132;
                const lngOffset = offsetRadiusMeters / (111320 * Math.cos(centerLat * Math.PI / 180));

                group.forEach((point, index) => {
                    const angle = (2 * Math.PI / group.length) * index;
                    const newLat = centerLat + latOffset * Math.sin(angle);
                    const newLng = centerLng + lngOffset * Math.cos(angle);
                    
                    newPoints.push({ ...point, latitude: newLat, longitude: newLng });
                });
            }
        });
        pointsToRender = newPoints;
    }

    const markers = [];
    
    pointsToRender.forEach((point) => {
        const originalIndex = route.normalizedPoints.findIndex(p => p.timestamp === point.timestamp);
        let durationMs = 0;
        if (originalIndex > 0) {
            durationMs = new Date(point.timestamp).getTime() - new Date(route.normalizedPoints[originalIndex - 1].timestamp).getTime();
        }
        const isLongStop = durationMs > (5 * 60 * 1000);

        const lat = point.latitude;
        const lon = point.longitude;
        let markerColor = routeColor;
        let markerText = (originalIndex + 1).toString();
        if (originalIndex === 0) { markerColor = 'green'; markerText = 'S'; }
        if (originalIndex === route.normalizedPoints.length - 1) { markerColor = 'red'; markerText = 'E'; }
        
        const iconClasses = `custom-marker-icon ${isLongStop ? 'long-stop-marker' : ''}`;
        
        const customIcon = L.divIcon({
            className: iconClasses,
            html: `<div class="marker-pin" style="background-color: ${markerColor};"></div><div class="marker-number">${markerText}</div>`,
            iconSize: [32, 45], iconAnchor: [16, 45]
        });
        
        const marker = L.marker([lat, lon], { icon: customIcon, timestamp: point.timestamp });

        let popupContent = `<h4>Маршрут: ${route.fileName}</h4><ul>`;
        popupContent += `<li><strong>Точка №:</strong> ${originalIndex + 1}</li>`;
        if (point.originalData) {
            for (const key in point.originalData) {
                popupContent += `<li><strong>${key}:</strong> ${point.originalData[key]}</li>`;
            }
        }
        popupContent += `</ul>`;
        marker.bindPopup(popupContent);
        markers.push(marker);
    });

    if (isClusteringEnabled) {
        markerClusterGroup.addLayers(markers);
    } else {
        markers.forEach(marker => nonClusteredMarkersLayer.addLayer(marker));
    }
    
    if (pointsForMarkers.length > 1) {
        const maxWeight = 12;
        const minWeight = 4;
        const weightStep = (maxWeight - minWeight) / (renderOrder.total || 1);
        const weight = maxWeight - (renderOrder.index * weightStep);

        const roadLatLngs = await getRoute(pointsForMarkers.map(p => [p.latitude, p.longitude]), vehicleType);
        
        const polyline = L.polyline(roadLatLngs, { 
            color: routeColor, 
            weight: weight, 
            opacity: 0.85 
        }).addTo(map);
        
        const pointIndexMap = pointsForMarkers.map(p => findClosestPointIndex(L.latLng(p.latitude, p.longitude), roadLatLngs));

        polyline.options.fullGeometry = roadLatLngs;
        polyline.options.pointIndexMap = pointIndexMap;
        
        renderedLayers.set(route.id, { markers, polyline, originalPoints: route.normalizedPoints, filteredPoints: pointsForMarkers });
    } else {
        renderedLayers.set(route.id, { markers, originalPoints: route.normalizedPoints, filteredPoints: pointsForMarkers });
    }
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

export function highlightSegment(routeId, originalPointIndex) {
    const layers = renderedLayers.get(routeId);
    if (!layers || !layers.polyline || !layers.filteredPoints) return;

    const pointToHighlight = layers.originalPoints[originalPointIndex];
    const filteredPointIndex = layers.filteredPoints.findIndex(p => p.timestamp === pointToHighlight.timestamp);

    if (filteredPointIndex === -1 || filteredPointIndex >= layers.filteredPoints.length - 1) {
        resetHighlight();
        return;
    }

    if (currentlyHighlighted && currentlyHighlighted.routeId === routeId && currentlyHighlighted.pointIndex === originalPointIndex) {
        resetHighlight();
        return;
    }

    resetHighlight();

    const { polyline } = layers;
    const { fullGeometry, pointIndexMap } = polyline.options;
    
    renderedLayers.forEach((otherLayers, id) => {
        if (otherLayers.polyline) {
            const opacity = (id === routeId) ? 0.5 : 0.3;
            otherLayers.polyline.setStyle({ opacity });
        }
    });
    
    const geometryStartIndex = pointIndexMap[filteredPointIndex];
    const geometryEndIndex = pointIndexMap[filteredPointIndex + 1];
    
    if (geometryStartIndex === undefined || geometryEndIndex === undefined) return;
    
    const segmentGeometry = fullGeometry.slice(geometryStartIndex, geometryEndIndex + 1);

    highlightLayer = L.polyline(segmentGeometry, {
        color: '#FFFF00', weight: 8, opacity: 1.0, lineCap: 'round'
    }).addTo(currentMapInstance);
    highlightLayer.bringToFront();
    
    if (segmentGeometry.length > 0) {
        const bounds = L.latLngBounds(segmentGeometry);
        currentMapInstance.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
    }

    currentlyHighlighted = { routeId, pointIndex: originalPointIndex };
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