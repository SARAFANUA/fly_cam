import { initializeMap } from './map/mapInitializer.js';
import * as markerRenderer from './map/markerRenderer.js';
import * as cameraRenderer from './map/cameraRenderer.js';
import { initModeSwitcher } from './utils/modeSwitcher.js';
import { initCameraFilters } from './ui/cameraFilters.js';
import { fetchCameras } from './api/camerasApi.js';
import { initCameraModal } from './ui/cameraModal.js';

// Нові модулі
import { store } from './state/store.js';
import { getElements, showMessage } from './ui/dom.js';
import { mapService } from './services/mapService.js';
import { fileService } from './services/fileService.js';
import { sidebarUI } from './ui/sidebarUI.js';

let map;

// --- Основна логіка оновлення ---
async function updateApp() {
    await mapService.renderAll(store);
    
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
    ui.openModalBtn.disabled = !store.activeRouteId;
}

function updateDetails() {
    const ui = getElements();
    sidebarUI.renderPoints(ui, store, {
        onPointClick: (rid, idx) => markerRenderer.highlightSegment(rid, idx)
    });
}

// --- Controller Actions ---

function selectRoute(id) {
    store.activeRouteId = id;
    updateApp();
    const route = store.routes.get(id);
    if(store.globalDateFilter.size > 0) mapService.zoomToFiltered(route, store.globalDateFilter);
    else mapService.zoomToRoute(route);
}

function removeRoute(id) {
    store.routes.delete(id);
    store.routeColorMap.delete(id);
    if(store.activeRouteId === id) store.activeRouteId = null;
    if(store.routes.size === 0) store.globalDateFilter.clear();
    updateApp();
}

function handleDateFilter(date, event) {
    if (event.shiftKey) {
        store.globalDateFilter.has(date) ? store.globalDateFilter.delete(date) : store.globalDateFilter.add(date);
    } else {
        if (store.globalDateFilter.has(date) && store.globalDateFilter.size === 1) store.globalDateFilter.clear();
        else { store.globalDateFilter.clear(); store.globalDateFilter.add(date); }
    }
    
    updateApp();
    if (store.activeRouteId) {
        mapService.zoomToFiltered(store.routes.get(store.activeRouteId), store.globalDateFilter);
    }
    
    const msg = store.globalDateFilter.size > 0 ? `Фільтр: ${store.globalDateFilter.size} дат` : 'Фільтр скинуто';
    showMessage(msg, 'info', () => { store.globalDateFilter.clear(); updateApp(); });
}

// --- Ініціалізація ---

document.addEventListener('DOMContentLoaded', () => {
    map = initializeMap();
    mapService.init(map);
    cameraRenderer.setMapInstance(map);
    initModeSwitcher(map);
    initCameraModal(map);

    const ui = getElements();

    // Події
    ui.sidebarToggleBtn.onclick = () => {
        ui.sidebar.classList.toggle('collapsed');
        setTimeout(() => map.invalidateSize(), 300);
    };

    ui.fileInput.onchange = async (e) => {
        for(const f of e.target.files) await fileService.processFile(f, store, {
            renderAll: updateApp,
            onSelect: selectRoute,
            onResetFilter: () => store.globalDateFilter.clear()
        });
        e.target.value = '';
    };

    // Drag & Drop
    if(ui.dropArea) {
        ui.dropArea.ondragover = (e) => { e.preventDefault(); ui.dropArea.classList.add('highlight'); };
        ui.dropArea.ondragleave = () => ui.dropArea.classList.remove('highlight');
        ui.dropArea.ondrop = async (e) => {
            e.preventDefault(); ui.dropArea.classList.remove('highlight');
            for(const f of e.dataTransfer.files) await fileService.processFile(f, store, {
                renderAll: updateApp,
                onSelect: selectRoute,
                onResetFilter: () => store.globalDateFilter.clear()
            });
        };
        ui.dropArea.querySelector('button').onclick = () => ui.fileInput.click();
    }

    // Modal
    ui.openModalBtn.onclick = () => {
        if(!store.activeRouteId) return;
        ui.modalTitle.textContent = store.routes.get(store.activeRouteId).fileName;
        ui.modalBody.innerHTML = ''; 
        // Клон списку для модалки
        const cloneSummary = ui.pointsSummary.cloneNode(true);
        const cloneList = ui.pointsList.cloneNode(true);
        ui.modalBody.append(cloneSummary, cloneList);
        
        // Відновлення подій в модалці (спрощено)
        // ...Тут можна додати логіку повторного навішування подій, або використовувати делегування
        
        ui.modalContainer.classList.remove('hidden');
        ui.modalOverlay.classList.remove('hidden');
    };
    
    const close = () => ui.modalContainer.classList.add('hidden');
    ui.closeModalBtn.onclick = close;
    ui.modalOverlay.onclick = close;

    // Налаштування
    if(ui.toggleClustering) ui.toggleClustering.onchange = () => {
        store.isClusteringEnabled = ui.toggleClustering.checked;
        updateApp();
    };
    if(ui.vehicleSelect) ui.vehicleSelect.onchange = () => {
        store.vehicleType = ui.vehicleSelect.value;
        updateApp();
    };
    
    // Камери (інтеграція старого коду)
    // Глобальна функція для перезавантаження камер
    // Додаємо аргумент clusteringOverride
    window.reloadCameras = async (filters, clusteringOverride = null) => {
        const data = await fetchCameras({ ...filters, limit: 10000 });
        const items = data?.items || [];
        
        // Якщо передали явне значення кластеризації - беремо його, 
        // інакше питаємо у рендерера поточний стан
        let isClustering;
        if (clusteringOverride !== null && clusteringOverride !== undefined) {
            isClustering = clusteringOverride;
        } else {
            const state = cameraRenderer.getState();
            isClustering = state.isClusteringEnabled;
        }

        cameraRenderer.renderCameras(items, isClustering);
    };
    

    updateApp();
});