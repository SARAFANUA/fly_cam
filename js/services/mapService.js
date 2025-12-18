// js/services/mapService.js
import * as markerRenderer from '../map/markerRenderer.js';
import * as colorUtils from '../utils/colorUtils.js';
import { getRouteData } from '../api/routingService.js'; // Змінено імпорт
import { anomalyService } from './anomalyService.js'; // Підключено сервіс

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
                // 1. Отримуємо дані маршруту (якщо їх немає)
                if (!route.osrmCoordinates || !route.osrmLegs) {
                    const latLngs = route.normalizedPoints.map(p => [p.latitude, p.longitude]);
                    const data = await getRouteData(latLngs, store.vehicleType);
                    
                    route.osrmCoordinates = data.coordinates;
                    route.osrmLegs = data.legs;
                }

                // 2. Рахуємо аномалії
                if (anomalyService) {
                    anomalyService.calculate(route, store.anomalyThresholds || { warning: 20, danger: 100 });
                }

                // 3. Рендеримо
                await markerRenderer.renderMarkers(
                    route, 
                    this.map, 
                    color, 
                    store.isClusteringEnabled, 
                    store.globalDateFilter, 
                    { index, total: visibleRoutes.length }, 
                    store.vehicleType,
                    onPointMove
                );
                index++;
            }
        }
    },

    async refreshRouteGeometry(store, routeId, onPointMove) {
        const route = store.routes.get(routeId);
        if(route) {
            route.osrmCoordinates = null; 
            route.osrmLegs = null;
        }
        await this.renderAll(store, onPointMove); 
    },

    async updateAnalyticsOnly(store) {
        markerRenderer.clearAllMarkers();
        const visibleRoutes = Array.from(store.routes.values()).filter(r => r.isVisible);
        let index = 0;

        for (const route of store.routes.values()) {
             if (route.isVisible) {
                if (anomalyService) anomalyService.calculate(route, store.anomalyThresholds);
                const color = store.routeColorMap.get(route.id);
                
                await markerRenderer.renderMarkers(
                    route, this.map, color, store.isClusteringEnabled, 
                    store.globalDateFilter, { index, total: visibleRoutes.length },
                    store.vehicleType,
                    null
                );
                index++;
             }
        }
    },
    
    // Zoom методи без змін
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