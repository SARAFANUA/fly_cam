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

// Деталі (і в сайдбарі, і в модалці)
import { renderPointsList } from './ui/pointsListUI.js';

let map;

/** Panels (Ctrl multi-select) */
const activePanels = new Set(); // ids: "panel-details", "panel-routes", "panel-dates", "panel-anomalies"

function setSinglePanel(panelId) {
    activePanels.clear();
    activePanels.add(panelId);
}
function togglePanel(panelId) {
    if (activePanels.has(panelId)) activePanels.delete(panelId);
    else activePanels.add(panelId);
}

function syncPanelsUI() {
    const panelsRoot = document.getElementById('sidebar-panels');
    if (!panelsRoot) return;

    const allPanels = Array.from(panelsRoot.querySelectorAll('.panel'));
    const allButtons = Array.from(document.querySelectorAll('.filter-btn[data-panel]'));

    // show/hide
    allPanels.forEach(p => {
        const show = activePanels.has(p.id);
        p.classList.toggle('hidden', !show);
        p.style.flex = '';
        p.style.maxHeight = '';
    });

    // buttons state
    allButtons.forEach(b => b.classList.toggle('active', activePanels.has(b.dataset.panel)));

    // sizing
    const visible = allPanels.filter(p => !p.classList.contains('hidden'));
    if (visible.length === 0) return;

    if (visible.length === 1) {
        const p = visible[0];
        const available = panelsRoot.clientHeight || 0;
        p.style.flex = '0 0 auto';
        const desired = p.scrollHeight;
        const maxH = available > 0 ? Math.min(desired, available) : desired;
        p.style.maxHeight = maxH + 'px';
    } else {
        visible.forEach(p => {
            p.style.flex = '1 1 0';
            p.style.maxHeight = '';
        });
    }
}

function bindPanelsUI() {
    // toolbar buttons
    document.querySelectorAll('.filter-btn[data-panel]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panelId = btn.dataset.panel;
            if (!panelId) return;

            const multi = e.ctrlKey || e.metaKey;
            if (multi) togglePanel(panelId);
            else setSinglePanel(panelId);

            if (activePanels.size === 0) activePanels.add(panelId);
            syncPanelsUI();
        });
    });

    // close buttons
    document.querySelectorAll('[data-close-panel]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-close-panel');
            if (!id) return;
            activePanels.delete(id);
            syncPanelsUI();
        });
    });

    // default panel
    if (activePanels.size === 0) activePanels.add('panel-details');
    syncPanelsUI();

    window.addEventListener('resize', () => syncPanelsUI());
}

/** Render / Update */
async function updateApp() {
    await mapService.renderAll(store, handlePointMove);

    const ui = getElements();

    // Routes
    sidebarUI.renderRoutes(ui.routeList, store, {
        onSelect: selectRoute,
        onLock: id => { const r = store.routes.get(id); if (r) { r.isLocked = !r.isLocked; updateApp(); } },
        onToggle: id => { const r = store.routes.get(id); if (r) { r.isVisible = !r.isVisible; updateApp(); } },
        onRemove: removeRoute
    });

    // Dates
    sidebarUI.renderDates(ui.uniqueDatesList, store, {
        onDateClick: handleDateFilter
    });

    // Details in sidebar
    renderDetailsInSidebar();

    syncPanelsUI();
}

async function handlePointMove(routeId, originalIndex, newLat, newLng) {
    const route = store.routes.get(routeId);
    if (!route) return;

    if (route.normalizedPoints[originalIndex]) {
        route.normalizedPoints[originalIndex].latitude = newLat;
        route.normalizedPoints[originalIndex].longitude = newLng;

        console.log(`Точку ${originalIndex + 1} оновлено. Перебудова геометрії...`);
        await mapService.refreshRouteGeometry(store, routeId, handlePointMove);

        renderDetailsInSidebar();
        syncPanelsUI();
    }
}

function renderDetailsInSidebar() {
    const list = document.getElementById('points-list-items');
    const summary = document.getElementById('points-list-summary');
    const routeTitle = document.getElementById('points-list-routename');

    if (!list || !summary || !routeTitle) return;

    if (!store.activeRouteId) {
        routeTitle.textContent = '';
        summary.innerHTML = '';
        list.innerHTML = `<li class="empty-list-item">Оберіть маршрут для перегляду</li>`;
        return;
    }

    const route = store.routes.get(store.activeRouteId);
    if (!route) {
        routeTitle.textContent = '';
        summary.innerHTML = '';
        list.innerHTML = `<li class="empty-list-item">Маршрут не знайдено</li>`;
        return;
    }

    // ✅ FIX: routeTitle більше не null (інакше pointsListUI може падати)
    renderPointsList(route, store, {
        routeTitle,
        summary,
        list
    }, {
        onPointClick: (rid, idx) => markerRenderer.highlightSegment(rid, idx, store.vehicleType)
    });
}

function selectRoute(id) {
    store.activeRouteId = id;
    updateApp();

    const route = store.routes.get(id);
    if (!route) return;

    if (store.globalDateFilter.size > 0) mapService.zoomToFiltered(route, store.globalDateFilter);
    else mapService.zoomToRoute(route);

    // UX: після вибору маршруту — показуємо деталі (якщо користувач не в Ctrl-моді)
    if (activePanels.size === 1 && !activePanels.has('panel-details')) {
        setSinglePanel('panel-details');
        syncPanelsUI();
    }
}

function removeRoute(id) {
    store.routes.delete(id);
    store.routeColorMap.delete(id);

    if (store.activeRouteId === id) store.activeRouteId = null;
    if (store.routes.size === 0) store.globalDateFilter.clear();

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

    if (store.activeRouteId) {
        mapService.zoomToFiltered(store.routes.get(store.activeRouteId), store.globalDateFilter);
    }

    const msg = store.globalDateFilter.size > 0 ? `Фільтр: ${store.globalDateFilter.size} дат` : 'Фільтр скинуто';
    showMessage(msg, 'info', () => { store.globalDateFilter.clear(); updateApp(); });
}

/** DOM Ready */
document.addEventListener('DOMContentLoaded', () => {
    map = initializeMap();
    mapService.init(map);
    cameraRenderer.setMapInstance(map);

    initCameraPanel(map);

    const ui = getElements();

    // LEFT SIDEBAR TOGGLE
    ui.sidebarToggleBtn.onclick = () => {
        ui.sidebar.classList.toggle('collapsed');
        setTimeout(() => map.invalidateSize(), 300);
    };

    // RIGHT SIDEBAR TOGGLE
    const toggleRightSidebar = () => {
        const isOpen = ui.sidebarRight.classList.contains('open');
        if (isOpen) {
            ui.sidebarRight.classList.remove('open');
            if (ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        } else {
            ui.sidebarRight.classList.add('open');
            if (ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.innerHTML = '»';
        }
    };

    if (ui.sidebarRightToggleBtn) ui.sidebarRightToggleBtn.onclick = toggleRightSidebar;
    if (ui.closeCameraPanelBtn) ui.closeCameraPanelBtn.onclick = () => toggleRightSidebar();

    // Clustering checkbox
    if (ui.toggleClustering) ui.toggleClustering.onchange = () => {
        store.isClusteringEnabled = ui.toggleClustering.checked;
        updateApp();
    };

    // vehicle
    if (ui.vehicleSelect) ui.vehicleSelect.onchange = () => {
        store.vehicleType = ui.vehicleSelect.value;
        updateApp();
    };

    // Panels UI
    bindPanelsUI();

    // FILE PICKER
    if (ui.selectFilesBtn) ui.selectFilesBtn.onclick = () => ui.fileInput.click();

    ui.fileInput.onchange = async (e) => {
        for (const f of e.target.files) {
            await fileService.processFile(f, store, {
                renderAll: () => updateApp(),
                onSelect: selectRoute,
                onResetFilter: () => store.globalDateFilter.clear()
            });
        }
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
        if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
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
            for (const f of e.dataTransfer.files) {
                await fileService.processFile(f, store, {
                    renderAll: () => updateApp(),
                    onSelect: selectRoute,
                    onResetFilter: () => store.globalDateFilter.clear()
                });
            }
        }
    });

    // Аномалії
    const warnInput = document.getElementById('anomaly-warning-input');
    const dangerInput = document.getElementById('anomaly-danger-input');

    if (warnInput) {
        warnInput.value = store.anomalyThresholds?.warning || 20;
        warnInput.onchange = (e) => {
            if (!store.anomalyThresholds) store.anomalyThresholds = { warning: 20, danger: 100 };
            store.anomalyThresholds.warning = Number(e.target.value);
            mapService.updateAnalyticsOnly(store);
        };
    }

    if (dangerInput) {
        dangerInput.value = store.anomalyThresholds?.danger || 100;
        dangerInput.onchange = (e) => {
            if (!store.anomalyThresholds) store.anomalyThresholds = { warning: 20, danger: 100 };
            store.anomalyThresholds.danger = Number(e.target.value);
            mapService.updateAnalyticsOnly(store);
        };
    }

    // MODAL overlay (dim/transparent)
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

    // OPEN DETAILS MODAL
    if (ui.openModalBtn) {
        ui.openModalBtn.onclick = () => {
            if (!store.activeRouteId) return;
            const route = store.routes.get(store.activeRouteId);
            if (!route) return;

            ui.modalBody.innerHTML = '';
            ui.modalBody.style.padding = '0';

            const summaryContainer = document.createElement('div');
            const listContainer = document.createElement('ul');
            listContainer.id = 'modal-points-list';

            ui.modalBody.append(summaryContainer, listContainer);

            renderPointsList(route, store, {
                routeTitle: ui.modalTitle,
                summary: summaryContainer,
                list: listContainer
            }, {
                onPointClick: (rid, idx) => markerRenderer.highlightSegment(rid, idx, store.vehicleType)
            });

            ui.modalContainer.classList.remove('hidden');
            ui.modalOverlay.classList.remove('hidden');
        };
    }

    ui.closeModalBtn.onclick = () => ui.modalContainer.classList.add('hidden');

    // Drag modal
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

    // Resize modal
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

    // Cameras reload
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
            if (hint) {
                const suffix = filters.bbox ? ' (у видимій області)' : '';
                hint.textContent = `Знайдено камер: ${items.length}${suffix}`;
            }
        } catch (e) {
            console.error('Помилка завантаження камер:', e);
            showMessage('Не вдалося завантажити камери', 'error');
        }
    };

    updateApp();
});
