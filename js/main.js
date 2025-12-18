// js/main.js
import { initializeMap } from './map/mapInitializer.js';
import * as cameraRenderer from './map/cameraRenderer.js';
import { initCameraPanel } from './ui/cameraPanel.js';
import { store } from './state/store.js';
import { getElements } from './ui/dom.js';
import { mapService } from './services/mapService.js';
import { fileService } from './services/fileService.js';

// Імпортуємо контролер
import * as AppController from './controllers/appController.js';

let map;

document.addEventListener('DOMContentLoaded', () => {
    map = initializeMap();
    mapService.init(map);
    cameraRenderer.setMapInstance(map);
    
    initCameraPanel(map);

    const ui = getElements();

    // --- UI Event Listeners ---

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

    // Обробка файлів
    const handleFileProcess = async (files) => {
        for(const f of files) {
            await fileService.processFile(f, store, {
                renderAll: () => AppController.updateApp(),
                onSelect: AppController.selectRoute,
                onResetFilter: () => store.globalDateFilter.clear()
            });
        }
    };

    ui.fileInput.onchange = async (e) => {
        await handleFileProcess(e.target.files);
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
            await handleFileProcess(e.dataTransfer.files);
        }
    });

    if(ui.dropArea) {
        ui.dropArea.ondragover = (e) => { e.preventDefault(); ui.dropArea.classList.add('highlight'); };
        ui.dropArea.ondragleave = () => ui.dropArea.classList.remove('highlight');
        ui.dropArea.ondrop = async (e) => { e.preventDefault(); ui.dropArea.classList.remove('highlight'); };
    }

    // Modal
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

    // Налаштування
    if(ui.toggleClustering) ui.toggleClustering.onchange = () => {
        store.isClusteringEnabled = ui.toggleClustering.checked;
        AppController.updateApp();
    };
    if(ui.vehicleSelect) ui.vehicleSelect.onchange = () => {
        store.vehicleType = ui.vehicleSelect.value;
        AppController.updateApp();
    };

    // Аномалії
    const warnInput = document.getElementById('anomaly-warning-input');
    const dangerInput = document.getElementById('anomaly-danger-input');

    if (warnInput) {
        warnInput.value = store.anomalyThresholds.warning;
        warnInput.onchange = (e) => {
            store.anomalyThresholds.warning = Number(e.target.value);
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
    
    // Глобальна функція для камер (використовується в cameraPanel.js)
    window.reloadCameras = AppController.reloadCameras;

    // Запуск
    AppController.updateApp();
});