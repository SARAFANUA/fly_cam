import * as markerRenderer from '../map/markerRenderer.js';
import * as colorUtils from '../utils/colorUtils.js';

export const mapService = {
    map: null,

    init(mapInstance) {
        this.map = mapInstance;
        markerRenderer.setMapInstance(mapInstance);
    },

    async renderAll(store) {
        markerRenderer.clearAllMarkers();
        store.routeColorMap.clear();

        const visibleRoutes = Array.from(store.routes.values()).filter(r => r.isVisible);
        let index = 0;

        for (const route of store.routes.values()) {
            const color = colorUtils.getRouteColor(route.id);
            store.routeColorMap.set(route.id, color);

            if (route.isVisible) {
                await markerRenderer.renderMarkers(
                    route, this.map, color, 
                    store.isClusteringEnabled, 
                    store.globalDateFilter, 
                    { index, total: visibleRoutes.length }, 
                    store.vehicleType
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