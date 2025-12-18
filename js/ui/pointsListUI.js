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
    
    // Фільтрація точок (якщо є глобальний фільтр)
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
    // Вирівнювання match'иться з CSS Grid в .points-grid-layout
    uiRefs.summary.innerHTML = `
        <div class="points-table-header points-grid-layout">
            <span style="text-align: center">#</span>
            <span>Час</span>
            <span style="text-align: right">План</span>
            <span style="text-align: right">Факт</span>
            <span style="text-align: right; padding-right: 5px;">Відхилення</span>
        </div>
    `;
    
    uiRefs.list.innerHTML = '';
    const fragment = document.createDocumentFragment();

    pointsToDisplay.forEach((point, index) => {
        const li = document.createElement('li');
        li.className = 'point-list-row points-grid-layout';
        
        // Дефолтні значення (пустишки)
        let diffHtml = '<span class="status-tag tag-neutral" style="opacity:0.5; min-width:30px; justify-content:center;">—</span>';
        let planText = '<span class="col-val faded">—</span>';
        let factText = '<span class="col-val faded">—</span>';

        // Якщо є розраховані дані таймінгу
        if (point.timingInfo) {
            const { expected, actual, diff, percent } = point.timingInfo;
            
            // Чистий текст для колонок План/Факт
            planText = formatDuration(expected);
            factText = formatDuration(actual);
            
            const sign = diff > 0 ? '+' : '';
            const absPercent = Math.abs(Math.round(percent));
            
            // Логіка вибору стилю бейджа (Tag)
            let tagClass = 'tag-success'; // Зелений за замовчуванням (швидше або вчасно)
            
            if (diff > 0) {
                // Затримка
                if (point.anomalyLevel === 'high') tagClass = 'tag-danger';      // Червоний
                else if (point.anomalyLevel === 'medium') tagClass = 'tag-warning'; // Жовтий
                else tagClass = 'tag-neutral'; // Незначне відхилення
            }

            // Формуємо бейдж
            // Використовуємо &nbsp; для фіксованого відступу цифр
            diffHtml = `
                <div class="status-tag ${tagClass}">
                    <span>${sign}${formatDuration(diff)}</span>
                    <small>${sign}${absPercent}%</small>
                </div>
            `;
        }

        const timeStr = new Date(point.timestamp).toLocaleTimeString('uk-UA', {
            hour: '2-digit', 
            minute: '2-digit'
        });

        // HTML структура рядка
        li.innerHTML = `
            <span class="col-idx">${index + 1}</span>
            <span class="col-time">${timeStr}</span>
            <span class="col-val">${planText}</span>
            <span class="col-val" style="font-weight:600; color:#1e293b;">${factText}</span>
            <div class="col-diff-wrapper">${diffHtml}</div>
        `;

        const originalIndex = route.normalizedPoints.indexOf(point);
        li.dataset.originalIndex = originalIndex;
        
        li.addEventListener('click', () => {
            const active = uiRefs.list.querySelector('.active-row');
            if (active) active.classList.remove('active-row');
            li.classList.add('active-row');
            
            // Плавний скрол до елемента, якщо він частково схований
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            actions.onPointClick(route.id, originalIndex);
        });

        fragment.appendChild(li);
    });

    uiRefs.list.appendChild(fragment);
}

// Функція для дат (renderUniqueDates) залишається без змін...
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