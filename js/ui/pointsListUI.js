// js/ui/pointsListUI.js

// Форматування дати та часу
function formatDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).replace(',', '');
}

// Форматування різниці часу (хвилини/години)
function formatTimeDiff(seconds) {
    const abs = Math.abs(seconds);
    const sign = seconds >= 0 ? '+' : '-';
    
    if (abs < 60) return `${sign}< 1 хв`;
    
    const m = Math.floor(abs / 60);
    const h = Math.floor(m / 60);
    const remM = m % 60;

    if (h > 0) return `${sign}${h} год ${remM} хв`;
    return `${sign}${m} хв`;
}

// --- НОВА ЛОГІКА СТАТУСУ ---
function getAnomalyStatusHtml(actualSec, expectedSec, thresholds) {
    // ЛОГ ДЛЯ ДЕБАГУ (Якщо дані виглядають дивно)
    if (actualSec > 0 && (!expectedSec || expectedSec === 0)) {
        // console.warn('[PointsUI] Found actualSec but no expectedSec. OSRM failed?');
    }

    // Якщо це перша точка або OSRM не повернув дані
    if (expectedSec === undefined || expectedSec === null) {
        return { 
            anomalyClass: '', 
            diffHtml: '<span class="status-tag tag-neutral" style="justify-content:center;">—</span>' 
        };
    }

    // Різниця: Фактичний - Рекомендований
    const diffSec = actualSec - expectedSec;
    const diffMin = Math.round(diffSec / 60);

    const warnLimit = thresholds?.timeWarning || 40;
    const dangLimit = thresholds?.timeDanger || 120;

    let tagClass = 'tag-success'; 
    let anomalyClass = '';        

    if (diffMin >= dangLimit) {
        tagClass = 'tag-danger';
        anomalyClass = 'row-danger';
    } else if (diffMin >= warnLimit) {
        tagClass = 'tag-warning';
        anomalyClass = 'row-warning';
    } else {
        tagClass = 'tag-success';
    }

    const text = formatTimeDiff(diffSec);

    const diffHtml = `
        <div class="status-tag ${tagClass}">
            <span>${text}</span>
        </div>
    `;

    return { anomalyClass, diffHtml };
}

function isSidebarList(uiRefs) {
    return uiRefs?.list?.id === 'points-list-items';
}

export function renderPointsList(route, state, uiRefs, actions) {
    // ЛОГ ПРИ РЕНДЕРІ
    console.log('[PointsUI] renderPointsList called');
    console.log('[PointsUI] Store Thresholds:', state.anomalyThresholds);

    if (!route) return;

    // Перевіримо дані точок, щоб побачити, чи є expectedDuration
    if (route.normalizedPoints && route.normalizedPoints.length > 1) {
        const sample = route.normalizedPoints[1]; // беремо другу точку
        console.log('[PointsUI] Sample Point Data (Index 1):', {
            segmentDuration: sample.segmentDuration,
            expectedDuration: sample.expectedDuration,
            timestamp: sample.timestamp
        });
    }

    const sidebarMode = isSidebarList(uiRefs);
    const { routeTitle, summary, list } = uiRefs;

    if (routeTitle) routeTitle.textContent = route.name || route.fileName || 'Без назви';

    let pointsToDisplay = route.normalizedPoints;
    if (state.globalDateFilter.size > 0 && !route.isLocked) {
        pointsToDisplay = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return state.globalDateFilter.has(pointDate);
        });
    }

    if (pointsToDisplay.length === 0) {
        if (summary) summary.innerHTML = '';
        if (list) list.innerHTML = '<li class="empty-list-item">Немає точок у вибраному діапазоні</li>';
        return;
    }

    if (summary) {
        summary.innerHTML = `
            <div class="points-table-header points-grid-layout">
                <span style="text-align:center">${sidebarMode ? 'ID' : '#'}</span>
                <span>ДАТА/ЧАС</span>
                <span style="text-align:right">ВІДХИЛЕННЯ</span>
            </div>
        `;
    }

    if (list) {
        list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        pointsToDisplay.forEach((point, filteredIndex) => {
            const li = document.createElement('li');
            li.className = 'point-list-row points-grid-layout';

            const actual = point.segmentDuration || 0;
            const expected = point.expectedDuration || 0;
            
            const originalIndex = route.normalizedPoints.indexOf(point);
            const isFirstGlobal = originalIndex === 0;

            const { anomalyClass, diffHtml } = getAnomalyStatusHtml(
                isFirstGlobal ? 0 : actual, 
                isFirstGlobal ? 0 : expected, 
                state.anomalyThresholds
            );

            if (anomalyClass) li.classList.add(anomalyClass);

            const timeStr = formatDateTime(point.timestamp);
            li.dataset.originalIndex = originalIndex;

            const idxHtml = sidebarMode
                ? `<div class="col-idx" style="line-height:1;">
                     <div style="color:#64748b; font-weight:700;">${originalIndex + 1}</div>
                     <div style="font-size:0.75em; color:#cbd5e1;">${filteredIndex + 1}</div>
                   </div>`
                : `<span class="col-idx">${filteredIndex + 1}</span>`;

            li.innerHTML = `
                ${idxHtml}
                <span class="col-time" style="font-size: 0.9em;">${timeStr}</span>
                <div class="col-diff-wrapper" title="Факт: ${formatTimeDiff(actual)}, Норма: ${formatTimeDiff(expected)}">
                    ${diffHtml}
                </div>
            `;

            li.addEventListener('click', () => {
                const active = list.querySelector('.active-row');
                if (active) active.classList.remove('active-row');
                li.classList.add('active-row');
                li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                if (actions?.onPointClick) actions.onPointClick(route.id, originalIndex);
            });

            fragment.appendChild(li);
        });

        list.appendChild(fragment);
    }
}

export function clearPointsList(uiRefs) {
    if (uiRefs.routeTitle) uiRefs.routeTitle.textContent = '';
    if (uiRefs.summary) uiRefs.summary.innerHTML = '';
    if (uiRefs.list) uiRefs.list.innerHTML = '<li class="empty-list-item">Оберіть маршрут для перегляду</li>';
}

export function renderUniqueDates(container, state, actions) {
    const dateCounts = new Map();
    const sourcePoints = state.routes.size > 0
        ? Array.from(state.routes.values()).flatMap(r => r.normalizedPoints)
        : [];

    sourcePoints.forEach(p => {
        const dateStr = new Date(p.timestamp).toLocaleDateString('uk-UA');
        dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
    });

    const sortedDates = Array.from(dateCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date.split('.').reverse().join('-')) - new Date(b.date.split('.').reverse().join('-')));

    container.innerHTML = '';
    if (sortedDates.length === 0) {
        container.innerHTML = '<li class="empty-list-item">Немає даних</li>';
        return;
    }

    sortedDates.forEach(({ date, count }) => {
        const li = document.createElement('li');
        if (state.globalDateFilter.has(date)) li.classList.add('active');

        li.innerHTML = `
            <span class="unique-date-str">${date}</span>
            <span class="unique-date-count">${count} фікс.</span>
        `;
        li.addEventListener('click', (event) => actions.onDateClick(date, event));
        container.appendChild(li);
    });
}