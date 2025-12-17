// js/main.js

import { initializeMap } from './map/mapInitializer.js';
import { handleFileLoad } from './parser/fileHandler.js';
import * as markerRenderer from './map/markerRenderer.js';
import * as cameraRenderer from './map/cameraRenderer.js';
import * as colorUtils from './utils/colorUtils.js';
import { initModeSwitcher } from './utils/modeSwitcher.js';
import { initCameraFilters } from './ui/cameraFilters.js';
import { fetchCameras } from './api/camerasApi.js';
import { initCameraModal } from './ui/cameraModal.js';



let map;
const routes = new Map();
let routeColorMap = new Map();
let activeRouteId = null;
let isClusteringEnabled = true;
let globalDateFilter = new Set();
let vehicleType = 'car';

// DOM елементи - Оголошуємо тут, але призначаємо після завантаження DOM
let sidebar, sidebarToggleBtn, dropArea, fileInput, routeListElement, messageElement,
    pointsListRouteName, pointsListSummary, pointsListItems, uniqueDatesSidebarList,
    modalContainer, modalContent, modalHeader, modalTitle, modalBody, openModalBtn,
    closeModalBtn, modalOverlay, toggleClusteringBtn, vehicleTypeSelect,
    toggleOverlayBtn, resizer;

/**
 * Ініціалізує змінні DOM-елементів після завантаження сторінки.
 */
function initializeDOMElements() {
    sidebar = document.getElementById('sidebar');
    sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    dropArea = document.getElementById('drop-area');
    fileInput = document.getElementById('file-input');
    routeListElement = document.getElementById('route-items');
    messageElement = document.getElementById('message');
    pointsListRouteName = document.getElementById('points-list-routename');
    pointsListSummary = document.getElementById('points-list-summary');
    pointsListItems = document.getElementById('points-list-items');
    uniqueDatesSidebarList = document.getElementById('unique-dates-sidebar-list');
    modalContainer = document.getElementById('modal-container');
    modalContent = document.getElementById('modal-content');
    modalHeader = document.getElementById('modal-header');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.getElementById('modal-body');
    openModalBtn = document.getElementById('open-details-modal-btn');
    closeModalBtn = document.getElementById('modal-close-btn');
    modalOverlay = document.getElementById('modal-overlay');
    toggleClusteringBtn = document.getElementById('toggle-clustering-btn');
    vehicleTypeSelect = document.getElementById('vehicle-type-select');
    toggleOverlayBtn = document.getElementById('toggle-overlay-btn');
    resizer = document.getElementById('resizer');
}

// --- ВИЗНАЧЕННЯ ОСНОВНИХ ФУНКЦІЙ ---

function updateRouteListUI() {
    routeListElement.innerHTML = '';
    if (routes.size === 0) {
        routeListElement.innerHTML = '<li class="empty-list-item">Немає завантажених маршрутів</li>';
        return;
    }

    routes.forEach(route => {
        const li = document.createElement('li');
        li.className = 'file-list-item';
        li.dataset.routeId = route.id;
        if (!route.isVisible) li.classList.add('route-hidden');
        if (route.id === activeRouteId) li.classList.add('active');
        li.style.borderLeftColor = routeColorMap.get(route.id) || '#ccc';

        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'route-name';
        fileNameSpan.textContent = route.fileName;
        fileNameSpan.addEventListener('click', () => selectRoute(route.id));

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'route-controls';

        const lockBtn = document.createElement('button');
        lockBtn.className = 'lock-filter-btn';
        lockBtn.innerHTML = route.isLocked ? '🔒' : '🔓';
        lockBtn.title = route.isLocked ? 'Розблокувати фільтри для маршруту' : 'Заблокувати фільтри для маршруту';
        lockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRouteLock(route.id);
        });

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-visibility-btn';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.title = 'Показати/сховати маршрут';
        toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleRouteVisibility(route.id); });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-route-btn';
        removeBtn.textContent = 'x';
        removeBtn.title = 'Видалити маршрут';
        removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeRoute(route.id); });

        controlsDiv.appendChild(lockBtn);
        controlsDiv.appendChild(toggleBtn);
        controlsDiv.appendChild(removeBtn);
        li.appendChild(fileNameSpan);
        li.appendChild(controlsDiv);
        routeListElement.appendChild(li);
    });
}

function updateModalButtonState() {
    openModalBtn.disabled = !activeRouteId;
}

function showMessage(msg, type, showResetBtn = false) {
    messageElement.innerHTML = '';
    const textSpan = document.createElement('span');
    textSpan.textContent = msg;
    messageElement.appendChild(textSpan);

    messageElement.className = `message ${type}`;

    if (showResetBtn) {
        const resetButton = document.createElement('button');
        resetButton.className = 'filter-reset-btn';
        resetButton.textContent = '×';
        resetButton.title = 'Скинути фільтр';
        resetButton.onclick = resetGlobalFilter;
        messageElement.appendChild(resetButton);
    }

    if (type === 'success') {
        setTimeout(() => {
            if (messageElement.textContent === msg) {
                messageElement.className = 'message';
                messageElement.innerHTML = '';
            }
        }, 5000);
    }
}

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
function highlight() { dropArea.classList.add('highlight'); }
function unhighlight() { dropArea.classList.remove('highlight'); }
async function handleDrop(e) { await handleFiles({ target: { files: e.dataTransfer.files } }); }

async function handleFiles(event) {
    const files = event.target.files;
    for (const file of files) await processFile(file);
    if (fileInput) fileInput.value = '';
}

// ---------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    map = initializeMap();
    markerRenderer.setMapInstance(map);
    cameraRenderer.setMapInstance(map);

    // 1) Спочатку ініціалізуємо DOM
    initializeDOMElements();

    // 2) Потім налаштовуємо обробники подій (маршрути)
    setupEventListeners();

    // 3) Ініціалізуємо режими + камери (додає власні контролли та обробники)
    //    Важливо робити це після DOMContentLoaded, щоб .map-controls існував.
    try {
        initModeSwitcher(map);
    } catch (err) {
        console.error('[modeSwitcher] init error:', err);
    }

    updateRouteListUI();
    updateModalButtonState();
});

function setupEventListeners() {
    // Додаємо перевірки на існування елементів перед додаванням обробників
    if (dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => dropArea.addEventListener(eventName, preventDefaults, false));
        ['dragenter', 'dragover'].forEach(eventName => dropArea.addEventListener(eventName, highlight, false));
        ['dragleave', 'drop'].forEach(eventName => dropArea.addEventListener(eventName, unhighlight, false));
        dropArea.addEventListener('drop', handleDrop, false);
        dropArea.querySelector('.select-files-btn')?.addEventListener('click', () => fileInput.click());
    }
    if (fileInput) fileInput.addEventListener('change', handleFiles, false);

    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);
    if (openModalBtn) openModalBtn.addEventListener('click', openDetailsModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeDetailsModal);

    if (toggleClusteringBtn) {
        toggleClusteringBtn.addEventListener('change', () => {
            isClusteringEnabled = toggleClusteringBtn.checked;
            renderAllRoutes();
        });
    }

    // Тепер цей елемент гарантовано буде знайдено
    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener('change', () => {
            vehicleType = vehicleTypeSelect.value;
            console.log(`Тип транспорту змінено на: ${vehicleType}`);
            renderAllRoutes(); // Перебудовуємо маршрути з новим типом транспорту
        });
    } else {
        console.error("Помилка ініціалізації: Елемент <select> з ID 'vehicle-type-select' не знайдено в HTML. Перевірте ваш index.html.");
    }

    if (toggleOverlayBtn) {
        toggleOverlayBtn.addEventListener('change', () => {
            modalOverlay.classList.toggle('hidden', toggleOverlayBtn.checked);
        });
    }

    if (modalContent && modalHeader) makeDraggable(modalContent, modalHeader);
    if (modalContent && resizer) makeResizable(modalContent, resizer);
}

// --- Camera filters -> reload cameras on map ---
window.reloadCameras = async (filters = {}) => {
  try {
    // API повертає { ok, total, limit, offset, items: [...] }
    const data = await fetchCameras({ ...filters, limit: 200000 });

    const items = Array.isArray(data?.items) ? data.items : [];

    // Рендеримо через модульний renderer (НЕ через window.cameraLayer)
    const { isClusteringEnabled, isVisible } = cameraRenderer.getState();

    // Якщо видимість вимкнена тумблером — просто чистимо і виходимо
    if (!isVisible) {
      cameraRenderer.clearAllCameras();
      return [];
    }

    cameraRenderer.renderCameras(items, isClusteringEnabled);
    return items;
  } catch (e) {
    console.error('[reloadCameras] failed:', e);
    return [];
  }
};


initCameraFilters({
  onChange: (filters) => {
    window.reloadCameras(filters);
  },
});

// ініціалізація модалки камер (вона ж біндить window.cameraLayer)
initCameraModal(map);


function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    sidebarToggleBtn.textContent = sidebar.classList.contains('collapsed') ? '»' : '«';
    setTimeout(() => map.invalidateSize(), 300);
}

function openDetailsModal() {
    if (!activeRouteId) return;
    const route = routes.get(activeRouteId);

    modalTitle.textContent = `Деталі: ${route.fileName}`;
    modalBody.innerHTML = `
        <div id="points-list-summary" class="sticky-summary">${pointsListSummary.innerHTML}</div>
        <ul class="points-list-items">${pointsListItems.innerHTML}</ul>
    `;

    const pointsInList = Array.from(pointsListItems.querySelectorAll('li'));
    modalBody.querySelectorAll('li').forEach((modalLi, index) => {
        const originalLi = pointsInList[index];
        if (originalLi && originalLi.dataset.originalIndex) {
            const originalPointIndex = parseInt(originalLi.dataset.originalIndex, 10);
            modalLi.addEventListener('click', () => markerRenderer.highlightSegment(route.id, originalPointIndex));
        }
    });

    modalContainer.classList.remove('hidden');
    toggleOverlayBtn.checked = false;
    modalOverlay.classList.remove('hidden');
}

function closeDetailsModal() {
    modalContainer.classList.add('hidden');
}

function applyDateFilter(date, event) {
    if (event.shiftKey) {
        if (globalDateFilter.has(date)) {
            globalDateFilter.delete(date);
        } else {
            globalDateFilter.add(date);
        }
    } else {
        if (globalDateFilter.has(date) && globalDateFilter.size === 1) {
             globalDateFilter.clear();
        } else {
            globalDateFilter.clear();
            globalDateFilter.add(date);
        }
    }

    if (globalDateFilter.size === 0) {
        resetGlobalFilter();
        return;
    }

    renderAllRoutes();

    if (activeRouteId) {
        displayPointsForRoute(activeRouteId);
        zoomToFilteredRoute(activeRouteId, globalDateFilter);
    }

    const message = globalDateFilter.size > 1
        ? `Обрано дат: ${globalDateFilter.size}`
        : `Фільтр по даті: ${Array.from(globalDateFilter)[0]}`;
    showMessage(message, 'info', true);
}

function resetGlobalFilter() {
    if (globalDateFilter.size > 0) {
        globalDateFilter.clear();
        renderAllRoutes();
        if (activeRouteId) {
            displayPointsForRoute(activeRouteId);
        }
        showMessage('Фільтр по даті скинуто.', 'success');
    }
}

async function processFile(file) {
    showMessage(`Обробка файлу: ${file.name}...`, 'info');
    const routeId = `route_${Date.now()}`;
    try {
        const { normalizedPoints } = await handleFileLoad(file);
        if (!normalizedPoints || normalizedPoints.length < 2) throw new Error('Файл містить недостатньо точок.');

        routes.set(routeId, {
            id: routeId,
            fileName: file.name,
            normalizedPoints,
            isVisible: true,
            isLocked: false
        });

        if(globalDateFilter.size > 0) resetGlobalFilter();
        await renderAllRoutes();
        selectRoute(routeId);

        showMessage(`Файл "${file.name}" завантажено.`, 'success');
    } catch (error) {
        console.error('Критична помилка обробки файлу:', error);
        showMessage(`Помилка: ${error.message}`, 'error');
    }
}

async function renderAllRoutes() {
    markerRenderer.clearAllMarkers();
    routeColorMap.clear();
    const allPoints = [];

    let routeIndex = 0;
    const visibleRoutes = Array.from(routes.values()).filter(r => r.isVisible);
    const totalVisibleRoutes = visibleRoutes.length;

    for (const route of routes.values()) {
        const color = colorUtils.getRouteColor(route.id);
        routeColorMap.set(route.id, color);

        if (route.isVisible) {
            const renderOrder = { index: routeIndex, total: totalVisibleRoutes };
            await markerRenderer.renderMarkers(route, map, color, isClusteringEnabled, globalDateFilter, renderOrder, vehicleType);

            const pointsToConsider = (globalDateFilter.size > 0 && !route.isLocked)
                ? route.normalizedPoints.filter(p => globalDateFilter.has(new Date(p.timestamp).toLocaleDateString('uk-UA')))
                : route.normalizedPoints;

            allPoints.push(...pointsToConsider);
            routeIndex++;
        }
    }

    updateUniqueDatesSidebar(allPoints);
    updateRouteListUI();
}

function updateUniqueDatesSidebar(allPoints) {
    const dateCounts = new Map();
    const sourcePoints = routes.size > 0
        ? Array.from(routes.values()).flatMap(r => r.normalizedPoints)
        : [];

    sourcePoints.forEach(p => {
        const dateStr = new Date(p.timestamp).toLocaleDateString('uk-UA');
        dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
    });

    const sortedDates = Array.from(dateCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date.split('.').reverse().join('-')) - new Date(b.date.split('.').reverse().join('-')));

    uniqueDatesSidebarList.innerHTML = '';
    if (sortedDates.length === 0) {
        uniqueDatesSidebarList.innerHTML = '<li class="empty-list-item">Немає даних</li>';
        return;
    }

    sortedDates.forEach(({ date, count }) => {
        const li = document.createElement('li');
        if (globalDateFilter.has(date)) {
            li.classList.add('active');
        }
        li.innerHTML = `
            <span class="unique-date-str">${date}</span>
            <span class="unique-date-count">${count} фікс.</span>
        `;
        li.addEventListener('click', (event) => applyDateFilter(date, event));
        uniqueDatesSidebarList.appendChild(li);
    });
}

function toggleRouteVisibility(routeId) {
    const route = routes.get(routeId);
    if (route) {
        route.isVisible = !route.isVisible;
        renderAllRoutes();
    }
}

function toggleRouteLock(routeId) {
    const route = routes.get(routeId);
    if (route) {
        route.isLocked = !route.isLocked;
        renderAllRoutes();
    }
}

function removeRoute(routeId) {
    if (routes.has(routeId)) {
        routes.delete(routeId);
        routeColorMap.delete(routeId);
        if (activeRouteId === routeId) {
            activeRouteId = null;
            clearPointsList();
        }
        if(globalDateFilter.size > 0) resetGlobalFilter();
        renderAllRoutes();
    }
}

function selectRoute(routeId) {
    activeRouteId = routeId;
    updateRouteListUI();

    if (globalDateFilter.size > 0) {
        displayPointsForRoute(routeId);
        zoomToFilteredRoute(routeId, globalDateFilter);
    } else {
        displayPointsForRoute(routeId);
        zoomToRoute(routeId);
    }
    updateModalButtonState();
}

function zoomToRoute(routeId) {
    const route = routes.get(routeId);
    if (route && route.isVisible && route.normalizedPoints.length > 0) {
        const latlngs = route.normalizedPoints.map(p => [p.latitude, p.longitude]);
        const bounds = new L.LatLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function zoomToFilteredRoute(routeId, dateFilterSet) {
    const route = routes.get(routeId);
    if (!route || !route.isVisible) return;

    let pointsToZoom = route.normalizedPoints;

    if (dateFilterSet.size > 0 && !route.isLocked) {
        pointsToZoom = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return dateFilterSet.has(pointDate);
        });
    }

    if (pointsToZoom.length > 0) {
        const latlngs = pointsToZoom.map(p => [p.latitude, p.longitude]);
        const bounds = new L.LatLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    } else {
        zoomToRoute(routeId);
    }
}

function displayPointsForRoute(routeId) {
    const route = routes.get(routeId);
    if (!route) return;

    pointsListRouteName.textContent = route.fileName;
    let pointsToDisplay = route.normalizedPoints;

    if (globalDateFilter.size > 0 && !route.isLocked) {
        pointsToDisplay = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return globalDateFilter.has(pointDate);
        });
    }

    if (pointsToDisplay.length === 0) {
        pointsListSummary.innerHTML = '';
        pointsListItems.innerHTML = '<li class="empty-list-item">Немає точок у вибраному діапазоні</li>';
        return;
    }

    const totalTime = pointsToDisplay.length > 1
        ? (new Date(pointsToDisplay[pointsToDisplay.length - 1].timestamp).getTime() - new Date(pointsToDisplay[0].timestamp).getTime())
        : 0;

    pointsListSummary.innerHTML = `<strong>Загальний час у вибірці:</strong> ${formatDuration(totalTime)}`;
    pointsListItems.innerHTML = '';

    pointsToDisplay.forEach((point, index) => {
        const li = document.createElement('li');
        let durationMs = 0;
        if (index < pointsToDisplay.length - 1) {
            const nextPointTime = new Date(pointsToDisplay[index + 1].timestamp).getTime();
            durationMs = nextPointTime - new Date(point.timestamp).getTime();
        }

        const isLongStop = durationMs > (5 * 60 * 1000);

        li.innerHTML = `
            <span class="point-col point-index">${index + 1}</span>
            <span class="point-col point-time">${new Date(point.timestamp).toLocaleString('uk-UA')}</span>
            <span class="point-col point-duration ${isLongStop ? 'long-stop' : ''}" title="${isLongStop ? 'Довга зупинка' : ''}">
                ${index < pointsToDisplay.length - 1 ? formatDuration(durationMs) : '---'}
            </span>
        `;

        const originalIndex = route.normalizedPoints.indexOf(point);
        li.dataset.originalIndex = originalIndex;
        li.addEventListener('click', () => markerRenderer.highlightSegment(route.id, originalIndex));

        pointsListItems.appendChild(li);
    });

    if (!modalContainer.classList.contains('hidden') && routeId === activeRouteId) {
        openDetailsModal();
    }
}

function clearPointsList() {
    activeRouteId = null;
    pointsListRouteName.textContent = '';
    pointsListSummary.innerHTML = '';
    pointsListItems.innerHTML = '<li class="empty-list-item">Оберіть маршрут для перегляду</li>';
    updateModalButtonState();
    updateRouteListUI();
}

function formatDuration(ms) {
    if (ms < 1000) return "0 сек";
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let result = '';
    if (hours > 0) result += `${hours} год `;
    if (minutes > 0) result += `${minutes} хв `;
    if (seconds > 0 || result === '') result += `${seconds} сек`;
    return result.trim();
}

function makeDraggable(element, handle) {
    let offsetX, offsetY;
    const move = (e) => {
        const x = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        element.style.left = `${x - offsetX}px`;
        element.style.top = `${y - offsetY}px`;
        element.style.transform = '';
    };
    const stopMove = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stopMove);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', stopMove);
    };
    const startMove = (e) => {
        const x = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const y = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        if (element.style.transform) {
            const rect = element.getBoundingClientRect();
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
            element.style.transform = '';
        }
        offsetX = x - element.offsetLeft;
        offsetY = y - element.offsetTop;
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stopMove);
        document.addEventListener('touchmove', move);
        document.addEventListener('touchend', stopMove);
    };
    handle.addEventListener('mousedown', startMove);
    handle.addEventListener('touchstart', startMove);
}

function makeResizable(element, resizer) {
    let startX, startY, startWidth, startHeight;
    const resize = (e) => {
        const x = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        element.style.width = `${startWidth + x - startX}px`;
        element.style.height = `${startHeight + y - startY}px`;
    };
    const stopResize = () => {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchmove', resize);
        document.removeEventListener('touchend', stopResize);
    };
    const startResize = (e) => {
        e.preventDefault();
        const x = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const y = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        startX = x;
        startY = y;
        startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchmove', resize);
        document.addEventListener('touchend', stopResize);
    };
    resizer.addEventListener('mousedown', startResize);
    resizer.addEventListener('touchstart', startResize);
}
