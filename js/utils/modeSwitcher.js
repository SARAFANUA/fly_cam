// js/utils/modeSwitcher.js
//
// ✅ Оновлено під новий index.html з #routes-panel / #systems-panel + #mode-select
// ✅ Не ламає UI, якщо чогось немає — просто пропускає
// ✅ Камери підтягуються ТІЛЬКИ в режимі "systems" (щоб не заважали маршрутам)
// ✅ Працює з новими ID: toggle-cameras-btn, toggle-camera-clusters-btn
// ✅ Не спамить помилками, якщо cameraRenderer ще не має шару/мапи
//
// Потрібні методи у ../map/cameraRenderer.js (або сумісні):
// - setMapInstance(map)
// - renderCameras(items, clusteringEnabled)
// - clearAllCameras()
// - setVisibility(boolean)   (можна не мати — тоді ми просто clear/render)

import { fetchCameras } from '../api/camerasApi.js';
import * as cameraRenderer from '../map/cameraRenderer.js';

let currentMode = 'routes'; // 'routes' | 'systems'

let camerasLoaded = false;
let cachedCameras = [];
let isCameraClusteringEnabled = true;
let camerasVisible = true;

function qs(id) {
  return document.getElementById(id);
}

function safeCall(fn, ...args) {
  try {
    if (typeof fn === 'function') return fn(...args);
  } catch (e) {
    console.error(e);
  }
}

function setElHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', !!hidden);
}

function applyLayoutForMode(mode) {
  // Панелі
  setElHidden(qs('routes-panel'), mode !== 'routes');
  setElHidden(qs('systems-panel'), mode !== 'systems');

  // Заголовок
  const titleEl = qs('sidebar-title') || document.querySelector('.sidebar-header h1');
  if (titleEl) {
    titleEl.textContent = (mode === 'systems')
      ? 'Аналіз систем відеоспостереження'
      : 'Аналіз маршруту';
  }

  // Drag&Drop (маршрути)
  const dropArea = qs('drop-area');
  if (dropArea) dropArea.style.display = (mode === 'systems') ? 'none' : '';

  // Фільтр по даті (маршрути)
  setElHidden(qs('date-filter-section'), mode !== 'routes');
}

async function loadCamerasOnce() {
  if (camerasLoaded) return cachedCameras;

  const data = await fetchCameras({ limit: 200000, offset: 0 });
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  cachedCameras = items;
  camerasLoaded = true;

  return cachedCameras;
}

async function updateCamerasLayer() {
  // Камери показуємо тільки в режимі systems
  if (currentMode !== 'systems') {
    safeCall(cameraRenderer.clearAllCameras);
    safeCall(cameraRenderer.setVisibility, false);
    return;
  }

  if (!camerasVisible) {
    safeCall(cameraRenderer.clearAllCameras);
    safeCall(cameraRenderer.setVisibility, false);
    return;
  }

  safeCall(cameraRenderer.setVisibility, true);

  const cams = await loadCamerasOnce();
  safeCall(cameraRenderer.renderCameras, cams, isCameraClusteringEnabled);
}

function applyMode(mode) {
  currentMode = (mode === 'systems') ? 'systems' : 'routes';
  applyLayoutForMode(currentMode);
  updateCamerasLayer().catch(console.error);
}

function ensureModeSelectFallback() {
  // Якщо в HTML немає mode-select — додаємо мінімальний
  if (qs('mode-select')) return;

  // Перевага: в #global-controls (новий index.html), далі перший .map-controls
  const host =
    qs('global-controls') ||
    document.querySelector('.map-controls') ||
    document.querySelector('.sidebar-scrollable-content');

  if (!host) return;

  const wrap = document.createElement('div');
  wrap.className = 'map-controls-group mode-group';
  wrap.innerHTML = `
    <label for="mode-select">Режим:</label>
    <select id="mode-select" class="custom-select">
      <option value="routes">Аналіз маршрутів</option>
      <option value="systems">Аналіз систем</option>
    </select>
  `;
  host.prepend(wrap);
}

function wireSystemToggles() {
  // Нові ID з оновленого index.html
  const camerasToggle = qs('toggle-cameras-btn');
  const clustersToggle = qs('toggle-camera-clusters-btn');

  if (camerasToggle) {
    camerasToggle.checked = camerasVisible;
    camerasToggle.addEventListener('change', async (e) => {
      camerasVisible = !!e.target.checked;
      await updateCamerasLayer();
    });
  }

  if (clustersToggle) {
    clustersToggle.checked = isCameraClusteringEnabled;
    clustersToggle.addEventListener('change', async (e) => {
      isCameraClusteringEnabled = !!e.target.checked;
      await updateCamerasLayer();
    });
  }

  // Backward compatibility: якщо в старому HTML залишились старі ID
  const oldVis = qs('toggle-cameras-visibility-btn');
  if (oldVis && !camerasToggle) {
    oldVis.checked = camerasVisible;
    oldVis.addEventListener('change', async (e) => {
      camerasVisible = !!e.target.checked;
      await updateCamerasLayer();
    });
  }

  const oldCluster = qs('toggle-camera-clustering-btn');
  if (oldCluster && !clustersToggle) {
    oldCluster.checked = isCameraClusteringEnabled;
    oldCluster.addEventListener('change', async (e) => {
      isCameraClusteringEnabled = !!e.target.checked;
      await updateCamerasLayer();
    });
  }
}

export function initModeSwitcher(map) {
  ensureModeSelectFallback();

  // Потрібно, щоб cameraRenderer мав map instance (якщо метод існує)
  safeCall(cameraRenderer.setMapInstance, map);

  // Режим
  const modeSelect = qs('mode-select');
  if (modeSelect) {
    // Якщо в localStorage є попередній режим — відновимо
    const saved = localStorage.getItem('flyka_mode');
    if (saved === 'routes' || saved === 'systems') currentMode = saved;

    modeSelect.value = currentMode;
    modeSelect.addEventListener('change', (e) => {
      const v = e.target.value;
      localStorage.setItem('flyka_mode', v);
      applyMode(v);
    });
  }

  wireSystemToggles();

  // Початкове застосування режиму + рендер камер (тільки якщо systems)
  applyLayoutForMode(currentMode);
  updateCamerasLayer().catch(console.error);
}

export function getMode() {
  return currentMode;
}
