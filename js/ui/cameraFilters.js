// js/ui/cameraFilters.js
import { fetchFilters, fetchCameraIdSuggest } from '../api/filtersApi.js';

function $(id) { return document.getElementById(id); }

// HTML-шаблон фільтрів
const FILTERS_TEMPLATE = `
<div class="filters-container">
    <div class="panel">
        <h3>Пошук</h3>
        <div class="field">
            <span>ID камери</span>
            <input type="text" id="filter-camera-id" list="filter-camera-id-datalist" placeholder="Введіть ID..." autocomplete="off">
            <datalist id="filter-camera-id-datalist"></datalist>
        </div>
    </div>

    <div class="panel">
        <h3>Локація</h3>
        <div class="grid-2">
            <div class="field grid-span-2">
                <span>Область</span>
                <select id="filter-oblast"><option value="">Усі області</option></select>
            </div>
            <div class="field">
                <span>Район</span>
                <select id="filter-raion"><option value="">Усі райони</option></select>
            </div>
            <div class="field">
                <span>Громада</span>
                <select id="filter-hromada"><option value="">Усі громади</option></select>
            </div>
        </div>
    </div>

    <div class="panel">
        <h3>Технічні параметри</h3>
        <div class="grid-2">
            <div class="field">
                <span>Стан</span>
                <select id="filter-camera-status"><option value="">Будь-який</option></select>
            </div>
            <div class="field">
                <span>Система</span>
                <select id="filter-system"><option value="">Будь-яка</option></select>
            </div>
            <div class="field grid-span-2">
                <span>Доступ КА</span>
                <select id="filter-ka-access"><option value="">Будь-яке</option></select>
            </div>
        </div>
    </div>

    <div class="panel">
        <h3>Аналітика</h3>
        <div class="field">
            <span>Функціонал</span>
            <select id="filter-license-type"><option value="">Будь-який</option></select>
        </div>
        <div class="field">
            <span>Об'єкт аналітики</span>
            <select id="filter-analytics-object"><option value="">Будь-який</option></select>
        </div>
    </div>

    <div class="filter-actions">
        <button id="filter-reset-btn" class="btn-secondary" style="background: var(--danger-color); color: white;">
            <i class="fa-solid fa-rotate-left"></i> Скинути фільтри
        </button>
    </div>
</div>
`;

function fillSelect(selectEl, items, placeholder = '—') {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = '';
  
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  for (const v of items) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }

  if (items.includes(current)) selectEl.value = current;
}

function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function initCameraFilters({ onChange } = {}) {
  // 1. Спочатку рендеримо HTML у контейнер
  const container = $('camera-modal-body');
  if (!container) {
      console.error('Container #camera-modal-body not found!');
      return;
  }
  container.innerHTML = FILTERS_TEMPLATE;

  // 2. Тепер вибираємо елементи (вони вже існують в DOM)
  const inputCameraId = $('filter-camera-id');
  const datalist = $('filter-camera-id-datalist');

  const selOblast = $('filter-oblast');
  const selRaion = $('filter-raion');
  const selHromada = $('filter-hromada');

  const selLicense = $('filter-license-type');
  const selAnalyticsObj = $('filter-analytics-object');

  const selStatus = $('filter-camera-status');
  const selSystem = $('filter-system');
  const selKa = $('filter-ka-access');

  const btnReset = $('filter-reset-btn');

  function getFilters() {
    return {
      camera_id_like: inputCameraId?.value?.trim() || '',
      oblast: selOblast?.value || '',
      raion: selRaion?.value || '',
      hromada: selHromada?.value || '',
      license_type: selLicense?.value || '',
      analytics_object: selAnalyticsObj?.value || '',
      camera_status: selStatus?.value || '',
      system: selSystem?.value || '',
      ka_access: selKa?.value || '',
    };
  }

  async function loadFiltersLists() {
    const oblast = selOblast?.value || '';
    const raion = selRaion?.value || '';

    // Припускаємо, що fetchFilters працює коректно і повертає об'єкт
    const data = await fetchFilters({ oblast, raion }); 
    if (!data) return;

    fillSelect(selOblast, data.oblasts || [], 'Усі області');
    fillSelect(selRaion, data.raions || [], oblast ? 'Усі райони' : 'Спочатку обери область');
    fillSelect(selHromada, data.hromadas || [], (oblast && raion) ? 'Усі громади' : 'Спочатку обери район');

    fillSelect(selStatus, data.camera_statuses || [], 'Будь-який стан');
    fillSelect(selSystem, data.systems || [], 'Будь-яка система');
    fillSelect(selKa, data.ka_access_values || [], 'КА: будь-яке');

    // Сталі списки
    if (selLicense && selLicense.options.length <= 1) {
      fillSelect(selLicense, [
        'Оглядові',
        'З функ. розпіз. номерних знаків ТЗ',
        'З функ. розпіз. кол./ типу/ марки ТЗ',
        'З наявністю стробоскопу',
        'З функ. розпіз. обличь водія',
        'З функ. фіксації ваги транспортного засобу',
        'З функ. фіксації перевищення швидкості руху',
        'З функ. фіксації інших адміністративних правопорушень ТЗ',
        'З функ. розпіз. обличь (не водія)',
        'З функ. розпіз. атрибутів одягу особи',
        'З функ. детектора залишених предметів',
        'З функ. виявлення скупчення людей',
        'З функ. фіксації інцидентів',
        'З функ. аналіз. навк. середовища',
        'З функ. фіксації інфрачер. випром. (тепловізійні)',
        'З іншим аналітичним функціоналом',
      ], 'Будь-який функціонал');
    }

    if (selAnalyticsObj && selAnalyticsObj.options.length <= 1) {
      fillSelect(selAnalyticsObj, [
        'Без аналітичних функцій',
        'Відносно ТЗ',
        'Відносно особи',
        'Інші аналітичні',
      ], 'Будь-який обʼєкт аналітики');
    }
  }

  const triggerChange = () => {
    const f = getFilters();
    onChange?.(f);
  };

  // ---- Listener Logic ----
  const suggest = debounce(async () => {
    if (!inputCameraId || !datalist) return;
    const q = inputCameraId.value.trim();
    if (q.length < 2) {
      datalist.innerHTML = '';
      return;
    }
    const items = await fetchCameraIdSuggest(q, 20);
    datalist.innerHTML = '';
    for (const it of items) {
      const opt = document.createElement('option');
      opt.value = it.camera_id;
      opt.label = it.camera_name || '';
      datalist.appendChild(opt);
    }
  }, 250);

  inputCameraId?.addEventListener('input', () => { suggest(); triggerChange(); });

  selOblast?.addEventListener('change', async () => {
    if (selRaion) selRaion.value = '';
    if (selHromada) selHromada.value = '';
    await loadFiltersLists();
    triggerChange();
  });

  selRaion?.addEventListener('change', async () => {
    if (selHromada) selHromada.value = '';
    await loadFiltersLists();
    triggerChange();
  });

  [selHromada, selLicense, selAnalyticsObj, selStatus, selSystem, selKa].forEach(el => {
      el?.addEventListener('change', triggerChange);
  });

  btnReset?.addEventListener('click', async () => {
    // Очищення полів
    const inputs = [inputCameraId, selOblast, selRaion, selHromada, selLicense, selAnalyticsObj, selStatus, selSystem, selKa];
    inputs.forEach(el => { if(el) el.value = ''; });
    if (datalist) datalist.innerHTML = '';
    
    await loadFiltersLists();
    triggerChange();
  });

  // Запуск при старті
  loadFiltersLists().then(triggerChange).catch(console.error);
}