// js/ui/cameraPanel.js

import * as cameraRenderer from '../map/cameraRenderer.js';
import { initCameraFilters } from './cameraFilters.js';
import { getElements } from './dom.js';

let mapInstance = null;
let camerasVisible = true;
let cameraClusteringEnabled = true;
let lastFilters = {};

// --- HTML: Тільки фільтри (без кнопки оновлення) ---
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

// --- Створення фіксованого футера для кнопки ---
function ensureSyncButtonFooter(sidebarContent) {
    // Перевіряємо, чи футер вже є, щоб не дублювати
    if (document.getElementById('camera-sidebar-footer')) return;

    const footer = document.createElement('div');
    footer.id = 'camera-sidebar-footer';
    
    // HTML кнопки
    footer.innerHTML = `
        <button id="sync-db-btn" type="button">
            <i class="fa-solid fa-rotate"></i> Оновити базу камер
        </button>
        <div id="sync-status" style="font-size: 0.75em; color: #888; margin-top: 5px; text-align: center;"></div>
    `;
    
    // Вставляємо футер ПІСЛЯ контейнера скролу, але ВСЕРЕДИНУ sidebarContent
    sidebarContent.appendChild(footer);

    // Додаємо логіку кліку
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
                // Оновлюємо карту
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

// 2. Головна функція ініціалізації
export function initCameraPanel(map) {
  mapInstance = map;
  const ui = getElements();

  // Рендеримо фільтри (Скрол зона)
  if (ui.cameraFiltersContainer) {
      ui.cameraFiltersContainer.innerHTML = buildCameraPanelHtml();
  }

  // Створюємо Футер (Фіксована зона)
  // Шукаємо батьківський елемент sidebar-content у правому сайдбарі
  const sidebarContent = ui.sidebarRight.querySelector('.sidebar-content');
  if (sidebarContent) {
      ensureSyncButtonFooter(sidebarContent);
  }

  // Кнопки відкриття/закриття
  if (ui.openCameraPanelBtn) {
      ui.openCameraPanelBtn.onclick = () => togglePanel(true);
  }
  if (ui.closeCameraPanelBtn) {
      ui.closeCameraPanelBtn.onclick = () => togglePanel(false);
  }

//   // Слухач руху карти (BBOX)
//   let moveTimeout;
//   map.on('moveend', () => {
//       if (camerasVisible ) { //&& ui.sidebarRight.classList.contains('open')
//           clearTimeout(moveTimeout);
//           moveTimeout = setTimeout(() => {
//               reloadWithCurrentSettings().catch(console.error);
//           }, 500); 
//       }
//   });

  // Ініціалізація логіки фільтрів
  initCameraFilters({ 
      onChange: (filters) => {
          lastFilters = filters;
          reloadWithCurrentSettings().catch(console.error);
      }
  });

  // Тумблери (Vis/Cluster)
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