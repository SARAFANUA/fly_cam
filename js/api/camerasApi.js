// js/api/camerasApi.js

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
 *
 * Підтримані params (бекенд може приймати підмножину — зайве ігнорується):
 * - limit, offset
 * - q (якщо у тебе є загальний пошук)
 * - camera_id_like
 * - oblast, raion, hromada
 * - license_type
 * - analytics_object
 * - camera_status
 * - integration_status
 * - system   (1 вибрана система з інтегрованих, перевірка через LIKE на бекенді або через split)
 * - ka_access
 * - bbox format: "south,west,north,east"
 */
export async function fetchCameras(params = {}) {
  const url = `/api/cameras${buildQuery(params)}`;
  return withTimeout((signal) => fetchJson(url, signal, 'fetchCameras failed'));
}

/**
 * Завантажити довідники фільтрів:
 * GET /api/filters?oblast=...&raion=...
 * Повертає: oblasts, raions, hromadas, systems, camera_statuses, ka_access_values
 */
export async function fetchFilters(params = {}) {
  const url = `/api/filters${buildQuery(params)}`;
  return withTimeout((signal) => fetchJson(url, signal, 'fetchFilters failed'));
}

/**
 * Підказки для camera_id:
 * GET /api/filters/suggest?camera_id_like=...&limit=20
 * Повертає: { ok, items: [{camera_id, camera_name}] }
 */
export async function fetchCameraIdSuggest(camera_id_like, limit = 20) {
  const url = `/api/filters/suggest${buildQuery({ camera_id_like, limit })}`;
  return withTimeout((signal) => fetchJson(url, signal, 'fetchCameraIdSuggest failed'));
}

/**
 * META (залишаємо як було)
 */
export async function fetchMeta() {
  const url = `/api/meta`;
  return withTimeout((signal) => fetchJson(url, signal, 'fetchMeta failed'));
}

/**
 * Backward compatibility:
 * Раніше у тебе був /api/cameras/filters — тепер у нас /api/filters
 * Залишаю функцію-аліас, щоб не ламати існуючий фронт.
 */
export async function fetchCameraFilters(params = {}) {
  return fetchFilters(params);
}
