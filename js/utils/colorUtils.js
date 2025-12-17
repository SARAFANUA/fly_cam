// js/utils/colorUtils.js

const colors = [
    '#4682B4', // SteelBlue
    '#3CB371', // MediumSeaGreen
    '#9370DB', // MediumPurple
    '#FF8C00', // DarkOrange
    '#00CED1', // DarkTurquoise
    '#DA70D6', // Orchid
    '#8B0000', // DarkRed
    '#00008B', // DarkBlue
    '#228B22', // ForestGreen
    '#B8860B', // DarkGoldenRod
    '#7B68EE', // MediumSlateBlue
    '#FF4500', // OrangeRed
    '#1E90FF', // DodgerBlue
    '#FF6347', // Tomato
    '#0043faff', // MediumSpringGreen
    '#D2B48C', // Tan
    '#483D8B', // DarkSlateBlue
    '#1a351aff'  // DarkSeaGreen
];

// Мапа для зберігання призначених кольорів маршрутів, щоб забезпечити постійність
const assignedColors = new Map();
let currentColorIndex = 0;

/**
 * Повертає унікальний колір для маршруту.
 * Якщо маршрут вже має призначений колір, він повертається.
 * Якщо ні, призначається наступний доступний колір.
 * @param {string} routeId - Унікальний ідентифікатор маршруту.
 * @returns {string} Колір у форматі HEX.
 */
export function getRouteColor(routeId) {
    if (assignedColors.has(routeId)) {
        return assignedColors.get(routeId);
    }

    const color = colors[currentColorIndex % colors.length];
    assignedColors.set(routeId, color);
    currentColorIndex++;
    return color;
}

/**
 * Очищає всі призначені кольори та скидає індекс кольору.
 * Викликається, наприклад, при скиданні карти або перезавантаженні всіх маршрутів.
 */
export function clearAssignedColors() {
    assignedColors.clear();
    currentColorIndex = 0;
}