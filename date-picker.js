/* ==============================================================
   MONEYFLOW — SHARED DATE PICKER (AMOLED / EMERALD)
   Replaces visible Android date controls throughout MoneyFlow.
   Keeps the original input[type=date], its ID, value, min/max,
   required state, and input/change events for existing app logic.
   No financial records are read, written, or migrated here.
   ============================================================== */
(() => {
  "use strict";
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const registry = new Map();
  const $ = id => document.getElementById(id);
  let overlay = null;
  let entry = null;
  let year = 0;
  let month = 0;
  let showingMonths = false;
  let oldOverflow = "";
  let focusBefore = null;
  let historyAdded = false;
  let awaitingHistoryBack = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
  function parseDate(value) {
    if (typeof value !== "string") return null;
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!parts) return null;
    const y = +parts[1], m = +parts[2] - 1, d = +parts[3];
    const date = new Date(y, m, d);
    return date.getFullYear() === y && date.getMonth() === m &&
      date.getDate() === d ? { y, m, d } : null;
  }
  function labelDate(value) {
    const d = parseDate(value);
    return d ? `${d.d} ${months[d.m].slice(0, 3)} ${d.y}` : "Select date";
  }
  function allowed(input, date) {
    const min = parseDate(input.min);
    const max = parseDate(input.max);
    const test = iso(date.y, date.m, date.d);
    return (!min || test >= input.min) && (!max || test <= input.max);
  }
  function button(className, content, ariaLabel) {
    const b = element("button", className, content);
    b.type = "button";
    if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
    return b;
  }
  function calendarIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/></svg>';
  }
  function close(fromHistory = false) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.style.overflow = oldOverflow;
    const shouldPop = historyAdded && !fromHistory;
    historyAdded = false;
    entry = null;
    if (focusBefore && focusBefore.isConnected) focusBefore.focus({ preventScroll: true });
    focusBefore = null;
    if (shouldPop) {
      awaitingHistoryBack = true;
      history.back();
      // Avoid a permanently armed flag in unusual browser histories.
      setTimeout(() => { awaitingHistoryBack = false; }, 1200);
    }
  }
  function drawHeader() {
    $("mfDateCurrentMonth").textContent = `${months[month]} ${year}`;
    $("mfDateCurrentMonth").setAttribute("aria-label", `Choose month and year; showing ${months[month]} ${year}`);
    $("mfDatePrev").disabled = year <= 1900 && month === 0;
    $("mfDateNext").disabled = year >= 2100 && month === 11;
  }
  function drawDays() {
    drawHeader();
    const grid = $("mfDateDays");
    grid.replaceChildren();
    const firstWeekday = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((firstWeekday + count) / 7) * 7;
    const selected = parseDate(entry.input.value);
    const now = new Date();
    const currentIso = iso(now.getFullYear(), now.getMonth(), now.getDate());
    for (let n = 0; n < total; n++) {
      const dayDate = new Date(year, month, n - firstWeekday + 1);
      const date = {
        y: dayDate.getFullYear(), m: dayDate.getMonth(), d: dayDate.getDate()
      };
      const key = iso(date.y, date.m, date.d);
      const isOther = date.m !== month;
      const cell = button("mf-date-day" + (isOther ? " is-outside" : ""), String(date.d),
        `Select ${date.d} ${months[date.m]} ${date.y}`);
      cell.disabled = !allowed(entry.input, date);
      if (key === currentIso) cell.classList.add("is-today");
      if (selected && key === iso(selected.y, selected.m, selected.d)) {
        cell.classList.add("is-selected");
        cell.setAttribute("aria-pressed", "true");
      }
      cell.addEventListener("click", () => choose(key));
      grid.append(cell);
    }
  }
  function drawMonths() {
    drawHeader();
    const target = $("mfDateMonthGrid");
    target.replaceChildren();
    const selected = parseDate(entry.input.value);
    months.forEach((value, m) => {
      const b = button("mf-date-month-option", value.slice(0, 3), `${value} ${year}`);
      if (selected && selected.y === year && selected.m === m) b.classList.add("is-selected");
      b.addEventListener("click", () => {
        month = m;
        showingMonths = false;
        draw();
      });
      target.append(b);
    });
  }
  function draw() {
    $("mfDateCalendar").hidden = showingMonths;
    $("mfDateMonths").hidden = !showingMonths;
    $("mfDateCurrentMonth").setAttribute("aria-expanded", String(showingMonths));
    if (showingMonths) drawMonths(); else drawDays();
  }
  function moveMonth(direction) {
    if (showingMonths) {
      year = Math.max(1900, Math.min(2100, year + direction));
    } else {
      const n = new Date(year, month + direction, 1);
      if (n.getFullYear() < 1900 || n.getFullYear() > 2100) return;
      year = n.getFullYear();
      month = n.getMonth();
    }
    draw();
  }
  function choose(value) {
    if (!entry) return;
    const parts = parseDate(value);
    if (!parts || !allowed(entry.input, parts)) return;
    entry.input.value = value;
    entry.input.dispatchEvent(new Event("input", { bubbles: true }));
    entry.input.dispatchEvent(new Event("change", { bubbles: true }));
    entry.refresh();
    close();
  }
  function createOverlay() {
    if (overlay) return;
    overlay = element("div", "mf-date-backdrop");
    overlay.id = "mfDateBackdrop";
    overlay.hidden = true;
    const dialog = element("section", "mf-date-sheet");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "mfDateDialogTitle");

    const handle = element("span", "mf-date-handle");
    handle.setAttribute("aria-hidden", "true");
    const top = element("header", "mf-date-top");
    const title = element("h2", "mf-date-title", "Select Date");
    title.id = "mfDateDialogTitle";
    const closeBtn = button("mf-date-close", "×", "Close date picker");
    closeBtn.addEventListener("click", () => close());
    top.append(title, closeBtn);

    const navigation = element("div", "mf-date-nav");
    const prev = button("mf-date-nav-arrow", "‹", "Previous month");
    prev.id = "mfDatePrev";
    const current = button("mf-date-nav-title", "", "Choose month and year");
    current.id = "mfDateCurrentMonth";
    current.setAttribute("aria-expanded", "false");
    const next = button("mf-date-nav-arrow", "›", "Next month");
    next.id = "mfDateNext";
    prev.addEventListener("click", () => moveMonth(-1));
    next.addEventListener("click", () => moveMonth(1));
    current.addEventListener("click", () => { showingMonths = !showingMonths; draw(); });
    navigation.append(prev, current, next);

    const calendar = element("div", "mf-date-calendar");
    calendar.id = "mfDateCalendar";
    const week = element("div", "mf-date-week");
    weekdays.forEach(value => week.append(element("span", "", value)));
    const days = element("div", "mf-date-days");
    days.id = "mfDateDays";
    calendar.append(week, days);
    const monthsView = element("div", "mf-date-month-grid");
    monthsView.id = "mfDateMonths";
    monthsView.hidden = true;
    const monthGrid = element("div", "mf-date-months");
    monthGrid.id = "mfDateMonthGrid";
    monthsView.append(monthGrid);

    const footer = element("footer", "mf-date-footer");
    const today = button("mf-date-today", "Today");
    today.addEventListener("click", () => {
      const d = new Date();
      const parts = {y: d.getFullYear(), m: d.getMonth(), d: d.getDate()};
      if (allowed(entry.input, parts)) choose(iso(parts.y, parts.m, parts.d));
    });
    const clear = button("mf-date-clear", "Clear date");
    clear.id = "mfDateClear";
    clear.addEventListener("click", () => chooseEmpty());
    footer.append(today, clear);

    dialog.append(handle, top, navigation, calendar, monthsView, footer);
    overlay.append(dialog);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.body.append(overlay);
  }
  function chooseEmpty() {
    if (!entry || entry.input.required) return;
    entry.input.value = "";
    entry.input.dispatchEvent(new Event("input", { bubbles: true }));
    entry.input.dispatchEvent(new Event("change", { bubbles: true }));
    entry.refresh();
    close();
  }
  function open(item) {
    if (overlay && !overlay.hidden) return;
    createOverlay();
    entry = item;
    focusBefore = document.activeElement;
    oldOverflow = document.body.style.overflow;
    const selected = parseDate(item.input.value);
    const current = selected || (() => {
      const d = new Date();
      return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    })();
    year = current.y;
    month = current.m;
    showingMonths = false;
    $("mfDateDialogTitle").textContent = "Select Date";
    $("mfDateClear").hidden = item.input.required;
    draw();
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    try {
      history.pushState({ moneyflowDatePicker: true }, "", location.href);
      historyAdded = true;
    } catch (error) { historyAdded = false; }
    $("mfDateCurrentMonth").focus({ preventScroll: true });
  }
  function enhance(input) {
    if (registry.has(input) || !input.id || input.dataset.mfDateNative === "skip") return;
    const associated = [...document.querySelectorAll('label[for]')]
      .find(node => node.htmlFor === input.id);
    const title = (associated?.textContent || input.getAttribute("aria-label") || "Select Date")
      .replace(/\s+/g, " ").replace(/\(Optional\)/gi, "").replace(/\*/g, "").trim();
    const trigger = button("mf-date-trigger", "", title || "Select Date");
    const valueText = element("span", "mf-date-value");
    const icon = element("span", "mf-date-icon");
    icon.innerHTML = calendarIcon();
    icon.setAttribute("aria-hidden", "true");
    trigger.append(valueText, icon);
    const item = { input, trigger, title, refresh() {
      valueText.textContent = labelDate(input.value);
      trigger.classList.toggle("is-empty", !parseDate(input.value));
      trigger.disabled = input.disabled;
      trigger.setAttribute("aria-label", `${title || "Select Date"}: ${valueText.textContent}`);
    }};
    registry.set(input, item);
    // Retain original type, ID, value, constraint validation and storage flow.
    input.classList.add("mf-date-original");
    input.setAttribute("tabindex", "-1");
    trigger.addEventListener("click", () => open(item));
    input.insertAdjacentElement("afterend", trigger);
    input.addEventListener("input", item.refresh);
    input.addEventListener("change", item.refresh);
    // Labels must open the branded picker, not Android's native one.
    associated?.addEventListener("click", e => {
      if (!input.disabled) { e.preventDefault(); open(item); }
    });
    item.refresh();
  }
  function refreshAll() { registry.forEach(item => item.refresh()); }
  function init() {
    document.querySelectorAll('input[type="date"]').forEach(enhance);
    document.addEventListener("reset", () => setTimeout(refreshAll, 0), true);
    document.addEventListener("click", () => setTimeout(refreshAll, 0), true);
    document.addEventListener("keydown", e => {
      if (!overlay || overlay.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab") {
        const controls = [...overlay.querySelectorAll("button:not([disabled])")]
          .filter(b => b.offsetParent !== null);
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
    // Capture popstate before core.js and feature pages, so Android Back
    // closes ONLY this sheet even when an add-transaction modal is open.
    window.addEventListener("popstate", e => {
      if (awaitingHistoryBack) {
        awaitingHistoryBack = false;
        e.stopImmediatePropagation();
      } else if (overlay && !overlay.hidden) {
        e.stopImmediatePropagation();
        close(true);
      }
    }, true);
  }
  window.MoneyFlowDatePicker = { refreshAll };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
