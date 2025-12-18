// js/ui/pointsListUI.js
import { formatDuration } from './map/markerUtils.js';

export function clearPointsList(uiRefs) {
    uiRefs.routeTitle.textContent = '';
    uiRefs.summary.innerHTML = '';
    uiRefs.list.innerHTML = '<li class="empty-list-item">Оберіть маршрут для перегляду</li>';
}

function isSidebarList(uiRefs) {
    return uiRefs?.list?.id === 'points-list-items';
}

function timeHHMM(ts) {
    return new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function buildDiffTag(point) {
    let anomalyClass = '';
    let diffHtml = '<span class="status-tag tag-neutral" style="justify-content:center;">—</span>';
    let planText = '<span class="faded">—</span>';
    let factText = '<span class="faded">—</span>';

    if (point.timingInfo) {
        const { expected, actual, diff, percent } = point.timingInfo;

        planText = formatDuration(expected);
        factText = formatDuration(actual);

        const sign = diff > 0 ? '+' : '';
        const absPercent = Math.abs(Math.round(percent));

        let tagClass = 'tag-success';

        if (diff > 0) { // затримка
            if (point.anomalyLevel === 'high') {
                tagClass = 'tag-danger';
                anomalyClass = 'row-danger';
            } else if (point.anomalyLevel === 'medium') {
                tagClass = 'tag-warning';
                anomalyClass = 'row-warning';
            } else {
                tagClass = 'tag-neutral';
            }
        }

        diffHtml = `
            <div class="status-tag ${tagClass}">
                <span>${sign}${formatDuration(diff)}</span>
                <small>${absPercent}%</small>
            </div>
        `;
    }

    return { anomalyClass, diffHtml, planText, factText };
}

export function renderPointsList(route, state, uiRefs, actions) {
    if (!route) return;

    const sidebarMode = isSidebarList(uiRefs);

    uiRefs.routeTitle.textContent = route.fileName;

    // Фільтрація точок
    let pointsToDisplay = route.normalizedPoints;
    if (state.globalDateFilter.size > 0 && !route.isLocked) {
        pointsToDisplay = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return state.globalDateFilter.has(pointDate);
        });
    }

    if (pointsToDisplay.length === 0) {
        uiRefs.summary.innerHTML = '';
        uiRefs.list.innerHTML = '<li class="empty-list-item">Немає точок у вибраному діапазоні</li>';
        return;
    }

    // HEADER (sticky)
    // У сайдбарі в першій колонці показуємо "ID/#" (оригінал/після фільтра)
    uiRefs.summary.innerHTML = `
        <div class="points-table-header points-grid-layout">
            <span style="text-align:center">${sidebarMode ? 'ID/#' : '#'}</span>
            <span>ЧАС</span>
            <span style="text-align:right">ПЛАН</span>
            <span style="text-align:right">ФАКТ</span>
            <span style="text-align:right">ВІДХИЛЕННЯ</span>
        </div>
    `;

    uiRefs.list.innerHTML = '';
    const fragment = document.createDocumentFragment();

    pointsToDisplay.forEach((point, filteredIndex) => {
        const li = document.createElement('li');
        li.className = 'point-list-row points-grid-layout';

        const { anomalyClass, diffHtml, planText, factText } = buildDiffTag(point);
        if (anomalyClass) li.classList.add(anomalyClass);

        const timeStr = timeHHMM(point.timestamp);

        // originalIndex: позиція в повному масиві (як у файлі)
        const originalIndex = route.normalizedPoints.indexOf(point);
        li.dataset.originalIndex = originalIndex;

        // COL IDX:
        // - sidebar: показуємо original+1 та filtered+1 (два рядки)
        // - modal: показуємо лише filtered+1
        const idxHtml = sidebarMode
            ? `
                <div class="col-idx" style="display:flex; flex-direction:column; align-items:center; line-height:1.05;">
                    <span style="font-weight:700; color:#64748b;">${originalIndex + 1}</span>
                    <span style="font-size:.75em; color:#94a3b8;">${filteredIndex + 1}</span>
                </div>
              `
            : `<span class="col-idx">${filteredIndex + 1}</span>`;

        li.innerHTML = `
            ${idxHtml}
            <span class="col-time">${timeStr}</span>
            <span class="col-val">${planText}</span>
            <span class="col-val" style="font-weight:700; color:#1e293b;">${factText}</span>
            <div class="col-diff-wrapper">${diffHtml}</div>
        `;

        li.addEventListener('click', () => {
            const active = uiRefs.list.querySelector('.active-row');
            if (active) active.classList.remove('active-row');

            li.classList.add('active-row');
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            if (actions?.onPointClick) actions.onPointClick(route.id, originalIndex);
        });

        fragment.appendChild(li);
    });

    uiRefs.list.appendChild(fragment);
}

// renderUniqueDates — без змін
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
