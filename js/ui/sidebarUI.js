function formatDuration(ms) {
    if (ms < 1000) return "0 сек";
    const sec = Math.round(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return (h > 0 ? h + ' год ' : '') + (m > 0 ? m + ' хв ' : '') + (sec % 60 + ' сек');
}

export const sidebarUI = {
    renderRoutes(container, store, actions) {
        container.innerHTML = '';
        if (store.routes.size === 0) {
            container.innerHTML = '<li class="empty-list-item">Маршрутів немає</li>';
            return;
        }

        store.routes.forEach(route => {
            const li = document.createElement('li');
            li.className = 'file-list-item' + (route.id === store.activeRouteId ? ' active' : '') + (!route.isVisible ? ' route-hidden' : '');
            li.style.borderLeftColor = store.routeColorMap.get(route.id) || '#ccc';

            li.innerHTML = `
                <span class="route-name">${route.fileName}</span>
                <div class="route-controls">
                    <button class="lock-btn">${route.isLocked ? '🔒' : '🔓'}</button>
                    <button class="vis-btn">👁️</button>
                    <button class="del-btn">x</button>
                </div>
            `;

            // Події
            li.querySelector('.route-name').onclick = () => actions.onSelect(route.id);
            li.querySelector('.lock-btn').onclick = (e) => { e.stopPropagation(); actions.onLock(route.id); };
            li.querySelector('.vis-btn').onclick = (e) => { e.stopPropagation(); actions.onToggle(route.id); };
            li.querySelector('.del-btn').onclick = (e) => { e.stopPropagation(); actions.onRemove(route.id); };

            container.appendChild(li);
        });
    },

    renderPoints(elements, store, actions) {
        const { pointsRouteName, pointsSummary, pointsList } = elements;
        const route = store.routes.get(store.activeRouteId);
        
        if (!route) {
            pointsRouteName.textContent = '';
            pointsSummary.innerHTML = '';
            pointsList.innerHTML = '<li class="empty-list-item">Оберіть маршрут</li>';
            return;
        }

        pointsRouteName.textContent = route.fileName;
        
        let points = route.normalizedPoints;
        if (store.globalDateFilter.size > 0 && !route.isLocked) {
            points = points.filter(p => store.globalDateFilter.has(new Date(p.timestamp).toLocaleDateString('uk-UA')));
        }

        if (points.length === 0) {
            pointsList.innerHTML = '<li class="empty-list-item">Немає точок</li>';
            return;
        }

        const timeSpan = new Date(points[points.length-1].timestamp) - new Date(points[0].timestamp);
        pointsSummary.innerHTML = `<strong>Час:</strong> ${formatDuration(timeSpan)}`;
        pointsList.innerHTML = '';

        const frag = document.createDocumentFragment();
        points.forEach((p, i) => {
            const li = document.createElement('li');
            const nextTime = points[i+1] ? new Date(points[i+1].timestamp) : new Date(p.timestamp);
            const duration = nextTime - new Date(p.timestamp);
            const isLong = duration > 300000;

            li.innerHTML = `
                <span class="point-index">${i+1}</span>
                <span>${new Date(p.timestamp).toLocaleString('uk-UA')}</span>
                <span class="${isLong ? 'long-stop' : ''}">${i < points.length-1 ? formatDuration(duration) : '-'}</span>
            `;
            const origIdx = route.normalizedPoints.indexOf(p);
            li.onclick = () => actions.onPointClick(route.id, origIdx);
            frag.appendChild(li);
        });
        pointsList.appendChild(frag);
    },

    renderDates(container, store, actions) {
        const counts = new Map();
        store.routes.forEach(r => r.normalizedPoints.forEach(p => {
            const d = new Date(p.timestamp).toLocaleDateString('uk-UA');
            counts.set(d, (counts.get(d) || 0) + 1);
        }));

        container.innerHTML = '';
        if (counts.size === 0) {
            container.innerHTML = '<li class="empty-list-item">Немає дат</li>';
            return;
        }

        // Сортування дат
        const sorted = [...counts.entries()].sort((a,b) => 
            new Date(a[0].split('.').reverse().join('-')) - new Date(b[0].split('.').reverse().join('-'))
        );

        sorted.forEach(([date, count]) => {
            const li = document.createElement('li');
            if (store.globalDateFilter.has(date)) li.classList.add('active');
            li.innerHTML = `<span>${date}</span><span class="unique-date-count">${count}</span>`;
            li.onclick = (e) => actions.onDateClick(date, e);
            container.appendChild(li);
        });
    }
};