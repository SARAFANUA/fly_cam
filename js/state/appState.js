// js/state/appState.js

export const appState = {
    routes: new Map(),
    routeColorMap: new Map(),
    activeRouteId: null,
    isClusteringEnabled: true,
    globalDateFilter: new Set(),
    vehicleType: 'car',
    
    // Метод для очищення всього
    reset() {
        this.routes.clear();
        this.routeColorMap.clear();
        this.activeRouteId = null;
        this.globalDateFilter.clear();
    }
};