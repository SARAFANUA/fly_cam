// js/ui/cameraFilters.js
import { fetchFilters, fetchCameraIdSuggest } from '../api/filtersApi.js';

function $(id) { return document.getElementById(id); }

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

  // спроба зберегти вибір
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

    const data = await fetchFilters({ oblast, raion });

    fillSelect(selOblast, data.oblasts || [], 'Усі області');
    fillSelect(selRaion, data.raions || [], oblast ? 'Усі райони' : 'Спочатку обери область');
    fillSelect(selHromada, data.hromadas || [], (oblast && raion) ? 'Усі громади' : 'Спочатку обери район');

    fillSelect(selStatus, data.camera_statuses || [], 'Будь-який стан');
    fillSelect(selSystem, data.systems || [], 'Будь-яка система');
    fillSelect(selKa, data.ka_access_values || [], 'КА: будь-яке');

    // license_type і analytics_object — сталі списки (заповнюємо один раз, якщо ще порожні)
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

  // ---- camera_id suggest ----
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

  // ---- listeners ----
  inputCameraId?.addEventListener('input', () => { suggest(); triggerChange(); });

  selOblast?.addEventListener('change', async () => {
    // скидаємо залежні
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

  selHromada?.addEventListener('change', triggerChange);
  selLicense?.addEventListener('change', triggerChange);
  selAnalyticsObj?.addEventListener('change', triggerChange);
  selStatus?.addEventListener('change', triggerChange);
  selSystem?.addEventListener('change', triggerChange);
  selKa?.addEventListener('change', triggerChange);

  btnReset?.addEventListener('click', async () => {
    if (inputCameraId) inputCameraId.value = '';
    if (selOblast) selOblast.value = '';
    if (selRaion) selRaion.value = '';
    if (selHromada) selHromada.value = '';
    if (selLicense) selLicense.value = '';
    if (selAnalyticsObj) selAnalyticsObj.value = '';
    if (selStatus) selStatus.value = '';
    if (selSystem) selSystem.value = '';
    if (selKa) selKa.value = '';

    if (datalist) datalist.innerHTML = '';
    await loadFiltersLists();
    triggerChange();
  });

  // init
  loadFiltersLists().then(triggerChange).catch(console.error);
}
