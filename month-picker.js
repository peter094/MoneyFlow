/* MoneyFlow Month Picker — custom AMOLED emerald month/year dialog.
   This only changes month filters on Income and Spending.
   The existing hidden fields keep the original YYYY-MM value and change events.
   No financial data is written by this component.
*/
(() => {
  "use strict";
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const pairs = [
    { inputId: "incomeMonthPicker", headerId: "incomeCalendarBtn" },
    { inputId: "spendingMonthPicker", headerId: "spendingCalendarBtn" }
  ];
  const byId = id => document.getElementById(id);
  let active = null;
  let modal = null;
  let previousFocus = null;
  let oldOverflow = "";
  let historyIsOpen = false;
  let awaitingHistoryBack = false;
  let chosenYear = new Date().getFullYear();

  function getMonth(value) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value || "");
    const d = new Date();
    return match ? { year: Number(match[1]), month: Number(match[2])-1 }
      : { year: d.getFullYear(), month: d.getMonth() };
  }
  function monthText(value) {
    const parts = getMonth(value);
    return `${months[parts.month]} ${parts.year}`;
  }
  function el(tag, cls, text) {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function setOpen(open) {
    if (!modal) return;
    modal.hidden = !open;
    document.body.style.overflow = open ? "hidden" : oldOverflow;
  }
  function close(fromHistory = false) {
    if (!modal || modal.hidden) return;
    setOpen(false);
    const returnHistory = historyIsOpen && !fromHistory && history.state?.mfMonthPicker;
    historyIsOpen = false;
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
    if (returnHistory) {
      awaitingHistoryBack = true;
      history.back();
      setTimeout(() => { awaitingHistoryBack = false; }, 1200);
    }
  }
  function apply(month) {
    if (!active || month < 0 || month > 11) return;
    active.input.value = String(chosenYear).padStart(4,"0") + "-" + String(month+1).padStart(2,"0");
    active.input.dispatchEvent(new Event("change", { bubbles: true }));
    active.refresh();
    close();
  }
  function draw() {
    const header = byId("mfMonthYear");
    const grid = byId("mfMonthGrid");
    if (!header || !grid || !active) return;
    header.textContent = String(chosenYear);
    grid.replaceChildren();
    const now = getMonth(active.input.value);
    months.forEach((name, idx) => {
      const button = el("button", "mf-month-option", name.slice(0,3));
      button.type = "button";
      const selected = now.month === idx && now.year === chosenYear;
      button.classList.toggle("is-selected",selected);
      button.setAttribute("aria-pressed",String(selected));
      button.setAttribute("aria-label", `${name} ${chosenYear}`);
      button.addEventListener("click", () => apply(idx));
      grid.append(button);
    });
  }
  function open(pair) {
    if (modal && !modal.hidden) return;
    active=pair;
    previousFocus=document.activeElement;
    oldOverflow=document.body.style.overflow;
    chosenYear=getMonth(pair.input.value).year;
    createDialog();
    draw();
    setOpen(true);
    try {
      history.pushState({ mfMonthPicker: true }, "", location.href);
      historyIsOpen=true;
    } catch (error) { historyIsOpen=false; }
    byId("mfMonthClose")?.focus();
  }
  function createDialog() {
    if (modal) return;
    modal=el("div","mf-month-backdrop");
    modal.hidden=true;
    const dialog=el("section","mf-month-dialog");
    dialog.setAttribute("role","dialog");
    dialog.setAttribute("aria-modal","true");
    dialog.setAttribute("aria-labelledby","mfMonthTitle");
    const grip=el("span","mf-month-handle");
    grip.setAttribute("aria-hidden", "true");
    const top=el("div","mf-month-top");
    top.append(el("h2","", "Choose a month"));
    top.firstElementChild.id="mfMonthTitle";
    const closeBtn=el("button","mf-month-close","×");
    closeBtn.id="mfMonthClose";
    closeBtn.type="button";
    closeBtn.setAttribute("aria-label","Close month selector");
    closeBtn.addEventListener("click",()=>close());
    top.append(closeBtn);
    const nav=el("div","mf-month-year-row");
    const prev=el("button","mf-month-year-arrow","‹");
    prev.type="button";prev.setAttribute("aria-label","Previous year");
    prev.addEventListener("click",()=>{chosenYear=Math.max(1900,chosenYear-1);draw();});
    const year=el("strong","mf-month-year","");year.id="mfMonthYear";
    const next=el("button","mf-month-year-arrow","›");
    next.type="button";next.setAttribute("aria-label","Next year");
    next.addEventListener("click",()=>{chosenYear=Math.min(2100,chosenYear+1);draw();});
    nav.append(prev,year,next);
    const grid=el("div","mf-month-grid");grid.id="mfMonthGrid";
    const footer=el("div","mf-month-footer");
    const todayBtn=el("button","mf-month-today","This month");
    todayBtn.type="button";
    todayBtn.addEventListener("click",()=>{const now=new Date();chosenYear=now.getFullYear();apply(now.getMonth());});
    const cancelBtn=el("button","mf-month-cancel","Cancel");
    cancelBtn.type="button";cancelBtn.addEventListener("click",()=>close());
    footer.append(todayBtn,cancelBtn);
    dialog.append(grip,top,nav,grid,footer);modal.append(dialog);
    modal.addEventListener("click",event=>{if(event.target===modal)close();});
    document.body.append(modal);
  }
  function enhance(pair) {
    const input=byId(pair.inputId);
    if (!input) return;
    const wrapper=input.parentElement;
    input.type="hidden"; // disable Android's native spinning month popup
    const button=el("button","mf-month-trigger", "Select month");
    button.type="button";
    button.setAttribute("aria-label", "Select reporting month");
    button.innerHTML='<span class="mf-month-trigger-label"></span><span class="mf-month-calendar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/></svg></span>';
    wrapper.append(button);
    const entry={input,button,refresh:()=>{
      button.querySelector(".mf-month-trigger-label").textContent=monthText(input.value);
    }};
    button.addEventListener("click",()=>open(entry));
    input.addEventListener("change",entry.refresh);
    // Capture phase runs before the existing income.js/spending.js showPicker handler.
    byId(pair.headerId)?.addEventListener("click",event=>{
      event.preventDefault();event.stopImmediatePropagation();open(entry);
    },true);
    window.setTimeout(entry.refresh,0);
    registry.push(entry);
  }
  const registry=[];
  window.MoneyFlowMonthPicker={refreshAll:()=>registry.forEach(pair=>pair.refresh())};
  document.addEventListener("DOMContentLoaded",()=>{
    pairs.forEach(enhance);
    document.addEventListener("keydown",event=>{
      if (!modal || modal.hidden) return;
      if (event.key==="Escape") {event.preventDefault();close();}
      if (event.key==="Tab") {
        const targets=Array.from(modal.querySelectorAll("button:not([disabled])"));
        const first=targets[0],last=targets[targets.length-1];
        if (event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus();}
        else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
      }
    });
    window.addEventListener("popstate",event=>{
      if (awaitingHistoryBack) {
        awaitingHistoryBack=false;
        event.stopImmediatePropagation();
      } else if (modal && !modal.hidden) {
        event.stopImmediatePropagation();
        close(true);
      }
    },true);
  });
})();
