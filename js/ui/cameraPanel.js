// js/ui/cameraPanel.js

import * as cameraRenderer from '../map/cameraRenderer.js';
import { initCameraFilters } from './cameraFilters.js';
import { getElements } from './dom.js';
import { highlightTerritory } from '../map/mapLayers.js'; // ІМПОРТУЄМО НОВУ ФУНКЦІЮ

let mapInstance = null;
let camerasVisible = false; 
let cameraClusteringEnabled = true;
let lastFilters = {};

// --- HTML: Оновлений, компактний ---
function buildCameraPanelHtml() {
  return `
    <section class="panel camera-panel-wrapper">
      
      <div class="panel-header-controls">
        <div class="control-row">
           <span class="control-label"><i class="fa-solid fa-eye"></i> Відображати камери</span>
           <label class="toggle-switch-small">
              <input type="checkbox" id="toggle-cameras-visibility-btn"> 
              <span class="slider-small"></span>
           </label>
        </div>
        <div class="control-row">
           <span class="control-label"><i class="fa-solid fa-circle-nodes"></i> Кластеризація</span>
           <label class="toggle-switch-small">
              <input type="checkbox" id="toggle-camera-clustering-btn" checked>
              <span class="slider-small"></span>
           </label>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="filter-camera-id">ID камери</label>
        <div class="input-wrapper">
            <i class="fa-solid fa-magnifying-glass input-icon"></i>
            <input id="filter-camera-id" class="styled-input" placeholder="Введіть ID..." autocomplete="off"/>
            <div id="dropdown-camera-id" class="autocomplete-dropdown"></div>
        </div>
      </div>

      <div class="region-filters-block">
          <div class="grid-2">
            <div class="field-group">
                <label class="field-label" for="filter-oblast">Область</label>
                <div class="input-wrapper">
                    <input id="filter-oblast" class="styled-input" placeholder="Область" autocomplete="off"/>
                    <div id="dropdown-oblast" class="autocomplete-dropdown"></div>
                </div>
            </div>
            <div class="field-group">
                <label class="field-label" for="filter-raion">Район</label>
                <div class="input-wrapper">
                    <input id="filter-raion" class="styled-input" placeholder="Район" autocomplete="off"/>
                    <div id="dropdown-raion" class="autocomplete-dropdown"></div>
                </div>
            </div>
          </div>

          <div class="field-group" style="margin-bottom: 0;">
            <label class="field-label" for="filter-hromada">Громада <span class="hint">(автозаповнення)</span></label>
            <div class="input-wrapper">
                <input id="filter-hromada" class="styled-input" placeholder="Почніть вводити назву..." autocomplete="off"/>
                <div id="dropdown-hromada" class="autocomplete-dropdown"></div>
            </div>
          </div>
      </div>
      
      <div class="field-group">
         <label class="field-label" for="filter-license-type">Функціонал</label>
         <select id="filter-license-type" class="styled-select"></select>
      </div>
      <div class="field-group">
         <label class="field-label" for="filter-analytics-object">Об'єкт аналітики</label>
         <select id="filter-analytics-object" class="styled-select"></select>
      </div>
      
      <div class="grid-2">
        <div class="field-group">
            <label class="field-label" for="filter-camera-status">Стан</label>
            <select id="filter-camera-status" class="styled-select"></select>
        </div>
        <div class="field-group">
            <label class="field-label" for="filter-ka-access">КА доступ</label>
            <select id="filter-ka-access" class="styled-select"></select>
        </div>
      </div>
      
      <div class="field-group">
        <label class="field-label" for="filter-system">Інтегрована система</label>
        <select id="filter-system" class="styled-select"></select>
      </div>

      <button id="filter-reset-btn" class="btn-reset" type="button">
        <i class="fa-solid fa-rotate-left"></i> Скинути всі фільтри
      </button>
      
      <div id="camera-panel-hint" class="results-hint"></div>
      
    </section>
  `;
}

function ensureSyncButtonFooter(sidebarContent) {
    if (document.getElementById('camera-sidebar-footer')) return;
    const footer = document.createElement('div');
    footer.id = 'camera-sidebar-footer';
    footer.innerHTML = `
        <button id="sync-db-btn" type="button">
            <i class="fa-solid fa-rotate"></i> Оновити базу камер
        </button>
        <div id="sync-status" style="font-size: 0.7em; color: #888; margin-top: 4px; text-align: center;"></div>
    `;
    sidebarContent.appendChild(footer);
    const syncBtn = footer.querySelector('#sync-db-btn');
    const syncStatus = footer.querySelector('#sync-status');

    syncBtn.onclick = async () => {
        if (!confirm('Оновити базу даних камер з Google Таблиць? Це може зайняти час.')) return;
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Оновлення...';
        syncStatus.textContent = 'З\'єднання з сервером...';
        try {
            const res = await fetch('/api/sync', { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                const count = data.rows_upserted || 0;
                syncStatus.textContent = `Успішно! Оновлено: ${count} камер.`;
                syncStatus.style.color = 'green';
                reloadWithCurrentSettings().catch(console.error);
            } else {
                throw new Error(data.error || 'Помилка сервера');
            }
        } catch (e) {
            console.error(e);
            syncStatus.textContent = `Помилка: ${e.message}`;
            syncStatus.style.color = 'red';
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Оновити базу камер';
        }
    };
}

async function reloadWithCurrentSettings() {
  if (mapInstance) cameraRenderer.setMapInstance(mapInstance);
  cameraRenderer.setVisibility(camerasVisible);

  if (!camerasVisible) {
    cameraRenderer.clearAllCameras();
    const hint = document.getElementById('camera-panel-hint');
    if (hint) hint.textContent = '';
    return;
  }

  const bounds = mapInstance.getBounds();
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  const bboxStr = `${south},${west},${north},${east}`;

  if (typeof window.reloadCameras === 'function') {
      await window.reloadCameras({ ...lastFilters, bbox: bboxStr }, cameraClusteringEnabled);
  }
}

function updateVisualsOnly() {
    if (mapInstance) cameraRenderer.setMapInstance(mapInstance);
    cameraRenderer.setVisibility(camerasVisible);
    if (!camerasVisible) { cameraRenderer.clearAllCameras(); return; }
    cameraRenderer.rerenderLast(cameraClusteringEnabled);
}

function togglePanel(isOpen) {
    const ui = getElements();
    if (isOpen) {
        ui.sidebarRight.classList.add('open');
        reloadWithCurrentSettings().catch(console.error);
    } else {
        ui.sidebarRight.classList.remove('open');
    }
}

// --- ВИЗНАЧЕННЯ АКТИВНОЇ ТЕРИТОРІЇ ---
function updateTerritoryHighlight(filters) {
    // Шукаємо найдетальніший рівень фільтрації
    let targetCode = null;

    if (filters.hromada) {
        targetCode = filters.hromada;
    } else if (filters.raion) {
        targetCode = filters.raion;
    } else if (filters.oblast) {
        targetCode = filters.oblast;
    }

    // Викликаємо функцію з mapLayers.js
    highlightTerritory(targetCode);
}

export function initCameraPanel(map) {
  mapInstance = map;
  const ui = getElements();

  if (ui.cameraFiltersContainer) {
      ui.cameraFiltersContainer.innerHTML = buildCameraPanelHtml();
  }

  const sidebarContent = ui.sidebarRight.querySelector('.sidebar-content');
  if (sidebarContent) {
      ensureSyncButtonFooter(sidebarContent);
  }

  if (ui.openCameraPanelBtn) {
      ui.openCameraPanelBtn.onclick = () => togglePanel(true);
  }
  if (ui.closeCameraPanelBtn) {
      ui.closeCameraPanelBtn.onclick = () => togglePanel(false);
  }

  let moveTimeout;
  map.on('moveend', () => {
      if (camerasVisible) {
          clearTimeout(moveTimeout);
          moveTimeout = setTimeout(() => {
              reloadWithCurrentSettings().catch(console.error);
          }, 500); 
      }
  });

  initCameraFilters({ 
      onChange: (filters) => {
          lastFilters = filters;
          
          // 1. Оновлюємо підсвітку території
          updateTerritoryHighlight(filters);

          // 2. Оновлюємо камери
          if (camerasVisible) {
              reloadWithCurrentSettings().catch(console.error);
          }
      }
  });

  const visBtn = document.getElementById('toggle-cameras-visibility-btn');
  const clustBtn = document.getElementById('toggle-camera-clustering-btn');

  if (visBtn) {
      visBtn.checked = camerasVisible; 
      visBtn.onchange = (e) => {
          camerasVisible = e.target.checked;
          if (camerasVisible) reloadWithCurrentSettings();
          else updateVisualsOnly();
      };
  }
  if (clustBtn) {
      clustBtn.checked = cameraClusteringEnabled;
      clustBtn.onchange = (e) => {
          cameraClusteringEnabled = e.target.checked;
          updateVisualsOnly();
      };
  }
}
