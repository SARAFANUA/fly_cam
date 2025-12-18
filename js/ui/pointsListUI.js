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
    
    // Фільтрація точок
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

    // 1. ЗАГОЛОВОК ТАБЛИЦІ
    // Додаємо клас points-grid-layout, щоб він мав ту ж саму сітку, що й рядки
    uiRefs.summary.innerHTML = `
        <div class="points-table-header points-grid-layout">
            <span style="text-align: center">#</span>
            <span>ЧАС</span>
            <span style="text-align: right">ПЛАН</span>
            <span style="text-align: right">ФАКТ</span>
            <span style="text-align: right">ВІДХИЛЕННЯ</span>
        </div>
    `;
    
    uiRefs.list.innerHTML = '';
    const fragment = document.createDocumentFragment();

    pointsToDisplay.forEach((point, index) => {
        const li = document.createElement('li');
        
        // Додаємо два класи: 
        // point-list-row (стилі рядка, ховер, курсор)
        // points-grid-layout (структура колонок Grid)
        li.className = 'point-list-row points-grid-layout';
        
        // --- Логіка відображення даних ---
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
            
            // Вибір кольору бейджа
            let tagClass = 'tag-success'; 
            
            if (diff > 0) { // Затримка
                if (point.anomalyLevel === 'high') {
                    tagClass = 'tag-danger';
                    anomalyClass = 'row-danger'; // Підсвітка всього рядка
                } else if (point.anomalyLevel === 'medium') {
                    tagClass = 'tag-warning';
                    anomalyClass = 'row-warning';
                } else {
                    tagClass = 'tag-neutral';
                }
            }

            // Формуємо бейдж
            diffHtml = `
                <div class="status-tag ${tagClass}">
                    <span>${sign}${formatDuration(diff)}</span>
                    <small>${absPercent}%</small>
                </div>
            `;
        }

        // Якщо є аномалія, додаємо клас підсвітки рядка
        if (anomalyClass) li.classList.add(anomalyClass);

        const timeStr = new Date(point.timestamp).toLocaleTimeString('uk-UA', {
            hour: '2-digit', 
            minute: '2-digit'
        });

        // HTML структура (Grid Cell -> Content)
        li.innerHTML = `
            <span class="col-idx">${index + 1}</span>
            <span class="col-time">${timeStr}</span>
            <span class="col-val">${planText}</span>
            <span class="col-val" style="font-weight:700; color:#1e293b;">${factText}</span>
            <div class="col-diff-wrapper">${diffHtml}</div>
        `;

        const originalIndex = route.normalizedPoints.indexOf(point);
        li.dataset.originalIndex = originalIndex;
        
        li.addEventListener('click', () => {
            const active = uiRefs.list.querySelector('.active-row');
            if (active) active.classList.remove('active-row');
            li.classList.add('active-row');
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            actions.onPointClick(route.id, originalIndex);
        });

        fragment.appendChild(li);
    });

    uiRefs.list.appendChild(fragment);
}

// renderUniqueDates залишається без змін...
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