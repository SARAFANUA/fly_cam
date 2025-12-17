// js/main.js
import { initializeMap } from './map/mapInitializer.js';
import * as markerRenderer from './map/markerRenderer.js';
import * as cameraRenderer from './map/cameraRenderer.js';
import { fetchCameras } from './api/camerasApi.js';
import { initCameraPanel } from './ui/cameraPanel.js';

import { store } from './state/store.js';
import { getElements, showMessage } from './ui/dom.js';
import { mapService } from './services/mapService.js';
import { fileService } from './services/fileService.js';
import { sidebarUI } from './ui/sidebarUI.js';

let map;

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
}

function updateDetails() {
    const ui = getElements();
    sidebarUI.renderPoints(ui, store, {
        onPointClick: (rid, idx) => markerRenderer.highlightSegment(rid, idx)
    });
}

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

document.addEventListener('DOMContentLoaded', () => {
    map = initializeMap();
    mapService.init(map);
    cameraRenderer.setMapInstance(map);
    
    // Ініціалізація панелі камер (з BBOX логікою та слухачами карти)
    initCameraPanel(map);

    const ui = getElements();

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

    ui.openModalBtn.onclick = () => {
        if(!store.activeRouteId) return;
        ui.modalTitle.textContent = store.routes.get(store.activeRouteId).fileName;
        ui.modalBody.innerHTML = ''; 
        const cloneSummary = ui.pointsSummary.cloneNode(true);
        const cloneList = ui.pointsList.cloneNode(true);
        ui.modalBody.append(cloneSummary, cloneList);
        
        ui.modalContainer.classList.remove('hidden');
        ui.modalOverlay.classList.remove('hidden');
    };
    
    const close = () => {
        ui.modalContainer.classList.add('hidden');
        ui.modalOverlay.classList.add('hidden');
    };
    ui.closeModalBtn.onclick = close;
    ui.modalOverlay.onclick = close;

    if(ui.toggleClustering) ui.toggleClustering.onchange = () => {
        store.isClusteringEnabled = ui.toggleClustering.checked;
        updateApp();
    };
    if(ui.vehicleSelect) ui.vehicleSelect.onchange = () => {
        store.vehicleType = ui.vehicleSelect.value;
        updateApp();
    };
    
    // Глобальна функція, яку викликає cameraPanel.js
    window.reloadCameras = async (filters, clusteringOverride = null) => {
        try {
            // Запит камер (bbox передається у filters)
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
            
            // Оновлюємо підказку про кількість
            const hint = document.getElementById('camera-panel-hint');
            if(hint) {
                // Якщо є bbox, додаємо уточнення для користувача
                const suffix = filters.bbox ? ' (у видимій області)' : '';
                hint.textContent = `Знайдено камер: ${items.length}${suffix}`;
            }
            
        } catch (e) {
            console.error("Помилка завантаження камер:", e);
            showMessage("Не вдалося завантажити камери", "error");
        }
    };

    updateApp();
});