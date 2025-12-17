// js/map/cameraRenderer.js

let currentMapInstance = null;
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

function formatCount(n) {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n;
}

// --- ПОКРАЩЕНА ІКОНКА ---
function buildCameraIcon(camera) {
  const status = (camera.camera_status || '').toLowerCase();
  const isActive = status.includes('прац') || status.includes('актив') || status.includes('on');
  const bgColor = isActive ? '#2563eb' : '#64748b'; 

  const azimuth = parseFloat(camera.azimuth);
  const hasAzimuth = !isNaN(azimuth);

  let fovHtml = '';
  if (hasAzimuth) {
      // Збільшуємо розмір SVG до 120px для довгого променя
      fovHtml = `
        <div class="camera-fov-container" style="transform: translate(-50%, -50%) rotate(${azimuth}deg);">
            <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="fov-grad-${isActive ? 'on' : 'off'}" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" style="stop-color:${bgColor}; stop-opacity:0.85" />
                        <stop offset="100%" style="stop-color:${bgColor}; stop-opacity:0.15" />
                    </linearGradient>
                </defs>
                <path d="M60 60 L15 0 A 60 60 0 0 1 105 0 Z" 
                      fill="url(#fov-grad-${isActive ? 'on' : 'off'})" 
                      stroke="${bgColor}" 
                      stroke-width="1.5" 
                      stroke-opacity="0.8"
                />
            </svg>
        </div>
      `;
  }

  const markerHtml = `
    <div class="camera-marker-body" style="background: ${bgColor};">
      <i class="fa-solid fa-video"></i>
    </div>
  `;

  return L.divIcon({
    className: 'camera-icon-wrapper',
    html: `<div class="camera-combined-icon">${fovHtml}${markerHtml}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

// --- КОНФІГУРАЦІЯ КЛАСТЕРІВ ---
const cameraClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    removeOutsideVisibleBounds: true,
    animate: true,

    maxClusterRadius: function (zoom) {
        if (zoom <= 6) return 140; 
        if (zoom <= 8) return 100;
        if (zoom <= 11) return 80;
        return 60;
    },

    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let sizeClass = 'cluster-small';
        let size = 44; 

        if (count >= 1000) {
            sizeClass = 'cluster-region';
            size = 64; 
        } else if (count >= 100) {
            sizeClass = 'cluster-district';
            size = 54;
        }

        return L.divIcon({
            html: `
                <div class="cluster-content">
                    <i class="fa-solid fa-video cluster-icon"></i>
                    <span class="cluster-count">${formatCount(count)}</span>
                </div>
            `,
            className: `custom-cluster ${sizeClass}`,
            iconSize: L.point(size, size)
        });
    }
});

// --- ОНОВЛЕНА ФУНКЦІЯ ПІДКЛЮЧЕННЯ КАРТИ ---
export function setMapInstance(map) {
  currentMapInstance = map;
  currentMapInstance.addLayer(cameraClusterGroup);
  currentMapInstance.addLayer(nonClusteredCamerasLayer);

  // Логіка видимості конусів залежно від зуму
  const updateFovVisibility = () => {
      const zoom = map.getZoom();
      const container = map.getContainer();
      
      // Показуємо конуси тільки якщо зум >= 14 (вулиці)
      if (zoom >= 14) {
          container.classList.add('map-show-fov');
      } else {
          container.classList.remove('map-show-fov');
      }
  };

  // Слухаємо зміну зуму
  map.on('zoomend', updateFovVisibility);
  
  // Викликаємо одразу для ініціалізації
  updateFovVisibility();
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

export function rerenderLast(isClusteringEnabled) {
  lastRendered.isClusteringEnabled = !!isClusteringEnabled;
  renderCameras(lastRendered.cameras, lastRendered.isClusteringEnabled);
}

export function getState() {
  return { ...lastRendered };
}