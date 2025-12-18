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
    // Повний рендер (використовується при завантаженні файлів, зміні фільтрів, видаленні маршрутів)
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

// Обробник переміщення точки (оновлює тільки геометрію для швидкодії)
async function handlePointMove(routeId, originalIndex, newLat, newLng) {
    const route = store.routes.get(routeId);
    if (!route) return;

    // 1. Оновлюємо дані в Store
    if (route.normalizedPoints[originalIndex]) {
        route.normalizedPoints[originalIndex].latitude = newLat;
        route.normalizedPoints[originalIndex].longitude = newLng;
        
        console.log(`Точку ${originalIndex + 1} оновлено. Перебудова геометрії...`);
        
        // 2. Часткове оновлення карти (тільки лінія)
        await mapService.refreshRouteGeometry(store, routeId);

        // 3. Оновлення деталей у сайдбарі
        updateDetails(); 
    }
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

// Логіка вибору дат (Ctrl/Cmd замість Shift)
function handleDateFilter(date, event) {
    // Використовуємо ctrlKey (Windows/Linux) або metaKey (macOS Command)
    if (event.ctrlKey || event.metaKey) {
        store.globalDateFilter.has(date) ? store.globalDateFilter.delete(date) : store.globalDateFilter.add(date);
    } else {
        // Звичайний клік - вибираємо одну дату, повторний клік - знімаємо виділення
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

document.addEventListener('DOMContentLoaded', () => {
    map = initializeMap();
    mapService.init(map);
    cameraRenderer.setMapInstance(map);
    
    initCameraPanel(map);

    const ui = getElements();

    ui.sidebarToggleBtn.onclick = () => {
        ui.sidebar.classList.toggle('collapsed');
        setTimeout(() => map.invalidateSize(), 300);
    };

    const toggleRightSidebar = () => {
        const isOpen = ui.sidebarRight.classList.contains('open');
        if (isOpen) {
            ui.sidebarRight.classList.remove('open');
            if(ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        } else {
            ui.sidebarRight.classList.add('open');
            if(ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '»'; 
        }
    };

    if (ui.sidebarRightToggleBtn) {
        ui.sidebarRightToggleBtn.onclick = toggleRightSidebar;
    }

    if (ui.closeCameraPanelBtn) {
        ui.closeCameraPanelBtn.onclick = () => {
            ui.sidebarRight.classList.remove('open');
            if (ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        };
    }

    if (ui.selectFilesBtn) {
        ui.selectFilesBtn.onclick = () => ui.fileInput.click();
    }

    ui.fileInput.onchange = async (e) => {
        for(const f of e.target.files) await fileService.processFile(f, store, {
            renderAll: () => updateApp(),
            onSelect: selectRoute,
            onResetFilter: () => store.globalDateFilter.clear()
        });
        e.target.value = '';
    };

    // Drag & Drop
    const dropOverlay = document.getElementById('global-drop-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dropOverlay.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) dropOverlay.classList.add('hidden');
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.classList.add('hidden');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for(const f of e.dataTransfer.files) {
                await fileService.processFile(f, store, {
                    renderAll: () => updateApp(),
                    onSelect: selectRoute,
                    onResetFilter: () => store.globalDateFilter.clear()
                });
            }
        }
    });

    if(ui.dropArea) {
        ui.dropArea.ondragover = (e) => { e.preventDefault(); ui.dropArea.classList.add('highlight'); };
        ui.dropArea.ondragleave = () => ui.dropArea.classList.remove('highlight');
        ui.dropArea.ondrop = async (e) => { e.preventDefault(); ui.dropArea.classList.remove('highlight'); };
    }

    // Modal Overlay
    const overlay = ui.modalOverlay;
    const toggleOverlayBtn = document.getElementById('toggle-overlay-btn');

    if (toggleOverlayBtn && overlay) {
        overlay.classList.add('transparent');
        toggleOverlayBtn.checked = false;

        toggleOverlayBtn.addEventListener('change', (e) => {
            if (e.target.checked) {
                overlay.classList.remove('transparent');
                overlay.classList.add('dimmed');
            } else {
                overlay.classList.remove('dimmed');
                overlay.classList.add('transparent');
            }
        });
        
        overlay.addEventListener('click', () => {
            if (overlay.classList.contains('dimmed')) ui.closeModalBtn.click();
        });
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
    
    ui.closeModalBtn.onclick = () => ui.modalContainer.classList.add('hidden');

    if(ui.toggleClustering) ui.toggleClustering.onchange = () => {
        store.isClusteringEnabled = ui.toggleClustering.checked;
        updateApp();
    };
    if(ui.vehicleSelect) ui.vehicleSelect.onchange = () => {
        store.vehicleType = ui.vehicleSelect.value;
        updateApp();
    };

    // ✅ НОВЕ: Обробка налаштувань аномалій
    const warnInput = document.getElementById('anomaly-warning-input');
    const dangerInput = document.getElementById('anomaly-danger-input');

    if (warnInput) {
        warnInput.value = store.anomalyThresholds.warning;
        warnInput.onchange = (e) => {
            store.anomalyThresholds.warning = Number(e.target.value);
            // Швидке оновлення аналітики без запитів до OSRM
            mapService.updateAnalyticsOnly(store);
        };
    }
    
    if (dangerInput) {
        dangerInput.value = store.anomalyThresholds.danger;
        dangerInput.onchange = (e) => {
            store.anomalyThresholds.danger = Number(e.target.value);
            mapService.updateAnalyticsOnly(store);
        };
    }
    
    window.reloadCameras = async (filters, clusteringOverride = null) => {
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
    };

    updateApp();
});