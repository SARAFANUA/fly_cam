// js/ui/dom.js

// Ледачий гетер (lazy getter) для елементів
export const getElements = () => ({
    // Лівий сайдбар
    sidebar: document.getElementById('sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    routeList: document.getElementById('route-items'),
    message: document.getElementById('message'),
    
    // Points list
    pointsRouteName: document.getElementById('points-list-routename'),
    pointsSummary: document.getElementById('points-list-summary'),
    pointsList: document.getElementById('points-list-items'),
    uniqueDatesList: document.getElementById('unique-dates-sidebar-list'),

    // Modal
    modalContainer: document.getElementById('modal-container'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    openModalBtn: document.getElementById('open-details-modal-btn'),
    closeModalBtn: document.getElementById('modal-close-btn'),
    modalOverlay: document.getElementById('modal-overlay'),
    
    // Controls
    toggleClustering: document.getElementById('toggle-clustering-btn'),
    vehicleSelect: document.getElementById('vehicle-type-select'),
    resizer: document.getElementById('resizer'),

    // --- НОВЕ: Правий сайдбар (Камери) ---
    sidebarRight: document.getElementById('sidebar-right'),
    openCameraPanelBtn: document.getElementById('open-camera-panel-btn'),
    closeCameraPanelBtn: document.getElementById('close-right-sidebar-btn'),
    cameraFiltersContainer: document.getElementById('camera-filters-container')
});

// Утиліта для повідомлень
export function showMessage(msg, type, onReset) {
    const el = getElements().message;
    el.innerHTML = `<span>${msg}</span>`;
    el.className = `message ${type}`;

    if (onReset) {
        const btn = document.createElement('button');
        btn.className = 'filter-reset-btn';
        btn.textContent = '×';
        btn.onclick = onReset;
        el.appendChild(btn);
    }

    if (type === 'success') {
        setTimeout(() => { if (el.textContent.includes(msg)) el.innerHTML = ''; el.className = 'message'; }, 5000);
    }
}