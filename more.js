
/* ============================================
   MONEYFLOW — MORE PAGE
   AMOLED + EMERALD EDITION

   Requires core.js, more.html and more.css.
   Shares Home's monthlyBudget setting.
   Does not modify financial records.
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const MF = typeof MoneyFlow !== "undefined" ? MoneyFlow : null;
  if (!MF) {
    console.error("MoneyFlow: core.js is missing on the More page.");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const overlay = $("moreSheetOverlay");
  const sheet = overlay?.querySelector(".more-sheet");
  const title = $("moreSheetTitle");
  const closeButton = $("moreCloseSheetBtn");
  const page = $("moreMainView");
  const navigation = document.querySelector(".more-bottom-nav");
  const panels = Array.from(document.querySelectorAll(".more-panel[data-panel]"));

  
const panelTitles = {
  categories: "View Categories",
  reports: "View Reports",
  budget: "Monthly Budget",
  refer: "Refer Friends",
  help: "Help & Support"
};


  let previouslyFocused = null;
  let previousBodyOverflow = "";
  let previousHtmlOverflow = "";
  let pushedSheetHistory = false;

  document.documentElement.classList.add("dark");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = "#09090f";

  // Keep toast messages visible above a bottom sheet and the nav bar.
  function notify(message, type = "success") {
    MF.showToast(message, type);
    const container = $("moneyflowToastContainer");
    if (container) {
      container.style.zIndex = "650";
      container.style.bottom = "calc(95px + env(safe-area-inset-bottom))";
    }
  }

  // The page's existing Income, Settings and bottom-navigation links
  // are native <a href> elements; they do not need JS listeners.
  document.querySelectorAll("[data-more-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      openPanel(button.dataset.morePanel);
    });
  });

  $("moreCalendarBtn")?.addEventListener("click", () => {
    notify("Calendar is not available yet. You can view your transactions on Home.");
  });

  $("moreInsuranceBtn")?.addEventListener("click", () => {
    notify("Insurance tracking is coming soon.");
  });

  closeButton?.addEventListener("click", () => closePanel());

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) closePanel();
  });

  document.addEventListener("keydown", (event) => {
    if (!isPanelOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }

    // Keep keyboard focus inside the open dialog.
    if (event.key === "Tab" && sheet) {
      const focusables = Array.from(sheet.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.closest("[hidden]"));

      if (focusables.length === 0) {
        event.preventDefault();
        sheet.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // An Android back gesture closes the panel instead of exiting More.
  window.addEventListener("popstate", () => {
    if (pushedSheetHistory && isPanelOpen()) {
      closePanel(true);
    }
  });

  $("moreBudgetForm")?.addEventListener("submit", saveBudget);
  $("moreShareAppBtn")?.addEventListener("click", shareApp);
  $("moreCopyLinkBtn")?.addEventListener("click", copyAppLink);

  window.addEventListener("pageshow", () => {
    if (isPanelOpen() && !$("moreBudgetPanel")?.hidden) {
      fillBudgetAmount();
    }
  });

  /* ---------------- BOTTOM SHEETS ---------------- */

  function isPanelOpen() {
    return !!overlay && !overlay.hidden;
  }

  function openPanel(name) {
    if (!overlay || !sheet || !title || !(name in panelTitles)) return;

    // Avoid editing settings if the stored settings are unreadable.
    if (name === "budget" && !fillBudgetAmount()) return;

    const wasOpen = isPanelOpen();
    if (!wasOpen) {
      previouslyFocused = document.activeElement;
      previousBodyOverflow = document.body.style.overflow;
      previousHtmlOverflow = document.documentElement.style.overflow;
    }

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });

    title.textContent = panelTitles[name];
    overlay.hidden = false;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (page) page.inert = true;
    if (navigation) navigation.inert = true;

    if (!wasOpen) {
      try {
        history.pushState({ moneyflowMoreSheet: true }, "", location.href);
        pushedSheetHistory = true;
      } catch (error) {
        // The sheet still works if a preview environment blocks history.
        pushedSheetHistory = false;
      }
    }

    closeButton?.focus();
  }

  function closePanel(fromPopstate = false) {
    if (!isPanelOpen()) return;

    overlay.hidden = true;
    panels.forEach((panel) => { panel.hidden = true; });

    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    if (page) page.inert = false;
    if (navigation) navigation.inert = false;

    if (previouslyFocused?.isConnected && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
    previouslyFocused = null;

    const shouldGoBack = pushedSheetHistory && !fromPopstate &&
      history.state?.moneyflowMoreSheet === true;
    pushedSheetHistory = false;
    if (shouldGoBack) history.back();
  }

  /* ---------------- SHARED HOME BUDGET ---------------- */

  function safeSettings() {
    try {
      const raw = localStorage.getItem("moneyflow_settings");
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Invalid saved settings format.");
        }
      }
      return MF.getSettings();
    } catch (error) {
      console.error("MoneyFlow: Saved settings could not be read.", error);
      notify("Saved settings could not be read. Nothing was changed.", "error");
      return null;
    }
  }

  function fillBudgetAmount() {
    const settings = safeSettings();
    if (!settings) return false;

    const input = $("moreBudgetAmount");
    if (input) {
      const amount = Number(settings.monthlyBudget);
      input.value = Number.isFinite(amount) && amount >= 0 ? String(amount) : "0";
    }
    return true;
  }

  function saveBudget(event) {
    event.preventDefault();
    const input = $("moreBudgetAmount");
    const raw = input?.value.trim() ?? "";
    const amount = Number(raw);

    if (raw === "" || !Number.isFinite(amount) || amount < 0 ||
        amount > Number.MAX_SAFE_INTEGER || !input?.checkValidity()) {
      notify("Enter a valid monthly budget amount.", "error");
      input?.focus();
      return;
    }

    const settings = safeSettings();
    if (!settings) return;

    const saved = MF.saveSettings({
      ...settings,
      monthlyBudget: amount
    });

    if (!saved) {
      notify("Couldn't save your budget. Please try again.", "error");
      return;
    }

    closePanel();
    notify(amount === 0 ? "Monthly budget removed." : "Monthly budget saved.");
  }

  /* ---------------- REFER FRIENDS ---------------- */

  function getShareUrl() {
    // Prefer the actual Netlify deployment; never send an SPCK preview
    // or localhost URL to someone else.
    if (location.protocol === "https:" &&
        location.hostname.toLowerCase().endsWith(".netlify.app")) {
      return new URL("welcome.html", location.href).href;
    }

    // Same public project address already used in dashboard.js.
    return "https://moneyflow-finance.netlify.app/welcome.html";
  }

  async function shareApp() {
    const url = getShareUrl();
    const data = {
      title: "MoneyFlow",
      text: "Track your income, spending, payments and debts with MoneyFlow.",
      url
    };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
      } catch (error) {
        if (error?.name !== "AbortError") {
          notify("Could not open sharing. Try Copy app link instead.", "error");
        }
      }
      return;
    }

    await copyAppLink();
  }

  async function copyAppLink() {
    const url = getShareUrl();
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard is not available.");
      }
      await navigator.clipboard.writeText(url);
      notify("MoneyFlow link copied.");
    } catch (error) {
      // Safe fallback for SPCK Preview and older Android browsers.
      window.prompt("Copy the MoneyFlow link:", url);
    }
  }
});
