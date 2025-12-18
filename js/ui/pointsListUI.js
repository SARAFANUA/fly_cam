// js/ui/pointsListUI.js
import { formatDuration } from '../map/markerUtils.js';

export function clearPointsList(uiRefs) {
    uiRefs.routeTitle.textContent = '';
    uiRefs.summary.innerHTML = '';
    uiRefs.list.innerHTML = '<li class="empty-list-item">Оберіть маршрут для перегляду</li>';
}

export function renderPointsList(route, state, uiRefs, actions) {
    if (!route) return;

    uiRefs.routeTitle.textContent = route.fileName;
    
    let pointsToDisplay = route.normalizedPoints;
    if (state.globalDateFilter.size > 0 && !route.isLocked) {
        pointsToDisplay = route.normalizedPoints.filter(p => {
            const pointDate = new Date(p.timestamp).toLocaleDateString('uk-UA');
            return state.globalDateFilter.has(pointDate);
        });
    }

    if (pointsToDisplay.length === 0) {
        uiRefs.list.innerHTML = '<li class="empty-list-item">Немає точок у вибраному діапазоні</li>';
        return;
    }

    // Заголовок таблиці
    uiRefs.summary.innerHTML = `
        <div class="points-table-header">
            <span style="width:30px">#</span>
            <span style="flex:1">Час</span>
            <span style="width:70px; text-align:right">План</span>
            <span style="width:70px; text-align:right">Факт</span>
            <span style="width:90px; text-align:right">Різниця</span>
        </div>
    `;
    uiRefs.list.innerHTML = '';

    pointsToDisplay.forEach((point, index) => {
        const li = document.createElement('li');
        li.className = 'point-list-row';
        
        // Визначаємо клас для кольору рядка
        let anomalyClass = '';
        let diffHtml = '<span style="color:#ccc">-</span>';
        let planText = '-';
        let factText = '-';

        // Використовуємо вже розраховані дані з anomalyService (timingInfo)
        if (point.timingInfo) {
            const { expected, actual, diff, percent } = point.timingInfo;
            
            // Форматуємо час
            planText = formatDuration(expected);
            factText = formatDuration(actual);
            
            const sign = diff > 0 ? '+' : '';
            const color = diff > 0 ? 'var(--danger-color)' : 'var(--success-color)';
            
            // Якщо відхилення більше 20% (або те, що в налаштуваннях store), підсвічуємо
            if (point.anomalyLevel === 'high') anomalyClass = 'row-danger';
            else if (point.anomalyLevel === 'medium') anomalyClass = 'row-warning';

            diffHtml = `<span style="color:${color}; font-weight:600;">${sign}${formatDuration(diff)} <small>(${Math.round(percent)}%)</small></span>`;
        }

        if (anomalyClass) li.classList.add(anomalyClass);

        li.innerHTML = `
            <span class="col-idx">${index + 1}</span>
            <span class="col-time">${new Date(point.timestamp).toLocaleTimeString('uk-UA', {hour:'2-digit', minute:'2-digit'})}</span>
            <span class="col-val">${planText}</span>
            <span class="col-val">${factText}</span>
            <span class="col-diff">${diffHtml}</span>
        `;

        const originalIndex = route.normalizedPoints.indexOf(point);
        li.dataset.originalIndex = originalIndex;
        
        li.addEventListener('click', () => {
            // Виділяємо активний рядок
            const active = uiRefs.list.querySelector('.active-row');
            if (active) active.classList.remove('active-row');
            li.classList.add('active-row');
            
            actions.onPointClick(route.id, originalIndex);
        });

        uiRefs.list.appendChild(li);
    });
}

// renderUniqueDates залишається без змін (можна залишити старий код)
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
        if (state.globalDateFilter.has(date)) {
            li.classList.add('active');
        }
        li.innerHTML = `
            <span class="unique-date-str">${date}</span>
            <span class="unique-date-count">${count} фікс.</span>
        `;
        li.addEventListener('click', (event) => actions.onDateClick(date, event));
        container.appendChild(li);
    });
}