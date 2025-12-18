// js/services/mapService.js
import * as markerRenderer from '../map/markerRenderer.js';
import * as colorUtils from '../utils/colorUtils.js';
import { getRouteData } from '../api/routingService.js';
import { anomalyService } from './anomalyService.js';

export const mapService = {
    map: null,

    init(mapInstance) {
        this.map = mapInstance;
        markerRenderer.setMapInstance(mapInstance);
    },

    async renderAll(store, onPointMove) {
        markerRenderer.clearAllMarkers();
        store.routeColorMap.clear();

        const visibleRoutes = Array.from(store.routes.values()).filter(r => r.isVisible);
        let index = 0;

        for (const route of store.routes.values()) {
            const color = colorUtils.getRouteColor(route.id);
            store.routeColorMap.set(route.id, color);

            if (route.isVisible) {
                // ✅ 1. Отримуємо дані OSRM (якщо ще немає)
                if (!route.osrmCoordinates || !route.osrmLegs) {
                    const latLngs = route.normalizedPoints.map(p => [p.latitude, p.longitude]);
                    const osrmData = await getRouteData(latLngs, store.vehicleType);
                    
                    route.osrmCoordinates = osrmData.coordinates;
                    route.osrmLegs = osrmData.legs;
                }

                // ✅ 2. Розраховуємо аномалії (це миттєво)
                anomalyService.calculate(route, store.anomalyThresholds);

                // ✅ 3. Рендеримо
                await markerRenderer.renderMarkers(
                    route, 
                    this.map, 
                    color, 
                    store.isClusteringEnabled, 
                    store.globalDateFilter, 
                    { index, total: visibleRoutes.length }, 
                    onPointMove
                );
                index++;
            }
        }
    },

    // Метод для швидкого оновлення тільки аналітики (без запитів до мережі)
    async updateAnalyticsOnly(store) {
        markerRenderer.clearAllMarkers();
        
        const visibleRoutes = Array.from(store.routes.values()).filter(r => r.isVisible);
        let index = 0;

        for (const route of store.routes.values()) {
             if (route.isVisible) {
                // Перерахунок з новими порогами
                anomalyService.calculate(route, store.anomalyThresholds);
                
                const color = store.routeColorMap.get(route.id);
                // Рендер
                await markerRenderer.renderMarkers(
                    route, 
                    this.map, 
                    color, 
                    store.isClusteringEnabled, 
                    store.globalDateFilter, 
                    { index, total: visibleRoutes.length }
                    // onPointMove не обов'язковий при оновленні налаштувань
                );
                index++;
             }
        }
    },

    async refreshRouteGeometry(store, routeId) {
        // ... (код залишається, але треба скинути кеш OSRM при ручному русі точок)
        const route = store.routes.get(routeId);
        if(route) {
            route.osrmCoordinates = null; // Скидаємо кеш, щоб завантажити новий шлях
            route.osrmLegs = null;
        }
        // ... виклик renderAll або updateRoutePolyline ...
        // Для спрощення тут можна викликати повний renderAll
        this.renderAll(store); 
    },
    
    // ... zoomToRoute, zoomToFiltered ...
    zoomToRoute(route) {
        if (!route || !route.isVisible || route.normalizedPoints.length === 0) return;
        const latlngs = route.normalizedPoints.map(p => [p.latitude, p.longitude]);
        this.map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
    },
    zoomToFiltered(route, dateFilter) {
        if (!route || !route.isVisible) return;
        let points = route.normalizedPoints;
        if (dateFilter.size > 0 && !route.isLocked) {
            points = points.filter(p => dateFilter.has(new Date(p.timestamp).toLocaleDateString('uk-UA')));
        }
        if (points.length > 0) {
            const latlngs = points.map(p => [p.latitude, p.longitude]);
            this.map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], maxZoom: 17 });
        } else {
            this.zoomToRoute(route);
        }
    }
};