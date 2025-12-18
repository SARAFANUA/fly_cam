// js/state/store.js
export const store = {
    routes: new Map(),
    routeColorMap: new Map(),
    activeRouteId: null,
    isClusteringEnabled: true,
    globalDateFilter: new Set(),
    vehicleType: 'car',
    
    // ✅ Нові налаштування аналітики
    anomalyThresholds: {
        warning: 20, // % перевищення часу (жовтий)
        danger: 100  // % перевищення часу (червоний)
    },

    reset() {
        this.routes.clear();
        this.routeColorMap.clear();
        this.activeRouteId = null;
        this.globalDateFilter.clear();
    }
};