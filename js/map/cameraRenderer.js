// js/map/cameraRenderer.js

let currentMapInstance = null;
let nonClusteredCamerasLayer = L.layerGroup();

let lastRendered = {
  cameras: [],
  isClusteringEnabled: true,
  isVisible: true,
};

// Словник нормалізації
const NORMALIZATION_MAP = {
  // КА Доступ / Загальні
  'hi': 'Ні', 'ні': 'Ні', 'no': 'Ні', 'так': 'Так', 'yes': 'Так', 'true': 'Так', 'false': 'Ні',
  // Статуси
  'прцює': 'Працює', 'працює': 'Працює', 'active': 'Працює', 'on': 'Працює',
  'тимчасово не працює': 'Тимчасово не працює', 'тимчасово непрацює': 'Тимчасово не працює',
  'не працює': 'Не працює', 'виведена з ладу': 'Виведена з ладу', 'відключена': 'Відключена',
  'знищена': 'Знищена', 'демонтована': 'Демонтована',
  // Інтеграція
  'камера інтегрована до системи': 'Інтегрована', 'не інтегрована': 'Не інтегрована'
};

function safeNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  const lower = str.toLowerCase();
  return NORMALIZATION_MAP[lower] || str;
}

// --- ВИЗНАЧЕННЯ КОЛЬОРУ (СТАТУС) ---
function getStatusColor(statusRaw) {
    const s = statusRaw.toLowerCase();
    
    // 1. Червоні (критичні)
    if (s.includes('знищена') || s.includes('демонтована') || s.includes('ладу')) {
        return '#dc2626'; 
    }
    // 2. Жовті (тимчасові проблеми)
    if (s.includes('не працює') || s.includes('тимчасово') || s.includes('відключена')) {
        return '#f59e0b'; 
    }
    // 3. Зелені (активні)
    if (s.includes('працює') || s.includes('active') || s.includes('on')) {
        return '#16a34a'; 
    }
    
    return '#64748b'; // Сірий за замовчуванням
}

// --- ВИЗНАЧЕННЯ ІКОНКИ (ОБ'ЄКТ АНАЛІТИКИ) - ОНОВЛЕНО ---
function getAnalyticsIcon(analyticsRaw) {
    if (!analyticsRaw) return 'fa-solid fa-video'; 
    
    const s = analyticsRaw.toLowerCase();

    // 1. Явно "Без аналітики" -> звичайна камера
    if (s.includes('без аналіт') || s.includes('no analyt')) {
        return 'fa-solid fa-video';
    }

    // 2. ТЗ (Авто)
    if (s.includes('тз') || s.includes('авто') || s.includes('vehicle') || s.includes('car') || s.includes('номер')) {
        return 'fa-solid fa-car';
    }

    // 3. Люди
    if (s.includes('особ') || s.includes('облич') || s.includes('human') || s.includes('face') || s.includes('person')) {
        return 'fa-solid fa-user';
    }

    // 4. Інші аналітичні (якщо є слово "інші" або "аналіт", але не "без") -> Мікросхема (Smart)
    if (s.includes('інші') || s.includes('other') || s.includes('аналіт')) {
        return 'fa-solid fa-microchip'; // Або fa-eye, fa-brain
    }

    // За замовчуванням
    return 'fa-solid fa-video';
}

// --- POPUP ---
function buildPopup(p) {
  const status = normalizeValue(p.camera_status) || 'Невідомо';
  const kaAccess = normalizeValue(p.ka_access) || '—';
  const license = normalizeValue(p.license_type);
  const analytics = normalizeValue(p.analytics_object);
  const integSystem = p.integrated_systems || '';

  const statusLower = status.toLowerCase();
  let statusClass = 'status-gray';
  let statusIcon = '<i class="fa-solid fa-circle-question"></i>';

  if (statusLower.includes('знищена') || statusLower.includes('демонтована') || statusLower.includes('ладу')) {
      statusClass = 'status-red'; 
      statusIcon = '<i class="fa-solid fa-ban"></i>';
  } else if (statusLower.includes('не працює') || statusLower.includes('тимчасово') || statusLower.includes('відключена')) {
      statusClass = 'status-yellow';
      statusIcon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  } else if (statusLower.includes('працює')) {
      statusClass = 'status-green'; 
      statusIcon = '<i class="fa-solid fa-check-circle"></i>';
  }

  const settlement = [p.settlement_type, p.settlement_name].filter(Boolean).join(' ');
  const street = p.highway_number 
      ? `🛣️ ${p.highway_number}` 
      : [p.street_type, p.street_name].filter(Boolean).join(' ');

  const locationStr = [p.oblast, p.raion ? p.raion + ' р-н' : '', p.hromada ? p.hromada + ' ТГ' : ''].filter(Boolean).join(', ');
  const camName = p.camera_name || 'Камера без назви';
  const camId = p.camera_id || 'ID відсутній';

  return `
      <div class="camera-popup-card">
          <div class="popup-header">
              <h3>${camName}</h3>
              <div class="popup-subtitle">${camId}</div>
          </div>
          <div class="popup-body">
              <div class="popup-row location-row">
                  <i class="fa-solid fa-location-dot"></i>
                  <div>
                      <div class="location-main">${settlement}</div>
                      <div class="location-sub">${street}</div>
                      <div class="location-meta">${locationStr}</div>
                  </div>
              </div>
              <div class="popup-badge ${statusClass}">
                  ${statusIcon} <span>${status}</span>
              </div>
              <div class="popup-grid">
                  ${license ? `<div class="info-item"><strong>Функціонал:</strong> ${license}</div>` : ''}
                  ${analytics ? `<div class="info-item"><strong>Об'єкт:</strong> ${analytics}</div>` : ''}
              </div>
              <div class="popup-row access-row">
                  <strong>Доступ КА:</strong> 
                  <span class="ka-val ${kaAccess === 'Так' ? 'text-green' : 'text-red'}">${kaAccess}</span>
              </div>
          </div>
          ${integSystem ? `
          <div class="popup-footer">
              <div class="popup-subtitle" title="Інтегрована система">${integSystem}</div>
          </div>` : ''}
      </div>
  `;
}

function formatCount(n) {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n;
}

// --- ІКОНКА ---
function buildCameraIcon(camera) {
  const statusNormal = normalizeValue(camera.camera_status);
  
  // 1. Колір (Статус)
  const color = getStatusColor(statusNormal);
  
  // 2. Іконка (Аналітика)
  const iconClass = getAnalyticsIcon(camera.analytics_object);
  
  const gradId = `fov-grad-${color.replace('#', '')}`;

  const azimuth = parseFloat(camera.azimuth);
  const hasAzimuth = !isNaN(azimuth);

  let fovHtml = '';
  if (hasAzimuth) {
      fovHtml = `
        <div class="camera-fov-container" style="transform: translate(-50%, -50%) rotate(${azimuth}deg);">
            <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="${gradId}" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" style="stop-color:${color}; stop-opacity:0.85" />
                        <stop offset="100%" style="stop-color:${color}; stop-opacity:0.15" />
                    </linearGradient>
                </defs>
                <path d="M60 60 L15 0 A 60 60 0 0 1 105 0 Z" 
                      fill="url(#${gradId})" 
                      stroke="${color}" 
                      stroke-width="1.5" 
                      stroke-opacity="0.8"
                />
            </svg>
        </div>
      `;
  }

  const markerHtml = `
    <div class="camera-marker-body" style="background: ${color};">
      <i class="${iconClass}"></i>
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
        if (count >= 1000) { sizeClass = 'cluster-region'; size = 64; } 
        else if (count >= 100) { sizeClass = 'cluster-district'; size = 54; }

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

// --- ЕКСПОРТОВАНІ ФУНКЦІЇ ---
export function setMapInstance(map) {
  currentMapInstance = map;
  currentMapInstance.addLayer(cameraClusterGroup);
  currentMapInstance.addLayer(nonClusteredCamerasLayer);

  const updateFovVisibility = () => {
      const zoom = map.getZoom();
      const container = map.getContainer();
      if (zoom >= 14) container.classList.add('map-show-fov');
      else container.classList.remove('map-show-fov');
  };

  map.on('zoomend', updateFovVisibility);
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