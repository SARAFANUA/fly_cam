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

        // Дефолтні налаштування аномалій, якщо їх немає в store
        const thresholds = store.anomalyThresholds || { timeWarning: 40, timeDanger: 120 };

        for (const route of store.routes.values()) {
            const color = colorUtils.getRouteColor(route.id);
            store.routeColorMap.set(route.id, color);

            if (route.isVisible) {
                // 1. Отримуємо дані маршруту (OSRM), якщо їх немає
                if (!route.osrmCoordinates || !route.osrmLegs) {
                    try {
                        const latLngs = route.normalizedPoints.map(p => [p.latitude, p.longitude]);
                        // Запит до OSRM
                        const data = await getRouteData(latLngs, store.vehicleType);
                        
                        if (data) {
                            route.osrmCoordinates = data.coordinates;
                            route.osrmLegs = data.legs;
                        }
                    } catch (e) {
                        console.error(`Error calculating route for ${route.fileName}:`, e);
                    }
                }

                // 2. Рахуємо аномалії (передаємо маршрут і пороги)
                if (anomalyService) {
                    anomalyService.calculate(route, thresholds);
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
            // Скидаємо кеш OSRM, щоб перерахувати маршрут для нової геометрії
            route.osrmCoordinates = null; 
            route.osrmLegs = null;
        }
        await this.renderAll(store, onPointMove); 
    },

    // Цей метод викликається кнопкою "Оновити дані" в панелі Аномалій
    async updateAnalyticsOnly(store) {
        // Очищаємо, щоб перемалювати кольори
        markerRenderer.clearAllMarkers();
        
        const visibleRoutes = Array.from(store.routes.values()).filter(r => r.isVisible);
        let index = 0;
        
        const thresholds = store.anomalyThresholds || { timeWarning: 40, timeDanger: 120 };

        for (const route of store.routes.values()) {
             if (route.isVisible) {
                // Перераховуємо статуси точок (high/medium/normal)
                if (anomalyService) {
                    anomalyService.calculate(route, thresholds);
                }
                
                const color = store.routeColorMap.get(route.id);
                
                // Рендеримо заново (щоб маркери змінили колір, якщо треба)
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