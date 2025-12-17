// js/ui/cameraModal.js
//
// Модалка "Фільтр та налаштування камер".
// - Камери увімкнені за замовчуванням
// - Є перемикач видимості + кластеризації
// - Фільтри звужують запит через window.reloadCameras(filters)

import * as cameraRenderer from '../map/cameraRenderer.js';

let mapInstance = null;

let camerasVisible = true;
let cameraClusteringEnabled = true;

// останні фільтри (їх оновлює main.js через window.reloadCameras)
let lastFilters = {};

// даємо main.js спосіб “передати” активні фільтри в модалку
window.__setCameraFiltersForModal = (filters = {}) => {
  lastFilters = { ...(filters || {}) };
};

function qs(id) {
  return document.getElementById(id);
}

function buildCameraPanelHtml() {
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
        <input id="filter-camera-id" list="filter-camera-id-datalist" placeholder="1335_0." autocomplete="off"/>
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

      <button id="filter-reset-btn" class="btn-secondary" type="button">Скинути фільтри</button>

      <div id="camera-panel-hint" style="margin-top:10px; opacity:.8; font-size:.9em;"></div>
    </section>
  `;
}

async function applyVisibilityAndClusterState() {
  // привʼязуємо map один раз
  if (mapInstance) cameraRenderer.setMapInstance(mapInstance);

  cameraRenderer.setVisibility(camerasVisible);

  // якщо видимість вимкнена — чистимо, але нічого не фетчимо
  if (!camerasVisible) {
    cameraRenderer.clearAllCameras();
    return;
  }

  // кластеризація: просто міняємо state і просимо main.js перерендерити поточний набір
  // (перерендер відбудеться через window.reloadCameras)
  const st = cameraRenderer.getState();
  if (st.isClusteringEnabled !== cameraClusteringEnabled) {
    // збережемо бажаний стан в renderer
    // найпростіше: викличемо renderCameras ще раз тим самим набором (main.js зробить це, коли reloadCameras відпрацює)
  }

  await window.reloadCameras?.(lastFilters);
}

function openCameraModal() {
  const container = qs('camera-modal-container');
  if (!container) return;

  const body = qs('camera-modal-body');
  if (body && !qs('camera-filters-panel')) {
    body.innerHTML = buildCameraPanelHtml();
  }

  const hint = qs('camera-panel-hint');
  if (hint) {
    hint.textContent = 'Порада: фільтри звужують запит до /api/cameras, а перемикачі керують відображенням.';
  }

  container.classList.remove('hidden');

  // overlay
  const overlay = qs('camera-modal-overlay');
  const overlayToggle = qs('camera-toggle-overlay-btn');
  if (overlay && overlayToggle) {
    overlayToggle.checked = false;
    overlay.classList.remove('hidden');
  }

  // проставляємо тумблери
  const vis = qs('toggle-cameras-visibility-btn');
  if (vis) vis.checked = camerasVisible;

  const cl = qs('toggle-camera-clustering-btn');
  if (cl) cl.checked = cameraClusteringEnabled;

  // ініціалізуємо списки фільтрів (cameraFilters.js шукає елементи по id)
  try {
    window.initCameraFilters?.();
  } catch {}

  // і рендеримо по активних фільтрах
  applyVisibilityAndClusterState().catch(console.error);
}

function closeCameraModal() {
  const container = qs('camera-modal-container');
  if (!container) return;
  container.classList.add('hidden');
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

function makeResizable(element, resizer) {
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

    startX = x;
    startY = y;

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

  // тумблери (делегування — бо елементи зʼявляються при open)
  document.addEventListener('change', async (e) => {
    const id = e.target?.id;

    if (id === 'toggle-cameras-visibility-btn') {
      camerasVisible = !!e.target.checked;
      await applyVisibilityAndClusterState();
    }

    if (id === 'toggle-camera-clustering-btn') {
      cameraClusteringEnabled = !!e.target.checked;

      // оновлюємо стан renderer і перерендеримо поточний набір
      const st = cameraRenderer.getState();
      st.isClusteringEnabled = cameraClusteringEnabled; // локально
      // найнадійніше: просто просимо main.js перерендерити (він передасть isClusteringEnabled з renderer.getState())
      await applyVisibilityAndClusterState();
    }
  });
}

export function initCameraModal(map) {
  mapInstance = map;
  wireCameraModalEvents();

  // За замовчуванням камери мають бути увімкнені на карті одразу
  applyVisibilityAndClusterState().catch(console.error);
}
