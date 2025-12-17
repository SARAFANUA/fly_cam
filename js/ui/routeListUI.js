// js/ui/routeListUI.js

/**
 * Рендерить список маршрутів у сайдбарі
 * @param {HTMLElement} container - елемент ul
 * @param {Object} state - об'єкт appState
 * @param {Object} actions - об'єкт з callback-функціями { onSelect, onLock, onToggle, onRemove }
 */
export function renderRouteList(container, state, actions) {
    container.innerHTML = '';
    
    if (state.routes.size === 0) {
        container.innerHTML = '<li class="empty-list-item">Немає завантажених маршрутів</li>';
        return;
    }

    state.routes.forEach(route => {
        const li = document.createElement('li');
        li.className = 'file-list-item';
        li.dataset.routeId = route.id;
        
        if (!route.isVisible) li.classList.add('route-hidden');
        if (route.id === state.activeRouteId) li.classList.add('active');
        
        li.style.borderLeftColor = state.routeColorMap.get(route.id) || '#ccc';

        // Назва файлу (клікабельна)
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'route-name';
        fileNameSpan.textContent = route.fileName;
        fileNameSpan.addEventListener('click', () => actions.onSelect(route.id));

        // Кнопки управління
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'route-controls';

        const lockBtn = document.createElement('button');
        lockBtn.className = 'lock-filter-btn';
        lockBtn.innerHTML = route.isLocked ? '🔒' : '🔓';
        lockBtn.title = route.isLocked ? 'Розблокувати фільтри' : 'Заблокувати фільтри';
        lockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            actions.onLock(route.id);
        });

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-visibility-btn';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.title = 'Показати/сховати';
        toggleBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            actions.onToggle(route.id); 
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-route-btn';
        removeBtn.textContent = 'x';
        removeBtn.title = 'Видалити';
        removeBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            actions.onRemove(route.id); 
        });

        controlsDiv.appendChild(lockBtn);
        controlsDiv.appendChild(toggleBtn);
        controlsDiv.appendChild(removeBtn);
        li.appendChild(fileNameSpan);
        li.appendChild(controlsDiv);
        container.appendChild(li);
    });
}