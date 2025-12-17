import { handleFileLoad } from '../parser/fileHandler.js';
import { showMessage } from '../ui/dom.js';

export const fileService = {
    async processFile(file, store, callbacks) {
        showMessage(`Обробка: ${file.name}...`, 'info');
        const routeId = `route_${Date.now()}`;
        
        try {
            const { normalizedPoints } = await handleFileLoad(file);
            if (!normalizedPoints || normalizedPoints.length < 2) throw new Error('Замало точок');

            store.routes.set(routeId, {
                id: routeId,
                fileName: file.name,
                normalizedPoints,
                isVisible: true,
                isLocked: false
            });

            if (store.globalDateFilter.size > 0) callbacks.onResetFilter();
            
            await callbacks.renderAll();
            callbacks.onSelect(routeId);

            showMessage(`Файл "${file.name}" готово.`, 'success');
        } catch (error) {
            console.error(error);
            showMessage(`Помилка: ${error.message}`, 'error');
        }
    }
};