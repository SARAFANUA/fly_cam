// js/map/mapLayers.js

/**
 * Ініціалізує контроль базових шарів.
 * Весь код, пов'язаний із шаром залізниці та його завантаженням, видалено.
 * * @param {L.Map} map - Екземпляр карти Leaflet.
 * @param {Object} baseMaps - Об'єкт з базовими шарами.
 */
export function setupLayerControls(map, baseMaps) {

    // Створюємо контроль шарів лише з базовими шарами
    // Змінено: { collapsed: false } на { collapsed: true } (за замовчуванням)
    L.control.layers(baseMaps, null, { collapsed: true }).addTo(map);

    // Примітка: Також можна просто написати: L.control.layers(baseMaps, null).addTo(map);
    // оскільки "collapsed: true" є значенням за замовчуванням у Leaflet.
}