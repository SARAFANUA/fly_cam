// js/api/filtersApi.js

function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    usp.set(k, s);
  });
  const q = usp.toString();
  return q ? `?${q}` : '';
}

export async function fetchFilters(params) {
  const res = await fetch(`/api/filters${buildQuery(params)}`);
  if (!res.ok) throw new Error(`filters http ${res.status}`);
  return await res.json();
}

export async function fetchCameraIdSuggest(camera_id_like, limit = 20) {
  const res = await fetch(`/api/filters/suggest${buildQuery({ camera_id_like, limit })}`);
  if (!res.ok) throw new Error(`suggest http ${res.status}`);
  const json = await res.json();
  return json.items || [];
}

// --- НОВЕ ---
export async function searchRegion(type, query) {
    const res = await fetch(`/api/filters/regions/search${buildQuery({ type, query })}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.items || [];
}