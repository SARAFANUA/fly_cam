// js/main.js
import { initializeMap } from './map/mapInitializer.js';
import * as markerRenderer from './map/markerRenderer.js';
import * as cameraRenderer from './map/cameraRenderer.js';
import { fetchCameras } from './api/camerasApi.js';
import { initCameraPanel } from './ui/cameraPanel.js';
import { anomalyService } from './services/anomalyService.js';

import { store } from './state/store.js';
import { getElements, showMessage } from './ui/dom.js';
import { mapService } from './services/mapService.js';
import { fileService } from './services/fileService.js';
import { sidebarUI } from './ui/sidebarUI.js';

let map;

async function updateApp() {
    // Передаємо колбек handlePointMove у renderAll
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

// Функція обробки переміщення точки (оновлює дані і перемальовує)
async function handlePointMove(routeId, originalIndex, newLat, newLng) {
    const route = store.routes.get(routeId);
    if (!route) return;

    if (route.normalizedPoints[originalIndex]) {
        route.normalizedPoints[originalIndex].latitude = newLat;
        route.normalizedPoints[originalIndex].longitude = newLng;
        
        console.log(`Точку ${originalIndex + 1} оновлено. Перебудова маршруту...`);
        await updateApp();
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

// 1. ОНОВЛЕНА ФУНКЦІЯ ФІЛЬТРУ (Ctrl замість Shift)
function handleDateFilter(date, event) {
    // Використовуємо ctrlKey (Windows/Linux) або metaKey (Command на Mac)
    if (event.ctrlKey || event.metaKey) {
        store.globalDateFilter.has(date) 
            ? store.globalDateFilter.delete(date) 
            : store.globalDateFilter.add(date);
    } else {
        // Звичайний клік - вибір однієї дати
        if (store.globalDateFilter.has(date) && store.globalDateFilter.size === 1) {
            store.globalDateFilter.clear(); // Клік по активній - зняти виділення
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

    // 1. ЛІВИЙ САЙДБАР
    ui.sidebarToggleBtn.onclick = () => {
        ui.sidebar.classList.toggle('collapsed');
        setTimeout(() => map.invalidateSize(), 300);
    };

    // 2. ПРАВИЙ САЙДБАР (Камери)
    const toggleRightSidebar = () => {
        const isOpen = ui.sidebarRight.classList.contains('open');
        
        if (isOpen) {
            // Закриваємо
            ui.sidebarRight.classList.remove('open');
            if(ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        } else {
            // Відкриваємо
            ui.sidebarRight.classList.add('open');
            if(ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '»'; 
            
            // Якщо потрібно оновити камери при відкритті (опціонально)
            // if (typeof window.reloadCameras === 'function') window.reloadCameras(currentFilters);
        }
    };

    if (ui.sidebarRightToggleBtn) {
        ui.sidebarRightToggleBtn.onclick = toggleRightSidebar;
    }

    // Закриття правого сайдбару через хрестик всередині
    if (ui.closeCameraPanelBtn) {
        ui.closeCameraPanelBtn.onclick = () => {
            ui.sidebarRight.classList.remove('open');
            if (ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        };
    }

    // 3. ФАЙЛИ (Кнопка + Input)
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

    // 4. ГЛОБАЛЬНИЙ DRAG & DROP
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

    // Локальна зона дропу (для сумісності)
    if(ui.dropArea) {
        ui.dropArea.ondragover = (e) => { e.preventDefault(); ui.dropArea.classList.add('highlight'); };
        ui.dropArea.ondragleave = () => ui.dropArea.classList.remove('highlight');
        ui.dropArea.ondrop = async (e) => {
            e.preventDefault(); ui.dropArea.classList.remove('highlight');
        };
    }

    // 5. МОДАЛКА (Затемнення)
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
    
    const close = () => ui.modalContainer.classList.add('hidden');
    ui.closeModalBtn.onclick = close;

    // Налаштування
    if(ui.toggleClustering) ui.toggleClustering.onchange = () => {
        store.isClusteringEnabled = ui.toggleClustering.checked;
        updateApp();
    };
    if(ui.vehicleSelect) ui.vehicleSelect.onchange = () => {
        store.vehicleType = ui.vehicleSelect.value;
        updateApp();
    };
    
    // Глобальна функція для камер (викликається з cameraPanel.js)
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