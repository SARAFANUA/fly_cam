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
// Імпорт для модального вікна
import { renderPointsList } from './ui/pointsListUI.js'; 

let map;

async function updateApp() {
    await mapService.renderAll(store, handlePointMove);
    
    const ui = getElements();
    
    sidebarUI.renderRoutes(ui.routeList, store, {
        onSelect: selectRoute,
        onLock: id => { const r = store.routes.get(id); if(r) { r.isLocked = !r.isLocked; updateApp(); } },
        onToggle: id => { const r = store.routes.get(id); if(r) { r.isVisible = !r.isVisible; updateApp(); } },
        onRemove: removeRoute
    });

    sidebarUI.renderDates(ui.uniqueDatesList, store, {
        onDateClick: handleDateFilter
    });

    updateDetails();
}

async function handlePointMove(routeId, originalIndex, newLat, newLng) {
    const route = store.routes.get(routeId);
    if (!route) return;

    if (route.normalizedPoints[originalIndex]) {
        route.normalizedPoints[originalIndex].latitude = newLat;
        route.normalizedPoints[originalIndex].longitude = newLng;
        console.log(`Точку ${originalIndex + 1} оновлено. Перебудова геометрії...`);
        await mapService.refreshRouteGeometry(store, routeId, handlePointMove);
        updateDetails(); 
    }
}

function updateDetails() {
    const ui = getElements();
    sidebarUI.renderPoints(ui, store, {
        // ✅ Передаємо vehicleType для коректного побудови маршруту сегмента
        onPointClick: (rid, idx) => markerRenderer.highlightSegment(rid, idx, store.vehicleType)
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
    if (event.ctrlKey || event.metaKey) {
        store.globalDateFilter.has(date) ? store.globalDateFilter.delete(date) : store.globalDateFilter.add(date);
    } else {
        if (store.globalDateFilter.has(date) && store.globalDateFilter.size === 1) store.globalDateFilter.clear();
        else { store.globalDateFilter.clear(); store.globalDateFilter.add(date); }
    }
    updateApp();
    if (store.activeRouteId) mapService.zoomToFiltered(store.routes.get(store.activeRouteId), store.globalDateFilter);
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

    if (ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.onclick = toggleRightSidebar;
    if (ui.closeCameraPanelBtn) ui.closeCameraPanelBtn.onclick = () => toggleRightSidebar();

    if (ui.selectFilesBtn) ui.selectFilesBtn.onclick = () => ui.fileInput.click();

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
        if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            dragCounter++;
            dropOverlay.classList.remove('hidden');
        }
    });

    window.addEventListener('dragleave', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) dropOverlay.classList.add('hidden');
        }
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

    // Модальне вікно: затемнення
    const overlay = ui.modalOverlay;
    const toggleOverlayBtn = document.getElementById('toggle-overlay-btn');

    if (toggleOverlayBtn && overlay) {
        overlay.classList.add('transparent');
        toggleOverlayBtn.checked = false;
        toggleOverlayBtn.addEventListener('change', (e) => {
            if (e.target.checked) { overlay.classList.remove('transparent'); overlay.classList.add('dimmed'); } 
            else { overlay.classList.remove('dimmed'); overlay.classList.add('transparent'); }
        });
        overlay.addEventListener('click', () => { if (overlay.classList.contains('dimmed')) ui.closeModalBtn.click(); });
    }

    ui.openModalBtn.onclick = () => {
        if(!store.activeRouteId) return;
        const route = store.routes.get(store.activeRouteId);
        
        ui.modalBody.innerHTML = ''; 
        // Скидаємо паддінги для таблиці
        ui.modalBody.style.padding = '0';

        const summaryContainer = document.createElement('div');
        // Клас не додаємо тут, бо він буде заданий всередині pointsListUI як хедер таблиці
        
        const listContainer = document.createElement('ul');
        listContainer.id = 'modal-points-list'; // Стилі в CSS

        ui.modalBody.append(summaryContainer, listContainer);

        renderPointsList(route, store, { 
            routeTitle: ui.modalTitle, 
            summary: summaryContainer, 
            list: listContainer 
        }, {
            // ✅ Передаємо vehicleType
            onPointClick: (rid, idx) => markerRenderer.highlightSegment(rid, idx, store.vehicleType)
        });
        
        ui.modalContainer.classList.remove('hidden');
        ui.modalOverlay.classList.remove('hidden');
    };
    
    ui.closeModalBtn.onclick = () => ui.modalContainer.classList.add('hidden');

    // Логіка переміщення (Drag) модального вікна
    const modalContent = document.getElementById('modal-content');
    const modalHeader = document.getElementById('modal-header');
    const resizer = document.getElementById('resizer'); 

    if (modalHeader && modalContent) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        modalHeader.onmousedown = (e) => {
            if (e.target.closest('button') || e.target.closest('.toggle-switch-small')) return;
            
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = modalContent.getBoundingClientRect();
            modalContent.style.transform = 'none';
            modalContent.style.left = rect.left + 'px';
            modalContent.style.top = rect.top + 'px';
            modalContent.style.margin = '0';
            
            startLeft = rect.left;
            startTop = rect.top;

            document.onmousemove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                modalContent.style.left = (startLeft + dx) + 'px';
                modalContent.style.top = (startTop + dy) + 'px';
            };

            document.onmouseup = () => {
                isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    // Логіка зміни розміру (Resize)
    if (resizer && modalContent) {
        let isResizing = false;
        let startW, startH, startX, startY;

        resizer.onmousedown = (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = modalContent.offsetWidth;
            startH = modalContent.offsetHeight;

            document.onmousemove = (e) => {
                if (!isResizing) return;
                const w = startW + (e.clientX - startX);
                const h = startH + (e.clientY - startY);
                if (w > 300) modalContent.style.width = w + 'px';
                if (h > 200) modalContent.style.height = h + 'px';
            };

            document.onmouseup = () => {
                isResizing = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    if(ui.toggleClustering) ui.toggleClustering.onchange = () => {
        store.isClusteringEnabled = ui.toggleClustering.checked;
        updateApp();
    };
    if(ui.vehicleSelect) ui.vehicleSelect.onchange = () => {
        store.vehicleType = ui.vehicleSelect.value;
        updateApp();
    };
    
    // Аномалії
    const warnInput = document.getElementById('anomaly-warning-input');
    const dangerInput = document.getElementById('anomaly-danger-input');

    if (warnInput) {
        warnInput.value = store.anomalyThresholds?.warning || 20;
        warnInput.onchange = (e) => {
            if(!store.anomalyThresholds) store.anomalyThresholds = {warning:20, danger:100};
            store.anomalyThresholds.warning = Number(e.target.value);
            mapService.updateAnalyticsOnly(store);
        };
    }
    
    if (dangerInput) {
        dangerInput.value = store.anomalyThresholds?.danger || 100;
        dangerInput.onchange = (e) => {
            if(!store.anomalyThresholds) store.anomalyThresholds = {warning:20, danger:100};
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