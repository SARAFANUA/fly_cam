// js/ui/cameraModal.js
import * as cameraRenderer from '../map/cameraRenderer.js';
import { initCameraFilters } from './cameraFilters.js'; // <-- ІМПОРТ

let mapInstance = null;
let camerasVisible = true;
let cameraClusteringEnabled = true;
let lastFilters = {};

// Глобальна функція для main.js
window.__setCameraFiltersForModal = (filters = {}) => {
  lastFilters = { ...(filters || {}) };
};

function qs(id) { return document.getElementById(id); }

function buildCameraPanelHtml() {
  // Цей HTML залишається без змін, він правильний
  return `
    <section class="panel" id="camera-filters-panel">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <h3 style="margin:0;">Фільтри камер</h3>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <div class="map-controls-group cameras-visible-group" style="margin:0;">
            <span>Камери</span>
            <label class="toggle-switch" title="Показати/сховати камери">
              <input type="checkbox" id="toggle-cameras-visibility-btn" checked>
              <span class="slider"></span>
            </label>
          </div>
          <div class="map-controls-group camera-clustering-group" style="margin:0;">
            <span>Кластери</span>
            <label class="toggle-switch" title="Кластеризація маркерів камер">
              <input type="checkbox" id="toggle-camera-clustering-btn" checked>
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <label class="field">
        <span>ID камери</span>
        <input id="filter-camera-id" list="filter-camera-id-datalist" placeholder="Введіть ID..." autocomplete="off"/>
        <datalist id="filter-camera-id-datalist"></datalist>
      </label>

      <div class="grid-2">
        <label class="field">
          <span>Область</span>
          <select id="filter-oblast"></select>
        </label>
        <label class="field">
          <span>Район</span>
          <select id="filter-raion"></select>
        </label>
      </div>

      <label class="field">
        <span>Громада</span>
        <select id="filter-hromada"></select>
      </label>

      <label class="field">
        <span>Функціонал / тип ліцензії</span>
        <select id="filter-license-type"></select>
      </label>

      <label class="field">
        <span>Об'єкт аналітики</span>
        <select id="filter-analytics-object"></select>
      </label>

      <div class="grid-2">
        <label class="field">
          <span>Стан</span>
          <select id="filter-camera-status"></select>
        </label>
        <label class="field">
          <span>КА доступ</span>
          <select id="filter-ka-access"></select>
        </label>
      </div>

      <label class="field">
        <span>Інтегрована система</span>
        <select id="filter-system"></select>
      </label>

      <button id="filter-reset-btn" class="btn-secondary" type="button" style="background: var(--danger-color);">Скинути фільтри</button>

      <div id="camera-panel-hint" style="margin-top:10px; opacity:.8; font-size:.9em;"></div>
    </section>
  `;
}

async function applyVisibilityAndClusterState() {
  if (mapInstance) cameraRenderer.setMapInstance(mapInstance);
  cameraRenderer.setVisibility(camerasVisible);

  if (!camerasVisible) {
    cameraRenderer.clearAllCameras();
    return;
  }
  
  // Оновлюємо налаштування кластеризації
  const st = cameraRenderer.getState();
  if (st.isClusteringEnabled !== cameraClusteringEnabled) {
     // У наступному reloadCameras це врахується
  }

  // Викликаємо оновлення через main.js
  await window.reloadCameras?.(lastFilters);
}

function openCameraModal() {
  const container = qs('camera-modal-container');
  if (!container) return;

  const body = qs('camera-modal-body');
  // Рендеримо HTML, якщо панелі ще немає
  if (body) {
    body.innerHTML = buildCameraPanelHtml();
  }

  const hint = qs('camera-panel-hint');
  if (hint) {
    hint.textContent = 'Порада: фільтри звужують запит до БД, перемикачі керують відображенням.';
  }

  container.classList.remove('hidden');

  const overlay = qs('camera-modal-overlay');
  const overlayToggle = qs('camera-toggle-overlay-btn');
  if (overlay && overlayToggle) {
    overlayToggle.checked = false;
    overlay.classList.remove('hidden');
  }

  // Відновлюємо стан перемикачів
  const vis = qs('toggle-cameras-visibility-btn');
  if (vis) vis.checked = camerasVisible;

  const cl = qs('toggle-camera-clustering-btn');
  if (cl) cl.checked = cameraClusteringEnabled;

  // --- ГОЛОВНА ЗМІНА: Ініціалізуємо логіку фільтрів ТУТ ---
  // Передаємо callback, який викликає window.reloadCameras (з main.js)
  initCameraFilters({ 
      onChange: (filters) => {
          lastFilters = filters;
          window.reloadCameras?.(filters);
      }
  });

  // Застосовуємо поточний стан (щоб підтягнути дані)
  applyVisibilityAndClusterState().catch(console.error);
}

function closeCameraModal() {
  const container = qs('camera-modal-container');
  if (container) container.classList.add('hidden');
}

// ... (функції makeDraggable та makeResizable залишаються без змін)
function makeDraggable(element, handle) { /* ... код той самий ... */ 
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
    const rect = element.getBoundingClientRect();
    offsetX = x - rect.left;
    offsetY = y - rect.top;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stopMove);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', stopMove);
  };
  handle.addEventListener('mousedown', startMove);
  handle.addEventListener('touchstart', startMove, { passive: false });
}

function makeResizable(element, resizer) { /* ... код той самий ... */ 
  let startX, startY, startWidth, startHeight;
  const resize = (e) => {
    const x = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    element.style.width = `${startWidth + (x - startX)}px`;
    element.style.height = `${startHeight + (y - startY)}px`;
  };
  const stopResize = () => {
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', resize);
    document.removeEventListener('touchend', stopResize);
  };
  const startResize = (e) => {
    const x = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const y = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    startX = x; startY = y;
    startWidth = parseInt(getComputedStyle(element).width, 10);
    startHeight = parseInt(getComputedStyle(element).height, 10);
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', resize, { passive: false });
    document.addEventListener('touchend', stopResize);
  };
  resizer.addEventListener('mousedown', startResize);
  resizer.addEventListener('touchstart', startResize, { passive: false });
}

function wireCameraModalEvents() {
  const openBtn = qs('open-camera-modal-btn');
  const closeBtn = qs('camera-modal-close-btn');
  const overlay = qs('camera-modal-overlay');
  const overlayToggle = qs('camera-toggle-overlay-btn');

  if (openBtn) openBtn.addEventListener('click', openCameraModal);
  if (closeBtn) closeBtn.addEventListener('click', closeCameraModal);
  if (overlay) overlay.addEventListener('click', closeCameraModal);

  if (overlayToggle && overlay) {
    overlayToggle.addEventListener('change', () => {
      overlay.classList.toggle('hidden', overlayToggle.checked);
    });
  }

  const content = qs('camera-modal-content');
  const header = qs('camera-modal-header');
  const resizer = qs('camera-resizer');

  if (content && header) makeDraggable(content, header);
  if (content && resizer) makeResizable(content, resizer);

  // Делегування подій для динамічних тумблерів
  document.addEventListener('change', async (e) => {
    const id = e.target?.id;

    if (id === 'toggle-cameras-visibility-btn') {
      camerasVisible = !!e.target.checked;
      await applyVisibilityAndClusterState();
    }

    if (id === 'toggle-camera-clustering-btn') {
      cameraClusteringEnabled = !!e.target.checked;
      await applyVisibilityAndClusterState();
    }
  });
}

export function initCameraModal(map) {
  mapInstance = map;
  wireCameraModalEvents();
}