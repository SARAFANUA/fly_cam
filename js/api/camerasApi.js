// js/api/camerasApi.js

// Ключ шифрування (має співпадати з сервером)
const SECRET_KEY = 'FlyKA_Secure_Key_2024_SOVA';

const DEFAULT_TIMEOUT_MS = 30000;

function withTimeout(makePromise, ms = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return Promise.race([
    Promise.resolve(makePromise(ctrl.signal)).finally(() => clearTimeout(id)),
  ]);
}

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;

    // дозволяємо масиви (наприклад systems[] у майбутньому)
    if (Array.isArray(v)) {
      v.forEach((item) => {
        const s = String(item ?? '').trim();
        if (!s) return;
        q.append(k, s);
      });
      return;
    }

    const s = String(v).trim();
    if (!s) return;
    q.set(k, s);
  });

  const s = q.toString();
  return s ? `?${s}` : '';
}

async function fetchJson(url, signal, errPrefix) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${errPrefix}: ${res.status} ${text}`.trim());
  }
  return res.json();
}

/**
 * Отримати камери.
 * * Включає логіку ДЕШИФРУВАННЯ (AES), якщо сервер повертає payload.
 */
export async function fetchCameras(params = {}) {
  const url = `/api/cameras${buildQuery(params)}`;
  
  // Отримуємо відповідь сервера
  const json = await withTimeout((signal) => fetchJson(url, signal, 'fetchCameras failed'));

  // --- ЛОГІКА ДЕШИФРУВАННЯ ---
  if (json.payload) {
      try {
          // Перевіряємо, чи підключена бібліотека CryptoJS
          if (typeof CryptoJS === 'undefined') {
              console.error('CRITICAL: CryptoJS library not found. Decryption impossible.');
              return { items: [] };
          }

          // 1. Дешифруємо байти
          const bytes = CryptoJS.AES.decrypt(json.payload, SECRET_KEY);
          // 2. Перетворюємо в рядок
          const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
          
          if (!decryptedString) {
              throw new Error('Decryption resulted in empty string (wrong key?)');
          }

          // 3. Парсимо JSON
          const data = JSON.parse(decryptedString);
          return data; // Повертаємо розшифрований об'єкт { items: [...], limit, offset }

      } catch (e) {
          console.error("Помилка дешифрування даних:", e);
          return { items: [] };
      }
  }

  // Фолбек: якщо дані прийшли не зашифровані (для сумісності)
  return json;
}

/**
 * Завантажити довідники фільтрів:
 * GET /api/filters?oblast=...&raion=...
 */
export async function fetchFilters(params = {}) {
  const url = `/api/filters${buildQuery(params)}`;
  return withTimeout((signal) => fetchJson(url, signal, 'fetchFilters failed'));
}

/**
 * Підказки для camera_id:
 * GET /api/filters/suggest?camera_id_like=...&limit=20
 */
export async function fetchCameraIdSuggest(camera_id_like, limit = 20) {
  const url = `/api/filters/suggest${buildQuery({ camera_id_like, limit })}`;
  return withTimeout((signal) => fetchJson(url, signal, 'fetchCameraIdSuggest failed'));
}

// --- НОВЕ: Пошук регіонів (для автокомпліту) ---
export async function searchRegion(type, query) {
    const url = `/api/filters/regions/search${buildQuery({ type, query })}`;
    try {
        const json = await withTimeout((signal) => fetchJson(url, signal, 'searchRegion failed'));
        return json.items || [];
    } catch (e) {
        console.warn('Region search error:', e);
        return [];
    }
}

/**
 * META (залишаємо як було)
 */
export async function fetchMeta() {
  const url = `/api/meta`;
  return withTimeout((signal) => fetchJson(url, signal, 'fetchMeta failed'));
}

/**
 * Backward compatibility
 */
export async function fetchCameraFilters(params = {}) {
  return fetchFilters(params);
}