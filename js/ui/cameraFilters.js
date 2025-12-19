// js/ui/cameraFilters.js
import { fetchFilters, fetchCameraIdSuggest, searchRegion } from '../api/filtersApi.js';

function $(id) { return document.getElementById(id); }

function fillSelect(selectEl, items, placeholder = '—') {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '';
  
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);
  
  const uniqueItems = [...new Set(items)].filter(Boolean).sort();
  
  for (const v of uniqueItems) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }
  
  if (current && uniqueItems.includes(current)) {
      selectEl.value = current;
  } else {
      selectEl.value = '';
  }
}

function renderDropdown(dropdownEl, items, onSelect) {
    if (!dropdownEl) return;
    dropdownEl.innerHTML = '';

    if (!items || items.length === 0) {
        dropdownEl.style.display = 'none';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        
        let mainText = '';
        let metaText = '';

        if (typeof item === 'object') {
             if (item.hromada) { mainText = item.hromada; metaText = `${item.raion || ''}, ${item.oblast || ''}`; }
             else if (item.raion) { mainText = item.raion; metaText = item.oblast || ''; }
             else if (item.oblast) { mainText = item.oblast; }
             else if (item.camera_id) { mainText = item.camera_id; metaText = item.camera_name || ''; }
        } else {
            mainText = item;
        }

        const spanMain = document.createElement('span');
        spanMain.textContent = mainText;
        div.appendChild(spanMain);

        if (metaText) {
            const spanMeta = document.createElement('span');
            spanMeta.className = 'autocomplete-meta';
            spanMeta.textContent = metaText;
            div.appendChild(spanMeta);
        }

        div.onmousedown = (e) => {
            e.preventDefault(); 
            onSelect(item);
            dropdownEl.style.display = 'none';
        };

        dropdownEl.appendChild(div);
    });

    dropdownEl.style.display = 'block';
}

function debounce(fn, ms = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function initCameraFilters({ onChange } = {}) {
  const els = {
    id: $('filter-camera-id'), ddId: $('dropdown-camera-id'),
    oblast: $('filter-oblast'), ddOblast: $('dropdown-oblast'),
    raion: $('filter-raion'), ddRaion: $('dropdown-raion'),
    hromada: $('filter-hromada'), ddHromada: $('dropdown-hromada'),
    license: $('filter-license-type'),
    analytics: $('filter-analytics-object'),
    status: $('filter-camera-status'),
    system: $('filter-system'),
    ka: $('filter-ka-access'),
    resetBtn: $('filter-reset-btn')
  };

  if (!els.oblast) return;

  function getFilters() {
    return {
      camera_id_like: els.id?.value?.trim() || '',
      oblast: els.oblast?.value?.trim() || '',
      raion: els.raion?.value?.trim() || '',
      hromada: els.hromada?.value?.trim() || '',
      
      // ✅ Передаємо коди для карти
      oblast_code: els.oblast?.dataset?.code || '',
      raion_code: els.raion?.dataset?.code || '',
      hromada_code: els.hromada?.dataset?.code || '',

      license_type: els.license?.value || '',
      analytics_object: els.analytics?.value || '',
      camera_status: els.status?.value || '',
      system: els.system?.value || '',
      ka_access: els.ka?.value || '',
    };
  }

  const triggerChange = debounce(() => {
    onChange?.(getFilters());
  }, 500);

  async function updateSystemFilters() {
      const params = {
          oblast: els.oblast.value.trim(),
          raion: els.raion.value.trim(),
          hromada: els.hromada.value.trim()
      };
      
      try {
          const data = await fetchFilters(params);
          if (data && data.filters) {
              fillSelect(els.system, data.filters.systems || [], 'Будь-яка система');
          }
      } catch (e) { console.error('Error updating system filters:', e); }
  }

  document.addEventListener('mousedown', (e) => {
      [els.ddId, els.ddOblast, els.ddRaion, els.ddHromada].forEach(dd => {
          if (dd && dd.style.display === 'block' && !dd.contains(e.target) && e.target.tagName !== 'INPUT') {
              dd.style.display = 'none';
          }
      });
  });

  // --- ОБРОБНИКИ ДЛЯ РЕГІОНІВ (З КОДАМИ) ---

  // 1. ГРОМАДА
  els.hromada.addEventListener('input', async (e) => {
      const val = e.target.value.trim();
      delete els.hromada.dataset.code; // Скидаємо код при редагуванні
      
      if (val.length < 2) { els.ddHromada.style.display = 'none'; return; }
      
      const items = await searchRegion('hromada', val);
      renderDropdown(els.ddHromada, items, (item) => {
          els.hromada.value = item.hromada;
          els.hromada.dataset.code = item.code || ''; // Зберігаємо код громади

          if (item.raion) {
              els.raion.value = item.raion;
              els.raion.dataset.code = item.code_raion || ''; // Код району
          }
          if (item.oblast) {
              els.oblast.value = item.oblast;
              els.oblast.dataset.code = item.code_oblast || ''; // Код області
          }
          
          updateSystemFilters();
          triggerChange();
      });
  });
  els.hromada.addEventListener('blur', () => setTimeout(updateSystemFilters, 200));

  // 2. РАЙОН
  els.raion.addEventListener('input', async (e) => {
      const val = e.target.value.trim();
      delete els.raion.dataset.code;

      if (val.length < 2) { els.ddRaion.style.display = 'none'; return; }

      const items = await searchRegion('raion', val);
      renderDropdown(els.ddRaion, items, (item) => {
          els.raion.value = item.raion;
          els.raion.dataset.code = item.code || '';

          if (item.oblast) {
              els.oblast.value = item.oblast;
              els.oblast.dataset.code = item.code_oblast || '';
          }
          
          updateSystemFilters();
          triggerChange();
      });
  });
  els.raion.addEventListener('blur', () => setTimeout(updateSystemFilters, 200));

  // 3. ОБЛАСТЬ
  els.oblast.addEventListener('input', async (e) => {
      const val = e.target.value.trim();
      delete els.oblast.dataset.code;

      if (val.length < 2) { els.ddOblast.style.display = 'none'; return; }
      const items = await searchRegion('oblast', val);
      renderDropdown(els.ddOblast, items, (item) => {
          els.oblast.value = item.oblast;
          els.oblast.dataset.code = item.code || '';
          
          updateSystemFilters();
          triggerChange();
      });
  });
  els.oblast.addEventListener('blur', () => setTimeout(updateSystemFilters, 200));

  els.id.addEventListener('input', debounce(async () => {
    const q = els.id.value.trim();
    if (q.length < 2) { els.ddId.style.display = 'none'; return; }
    try {
        const items = await fetchCameraIdSuggest(q, 20);
        renderDropdown(els.ddId, items, (item) => {
            els.id.value = item.camera_id;
            triggerChange();
        });
    } catch(e){}
    triggerChange(); 
  }, 300));

  async function loadInitialFilters() {
    try {
        const data = await fetchFilters({});
        if (!data || !data.filters) return;
        const f = data.filters;
        fillSelect(els.status, f.camera_statuses || [], 'Будь-який стан');
        fillSelect(els.system, f.systems || [], 'Будь-яка система');
        fillSelect(els.ka, f.ka_access_values || [], 'КА: будь-яке');
        fillSelect(els.license, f.license_type || [], 'Будь-який тип');
        fillSelect(els.analytics, f.analytics_object || [], 'Будь-який об\'єкт');
    } catch(e) { console.error(e); }
  }

  [els.license, els.analytics, els.status, els.system, els.ka].forEach(el => {
      if(el) el.onchange = triggerChange;
  });

  els.resetBtn.onclick = () => {
    [els.id, els.oblast, els.raion, els.hromada, els.license, els.analytics, els.status, els.system, els.ka].forEach(el => {
        if(el) {
             el.value = '';
             delete el.dataset.code; // Очищаємо коди
        }
    });
    [els.ddId, els.ddOblast, els.ddRaion, els.ddHromada].forEach(el => el.style.display = 'none');
    
    updateSystemFilters();
    triggerChange();
  };

  loadInitialFilters();
}
