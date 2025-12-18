// js/map/markerUtils.js

export function createClusterIcon(cluster) {
    const count = cluster.getChildCount();
    let sizeClass = 'route-cluster-small';
    let size = 35;

    if (count > 50) { sizeClass = 'route-cluster-large'; size = 50; } 
    else if (count > 10) { sizeClass = 'route-cluster-medium'; size = 42; }

    return L.divIcon({
        html: `<span>${count}</span>`,
        className: `route-cluster ${sizeClass}`,
        iconSize: L.point(size, size)
    });
}

export function createMarkerIcon(index, totalCount, isAnomaly) {
    let typeClass = '';
    let text = (index + 1).toString();
    
    if (index === 0) { typeClass = 'marker-start'; text = 'S'; } 
    else if (index === totalCount - 1) { typeClass = 'marker-finish'; text = 'F'; } 
    else if (isAnomaly === 'high') { typeClass = 'marker-danger'; } 
    else if (isAnomaly === 'medium') { typeClass = 'marker-warning'; }

    return L.divIcon({
        className: `custom-marker-icon ${typeClass}`,
        html: `<div class="marker-pin"></div><div class="marker-number">${text}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -40]
    });
}

// ✅ Оновлене форматування (округлення до хвилин)
export function formatDuration(sec) {
    if (sec === undefined || sec === null) return '-';
    
    const absSec = Math.abs(sec);
    // Округляємо до хвилин
    const totalMinutes = Math.round(absSec / 60);

    if (totalMinutes === 0 && absSec > 0) return '< 1 хв';
    if (totalMinutes === 0) return '0 хв';

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const sign = sec < 0 ? '-' : ''; 
    let parts = [];
    
    if (h > 0) parts.push(`${h} год`);
    if (m > 0) parts.push(`${m} хв`);
    
    return sign + parts.join(' ');
}

function cleanValue(val) {
    if (typeof val !== 'string') return val;
    // Видаляємо GMT та дужки часового поясу
    if (val.includes('GMT')) {
        return val.split('GMT')[0].trim().replace(/\([^\)]+\)$/, '').trim();
    }
    return val;
}

export function generatePopupContent(point, displayIndex) {
    const timeStr = new Date(point.timestamp).toLocaleString('uk-UA', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    let html = `
        <div style="font-size:1.1em; margin-bottom:5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
            <b>Точка №${displayIndex + 1}</b>
        </div>
        <div style="margin-bottom: 8px; font-size: 0.95em; color: #555;">
            <i class="fa-regular fa-clock"></i> ${timeStr}
        </div>
    `;

    // ✅ Лаконічний блок аномалій
    if (point.timingInfo) {
        const { expected, actual, diff, percent } = point.timingInfo;
        const isDelay = diff > 0;
        const color = isDelay ? 'red' : 'green';
        const sign = isDelay ? '+' : '';
        
        html += `
            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; font-size: 0.9em; border: 1px solid #eee;">
                <div style="display:grid; grid-template-columns: 1fr auto; gap: 4px; align-items:center;">
                    <span style="color:#666;">Очікувано:</span> 
                    <b>${formatDuration(expected)}</b>
                    
                    <span style="color:#666;">Фактично:</span> 
                    <b>${formatDuration(actual)}</b>
                    
                    <span style="color:#666;">Різниця:</span> 
                    <span style="color:${color}; font-weight:bold;">
                        ${sign}${formatDuration(diff)} <small>(${sign}${Math.round(percent)}%)</small>
                    </span>
                </div>
            </div>
        `;
    }
    
    if (point.originalData) {
        html += `<div style="margin-top: 8px; font-size: 0.85em; color:#444; max-height: 150px; overflow-y: auto;">`;
        html += `<ul style="list-style: none; padding: 0; margin: 0;">`;
        
        const skipKeys = new Set(['lat', 'lon', 'latitude', 'longitude', 'x', 'y']);
        const timeKeys = new Set(['timestamp', 'time', 'datetime', 'час фіксації', 'date time', 'pass time', 'час']);

        for (const [key, rawVal] of Object.entries(point.originalData)) {
            const lowerKey = key.toLowerCase();
            if (skipKeys.has(lowerKey) || timeKeys.has(lowerKey)) continue;

            const val = cleanValue(rawVal);
            html += `<li style="margin-bottom: 2px;">
                        <strong style="color:#666;">${key}:</strong> ${val}
                     </li>`;
        }
        html += `</ul></div>`;
    }

    return html;
}

export function findClosestPointIndex(targetPoint, geometry) {
    if (!geometry || !Array.isArray(geometry)) return -1;
    let closestIndex = -1;
    let minDistance = Infinity;
    
    geometry.forEach((coords, index) => {
        const point = L.latLng(coords[0], coords[1]);
        const distance = targetPoint.distanceTo(point);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
        }
    });
    return closestIndex;
}