// js/controllers/appController.js
import { store } from '../state/store.js';
import { getElements, showMessage } from '../ui/dom.js';
import { mapService } from '../services/mapService.js';
import { sidebarUI } from '../ui/sidebarUI.js';
import * as markerRenderer from '../map/markerRenderer.js';
import { fetchCameras } from '../api/camerasApi.js';
import * as cameraRenderer from '../map/cameraRenderer.js';

export async function updateApp() {
    // Повний рендер
    await mapService.renderAll(store, handlePointMove);
    
    const ui = getElements();
    
    sidebarUI.renderRoutes(ui.routeList, store, {
        onSelect: selectRoute,
        onLock: id => { 
            const r = store.routes.get(id); 
            if(r) { r.isLocked = !r.isLocked; updateApp(); } 
        },
        onToggle: id => { 
            const r = store.routes.get(id); 
            if(r) { r.isVisible = !r.isVisible; updateApp(); } 
        },
        onRemove: removeRoute
    });

    sidebarUI.renderDates(ui.uniqueDatesList, store, {
        onDateClick: handleDateFilter
    });

    updateDetails();
}

// ✅ ВИПРАВЛЕНО: Передаємо handlePointMove у refreshRouteGeometry
export async function handlePointMove(routeId, originalIndex, newLat, newLng) {
    const route = store.routes.get(routeId);
    if (!route) return;

    if (route.normalizedPoints[originalIndex]) {
        route.normalizedPoints[originalIndex].latitude = newLat;
        route.normalizedPoints[originalIndex].longitude = newLng;
        
        console.log(`Точку ${originalIndex + 1} оновлено. Перебудова геометрії...`);
        
        // Передаємо посилання на саму цю функцію, щоб нові маркери отримали обробник
        await mapService.refreshRouteGeometry(store, routeId, handlePointMove);

        updateDetails(); 
    }
}

export function updateDetails() {
    const ui = getElements();
    sidebarUI.renderPoints(ui, store, {
        onPointClick: (rid, idx) => markerRenderer.highlightSegment(rid, idx)
    });
}

export function selectRoute(id) {
    store.activeRouteId = id;
    updateApp();
    const route = store.routes.get(id);
    if(store.globalDateFilter.size > 0) mapService.zoomToFiltered(route, store.globalDateFilter);
    else mapService.zoomToRoute(route);
}

export function removeRoute(id) {
    store.routes.delete(id);
    store.routeColorMap.delete(id);
    if(store.activeRouteId === id) store.activeRouteId = null;
    if(store.routes.size === 0) store.globalDateFilter.clear();
    updateApp();
}

export function handleDateFilter(date, event) {
    if (event.ctrlKey || event.metaKey) {
        store.globalDateFilter.has(date) ? store.globalDateFilter.delete(date) : store.globalDateFilter.add(date);
    } else {
        if (store.globalDateFilter.has(date) && store.globalDateFilter.size === 1) {
            store.globalDateFilter.clear();
        } else { 
            store.globalDateFilter.clear(); 
            store.globalDateFilter.add(date); 
        }
    }
    updateApp();
    if (store.activeRouteId) {
        mapService.zoomToFiltered(store.routes.get(store.activeRouteId), store.globalDateFilter);
    }
    const msg = store.globalDateFilter.size > 0 ? `Фільтр: ${store.globalDateFilter.size} дат` : 'Фільтр скинуто';
    showMessage(msg, 'info', () => { store.globalDateFilter.clear(); updateApp(); });
}

export async function reloadCameras(filters, clusteringOverride = null) {
    try {
        const data = await fetchCameras({ ...filters, limit: 10000 });
        const items = data?.items || [];
        
        let isClustering;
        if (clusteringOverride !== null && clusteringOverride !== undefined) {
            isClustering = clusteringOverride;
        } else {
            const state = cameraRenderer.getState();
            isClustering = state.isClusteringEnabled;
        }

        cameraRenderer.renderCameras(items, isClustering);
        
        const hint = document.getElementById('camera-panel-hint');
        if(hint) {
            const suffix = filters.bbox ? ' (у видимій області)' : '';
            hint.textContent = `Знайдено камер: ${items.length}${suffix}`;
        }
    } catch (e) {
        console.error("Помилка завантаження камер:", e);
        showMessage("Не вдалося завантажити камери", "error");
    }
}