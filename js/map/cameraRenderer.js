// js/map/cameraRenderer.js



let currentMapInstance = null;

const cameraClusterGroup = L.markerClusterGroup();
let nonClusteredCamerasLayer = L.layerGroup();

let lastRendered = {
  cameras: [],
  isClusteringEnabled: true,
  isVisible: true,
};

function safeNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function buildPopup(camera) {
  const entries = Object.entries(camera || {}).filter(([_, v]) => v !== null && v !== undefined && v !== '');
  const rows = entries
    .map(([k, v]) => `<li><strong>${k}:</strong> ${String(v)}</li>`)
    .join('');
  return `<h4>Камера</h4><ul>${rows}</ul>`;
}

function buildCameraIcon(camera) {
  // Простий “камера-значок” divIcon (без залежностей)
  const status = (camera.camera_status || '').toLowerCase();
  const isActive = status.includes('прац') || status.includes('актив') || status.includes('on');

  const color = isActive ? '#2563eb' : '#64748b'; // синій / сірий
  const html = `
    <div class="camera-marker" style="
      width: 26px; height: 26px; border-radius: 50%;
      background: ${color}; border: 2px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      display:flex; align-items:center; justify-content:center;
      color:white; font-size:14px;
    ">
      <i class="fa-solid fa-video"></i>
    </div>
  `;

  return L.divIcon({
    className: 'camera-marker-icon',
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });
}

export function setMapInstance(map) {
  currentMapInstance = map;
  currentMapInstance.addLayer(cameraClusterGroup);
  currentMapInstance.addLayer(nonClusteredCamerasLayer);
}

export function clearAllCameras() {
  cameraClusterGroup.clearLayers();
  nonClusteredCamerasLayer.clearLayers();
}

export function setVisibility(isVisible) {
  lastRendered.isVisible = !!isVisible;
  if (!currentMapInstance) return;

  if (lastRendered.isVisible) {
    currentMapInstance.addLayer(cameraClusterGroup);
    currentMapInstance.addLayer(nonClusteredCamerasLayer);
  } else {
    currentMapInstance.removeLayer(cameraClusterGroup);
    currentMapInstance.removeLayer(nonClusteredCamerasLayer);
  }
}

export function renderCameras(cameras = [], isClusteringEnabled = true) {
  lastRendered.cameras = cameras || [];
  lastRendered.isClusteringEnabled = !!isClusteringEnabled;

  clearAllCameras();

  if (!currentMapInstance || !lastRendered.isVisible) return;
  if (!Array.isArray(cameras) || cameras.length === 0) return;

  const markers = [];

  for (const camera of cameras) {
    const lat = safeNum(camera.lat);
    const lon = safeNum(camera.lon);
    if (lat === null || lon === null) continue;

    const icon = buildCameraIcon(camera);
    const marker = L.marker([lat, lon], { icon });

    marker.bindPopup(buildPopup(camera));
    markers.push(marker);
  }

  if (lastRendered.isClusteringEnabled) {
    cameraClusterGroup.addLayers(markers);
  } else {
    markers.forEach((m) => nonClusteredCamerasLayer.addLayer(m));
  }
}

/**
 * Для “перемикача кластеризації” без повторного fetch.
 */
export function rerenderLast() {
  renderCameras(lastRendered.cameras, lastRendered.isClusteringEnabled);
}

export function getState() {
  return { ...lastRendered };
}
