// js/ui/dom.js
export const getElements = () => ({
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),

    // Upload
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    selectFilesBtn: document.getElementById('select-files-btn'),

    // Routes & dates
    routeList: document.getElementById('route-items'),
    uniqueDatesList: document.getElementById('unique-dates-sidebar-list'),

    // Messages
    message: document.getElementById('message'),

    // Controls
    toggleClustering: document.getElementById('toggle-clustering-btn'),
    vehicleSelect: document.getElementById('vehicle-type-select'),

    // Modal (ONLY details now)
    modalContainer: document.getElementById('modal-container'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalOverlay: document.getElementById('modal-overlay'),
    openModalBtn: document.getElementById('open-details-modal-btn'),
    closeModalBtn: document.getElementById('modal-close-btn'),
    toggleOverlay: document.getElementById('toggle-overlay-btn'),
    resizer: document.getElementById('resizer'),

    // Right sidebar (cameras)
    sidebarRight: document.getElementById('sidebar-right'),
    sidebarRightToggleBtn: document.getElementById('sidebar-right-toggle-btn'),
    closeCameraPanelBtn: document.getElementById('close-right-sidebar-btn'),
    cameraFiltersContainer: document.getElementById('camera-filters-container'),

    // Collapsible panels
    routesPanel: document.getElementById('file-list-container'),
    datesPanel: document.getElementById('dates-panel'),

    toggleRoutesPanelBtn: document.getElementById('toggle-routes-panel-btn'),
    toggleDatesPanelBtn: document.getElementById('toggle-dates-panel-btn'),

    // Floating clustering button
    clusteringFloatBtn: document.getElementById('clustering-float-btn')
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
        setTimeout(() => {
            if (el.textContent.includes(msg)) {
                el.innerHTML = '';
                el.className = 'message';
            }
        }, 5000);
    }
}
