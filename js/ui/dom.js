// js/ui/dom.js

export const getElements = () => ({
    sidebar: document.getElementById('sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    selectFilesBtn: document.getElementById('select-files-btn'), // <-- НОВЕ
    
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
    toggleOverlay: document.getElementById('toggle-overlay-btn'),
    resizer: document.getElementById('resizer'),

    // Camera Panel elements (якщо треба, вони вже є в cameraPanel.js, але можна і тут)
    sidebarRight: document.getElementById('sidebar-right'),
    sidebarRightToggleBtn: document.getElementById('sidebar-right-toggle-btn'),
    closeCameraPanelBtn: document.getElementById('close-right-sidebar-btn'),
    cameraFiltersContainer: document.getElementById('camera-filters-container')
});

export function showMessage(msg, type, onReset) {
    const el = getElements().message;
    if (!el) return;
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