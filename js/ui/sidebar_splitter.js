// js/ui/sidebar_splitter.js
// Draggable splitter між панелями сайдбару (маршрути / деталі)
// Працює з HTML-структурою:
//  - #sidebar-panels
//  - #file-list-container
//  - #sidebar-splitter
//  - #points-list-container
// Опційно: кнопки .panel-collapse-btn[data-target]

export function initSidebarSplitter(options = {}) {
  const cfg = {
    storageKey: options.storageKey || "flyka.sidebar.panels.topHeight",
    minTop: Number.isFinite(options.minTop) ? options.minTop : 140,
    minBottom: Number.isFinite(options.minBottom) ? options.minBottom : 170,
    splitterGap: Number.isFinite(options.splitterGap) ? options.splitterGap : 10,
  };

  const panels = document.getElementById("sidebar-panels");
  const topPanel = document.getElementById("file-list-container");
  const bottomPanel = document.getElementById("points-list-container");
  const splitter = document.getElementById("sidebar-splitter");

  // Якщо HTML ще не оновили — просто виходимо без помилки
  if (!panels || !topPanel || !bottomPanel || !splitter) return;

  const isCollapsed = (el) => el.classList.contains("is-collapsed");
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const applyTopHeightPx = (px) => {
    // верх фіксуємо по height, низ — гнучкий
    topPanel.style.flex = "0 0 auto";
    topPanel.style.height = `${px}px`;
    bottomPanel.style.flex = "1 1 auto";
    bottomPanel.style.height = "";
  };

  const resetDefaultSplit = () => {
    // дефолтне співвідношення
    topPanel.style.height = "";
    topPanel.style.flex = "0 0 40%";
    bottomPanel.style.height = "";
    bottomPanel.style.flex = "1 1 60%";
    localStorage.removeItem(cfg.storageKey);
  };

  // Відновлення з localStorage (якщо є)
  const saved = Number(localStorage.getItem(cfg.storageKey));
  if (!Number.isNaN(saved) && saved > cfg.minTop) {
    applyTopHeightPx(saved);
  } else {
    resetDefaultSplit();
  }

  // Drag
  let dragging = false;
  let startY = 0;
  let startTop = 0;

  const onMove = (e) => {
    if (!dragging) return;

    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = clientY - startY;

    const panelsRect = panels.getBoundingClientRect();
    const splitterH = splitter.getBoundingClientRect().height || splitter.offsetHeight || 10;

    const maxTop =
      panelsRect.height - cfg.minBottom - splitterH - cfg.splitterGap;

    const nextTop = clamp(startTop + delta, cfg.minTop, maxTop);
    applyTopHeightPx(nextTop);
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;

    const h = Math.round(topPanel.getBoundingClientRect().height);
    if (h > cfg.minTop) localStorage.setItem(cfg.storageKey, String(h));

    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", stop);

    document.removeEventListener("touchmove", touchMove, { passive: false });
    document.removeEventListener("touchend", stop);
  };

  const touchMove = (ev) => {
    // важливо: щоб не “скролило сторінку” під час перетягування
    ev.preventDefault();
    onMove(ev);
  };

  const start = (e) => {
    // якщо одна панель згорнута — drag вимикаємо
    if (isCollapsed(topPanel) || isCollapsed(bottomPanel)) return;

    dragging = true;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startY = clientY;
    startTop = topPanel.getBoundingClientRect().height;

    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);

    document.addEventListener("touchmove", touchMove, { passive: false });
    document.addEventListener("touchend", stop);
  };

  splitter.addEventListener("mousedown", start);
  splitter.addEventListener("touchstart", start, { passive: true });

  // Double click: reset
  splitter.addEventListener("dblclick", resetDefaultSplit);

  // Collapse buttons (optional)
  document.querySelectorAll(".panel-collapse-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const panel = document.getElementById(targetId);
      if (!panel) return;

      const other = panel === topPanel ? bottomPanel : topPanel;

      panel.classList.toggle("is-collapsed");

      if (panel.classList.contains("is-collapsed")) {
        splitter.style.display = "none";

        // інша панель займає весь простір
        other.style.flex = "1 1 auto";
        other.style.height = "";
      } else {
        splitter.style.display = "";

        // відновлюємо попереднє (якщо було збережено) або дефолт
        const s = Number(localStorage.getItem(cfg.storageKey));
        if (!Number.isNaN(s) && s > cfg.minTop) applyTopHeightPx(s);
        else resetDefaultSplit();
      }
    });
  });
}
