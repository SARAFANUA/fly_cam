// js/ui/cameraPanel.js

import * as cameraRenderer from '../map/cameraRenderer.js';
import { initCameraFilters } from './cameraFilters.js';
import { getElements } from './dom.js';

let mapInstance = null;
let camerasVisible = true;
let cameraClusteringEnabled = true;
let lastFilters = {};

// HTML: Замінили datalist на div.autocomplete-dropdown
function buildCameraPanelHtml() {
  return `
    <section class="panel camera-panel-wrapper">
      
      <div class="panel-header-controls">
        <div class="control-row">
           <span class="control-label"><i class="fa-solid fa-eye"></i> Відображати камери</span>
           <label class="toggle-switch-small">
              <input type="checkbox" id="toggle-cameras-visibility-btn" checked>
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
        <label class="field-label">ID камери</label>
        <div class="input-wrapper">
            <i class="fa-solid fa-magnifying-glass input-icon"></i>
            <input id="filter-camera-id" class="styled-input" placeholder="Введіть ID..." autocomplete="off"/>
            <div id="dropdown-camera-id" class="autocomplete-dropdown"></div>
        </div>
      </div>

      <div class="region-filters-block">
          <div class="field-group">
            <label class="field-label">Громада <span class="hint">(автозаповнення)</span></label>
            <div class="input-wrapper">
                <input id="filter-hromada" class="styled-input" placeholder="Почніть вводити назву..." autocomplete="off"/>
                <div id="dropdown-hromada" class="autocomplete-dropdown"></div>
            </div>
          </div>

          <div class="grid-2">
            <div class="field-group">
                <label class="field-label">Район</label>
                <div class="input-wrapper">
                    <input id="filter-raion" class="styled-input" placeholder="Район" autocomplete="off"/>
                    <div id="dropdown-raion" class="autocomplete-dropdown"></div>
                </div>
            </div>
            <div class="field-group">
                <label class="field-label">Область</label>
                <div class="input-wrapper">
                    <input id="filter-oblast" class="styled-input" placeholder="Область" autocomplete="off"/>
                    <div id="dropdown-oblast" class="autocomplete-dropdown"></div>
                </div>
            </div>
          </div>
      </div>
      
      <div class="field-group">
         <label class="field-label">Функціонал</label>
         <select id="filter-license-type" class="styled-select"></select>
      </div>
      <div class="field-group">
         <label class="field-label">Об'єкт аналітики</label>
         <select id="filter-analytics-object" class="styled-select"></select>
      </div>
      
      <div class="grid-2">
        <div class="field-group">
            <label class="field-label">Стан</label>
            <select id="filter-camera-status" class="styled-select"></select>
        </div>
        <div class="field-group">
            <label class="field-label">КА доступ</label>
            <select id="filter-ka-access" class="styled-select"></select>
        </div>
      </div>
      
      <div class="field-group">
        <label class="field-label">Інтегрована система</label>
        <select id="filter-system" class="styled-select"></select>
      </div>

      <button id="filter-reset-btn" class="btn-reset" type="button">
        <i class="fa-solid fa-rotate-left"></i> Скинути всі фільтри
      </button>
      
      <div id="camera-panel-hint" class="results-hint"></div>
    </section>
  `;
}

// Функція завантаження. ТЕПЕР ВИКОРИСТОВУЄ BBOX
async function reloadWithCurrentSettings() {
  if (mapInstance) cameraRenderer.setMapInstance(mapInstance);
  cameraRenderer.setVisibility(camerasVisible);

  if (!camerasVisible) {
    cameraRenderer.clearAllCameras();
    return;
  }

  // Отримуємо межі карти для фільтрації (south,west,north,east)
  const bounds = mapInstance.getBounds();
  const bbox = bounds.toBBoxString(); // "west,south,east,north" -> API usually expects "south,west,north,east" or checks logic

  // Leaflet toBBoxString() returns: "west,south,east,north"
  // Server route checks: params.bbox.split(',') -> [south, west, north, east]
  // Tomu treba pereformatuvaty string abo zminyty server logic.
  // Standard GeoJSON bbox is [minX, minY, maxX, maxY] -> [west, south, east, north].
  // Давайте сформуємо bbox вручну, щоб точно співпадало з сервером (server/routes/cameras.js):
  // params.bbox.split(',') => [south, west, north, east]
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  const bboxStr = `${south},${west},${north},${east}`;

  if (typeof window.reloadCameras === 'function') {
      // Передаємо bbox у фільтри
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
        // При відкритті панелі - одразу оновлюємо камери для поточної області
        reloadWithCurrentSettings().catch(console.error);
    } else {
        ui.sidebarRight.classList.remove('open');
    }
}

export function initCameraPanel(map) {
  mapInstance = map;
  const ui = getElements();

  if (ui.cameraFiltersContainer) {
      ui.cameraFiltersContainer.innerHTML = buildCameraPanelHtml();
  }

  if (ui.openCameraPanelBtn) {
      ui.openCameraPanelBtn.onclick = () => togglePanel(true);
  }
  if (ui.closeCameraPanelBtn) {
      ui.closeCameraPanelBtn.onclick = () => togglePanel(false);
  }

  // --- BBOX LOGIC: Слухаємо рух карти ---
  let moveTimeout;
  map.on('moveend', () => {
      // Оновлюємо, тільки якщо панель відкрита АБО камери увімкнені
      if (camerasVisible && ui.sidebarRight.classList.contains('open')) {
          clearTimeout(moveTimeout);
          // Дебаунс, щоб не спамити API при швидкому скролі
          moveTimeout = setTimeout(() => {
              reloadWithCurrentSettings().catch(console.error);
          }, 500); 
      }
  });

  initCameraFilters({ 
      onChange: (filters) => {
          lastFilters = filters;
          reloadWithCurrentSettings().catch(console.error);
      }
  });

  const visBtn = document.getElementById('toggle-cameras-visibility-btn');
  const clustBtn = document.getElementById('toggle-camera-clustering-btn');

  if (visBtn) {
      visBtn.checked = camerasVisible;
      visBtn.onchange = (e) => {
          camerasVisible = e.target.checked;
          if (camerasVisible) reloadWithCurrentSettings(); // Завантажити, якщо увімкнули
          else updateVisualsOnly(); // Просто приховати
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