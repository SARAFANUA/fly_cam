// js/ui/pointsListUI.js

function formatDuration(ms) {
    if (ms < 1000) return "0 сек";
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let result = '';
    if (hours > 0) result += `${hours} год `;
    if (minutes > 0) result += `${minutes} хв `;
    if (seconds > 0 || result === '') result += `${seconds} сек`;
    return result.trim();
}

export function clearPointsList(uiRefs) {
    uiRefs.routeTitle.textContent = '';
    uiRefs.summary.innerHTML = '';
    uiRefs.list.innerHTML = '<li class="empty-list-item">Оберіть маршрут для перегляду</li>';
}

export function renderPointsList(route, state, uiRefs, actions) {
    if (!route) return;

    uiRefs.routeTitle.textContent = route.fileName;
    
    // Фільтрація точок (аналогічно як в map renderer)
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

    // Підрахунок часу
    const totalTime = pointsToDisplay.length > 1
        ? (new Date(pointsToDisplay[pointsToDisplay.length - 1].timestamp).getTime() - new Date(pointsToDisplay[0].timestamp).getTime())
        : 0;

    uiRefs.summary.innerHTML = `<strong>Загальний час у вибірці:</strong> ${formatDuration(totalTime)}`;
    uiRefs.list.innerHTML = '';

    // Рендерінг точок
    pointsToDisplay.forEach((point, index) => {
        const li = document.createElement('li');
        let durationMs = 0;
        if (index < pointsToDisplay.length - 1) {
            const nextPointTime = new Date(pointsToDisplay[index + 1].timestamp).getTime();
            durationMs = nextPointTime - new Date(point.timestamp).getTime();
        }

        const isLongStop = durationMs > (5 * 60 * 1000); // 5 хв

        // Використовуємо індекс 1..N для відображених точок
        li.innerHTML = `
            <span class="point-col point-index">${index + 1}</span>
            <span class="point-col point-time">${new Date(point.timestamp).toLocaleString('uk-UA')}</span>
            <span class="point-col point-duration ${isLongStop ? 'long-stop' : ''}" title="${isLongStop ? 'Довга зупинка' : ''}">
                ${index < pointsToDisplay.length - 1 ? formatDuration(durationMs) : '---'}
            </span>
        `;

        // Оригінальний індекс потрібен для зв'язку з картою
        const originalIndex = route.normalizedPoints.indexOf(point);
        li.dataset.originalIndex = originalIndex;
        li.addEventListener('click', () => actions.onPointClick(route.id, originalIndex));

        uiRefs.list.appendChild(li);
    });
}

// renderUniqueDates залишається без змін...
export function renderUniqueDates(container, state, actions) {
    // ...
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