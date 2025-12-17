export const store = {
    routes: new Map(),
    routeColorMap: new Map(),
    activeRouteId: null,
    isClusteringEnabled: true,
    globalDateFilter: new Set(),
    vehicleType: 'car',

    reset() {
        this.routes.clear();
        this.routeColorMap.clear();
        this.activeRouteId = null;
        this.globalDateFilter.clear();
    }
};