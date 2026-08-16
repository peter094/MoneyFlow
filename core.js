/* =====================================================================
   MONEYFLOW — CORE
   Version: 1.0.0

   Shared logic used by every page (dashboard.js, transactions.js,
   analytics.js, settings.js). Load this BEFORE the page-specific
   script:

     <script src="core.js" defer></script>
     <script src="dashboard.js" defer></script>

   Responsibilities:
   - Transaction & settings storage (localStorage)
   - Calculations (totals, category breakdown)
   - Currency / date formatting
   - Theme (applies the SAME convention every page uses: a
     `dark` class on <html>, persisted in moneyflow_settings)
   - Transaction modal open/close (shared markup + IDs across pages)
   - Cross-tab / cross-page sync via the `storage` event
   ===================================================================== */

const MoneyFlow = (() => {

  const STORAGE_KEYS = {
    transactions: "moneyflow_transactions",
    settings: "moneyflow_settings",
  };

  // Lets Android's hardware/gesture back button close an open modal
  // or confirm dialog instead of leaving the page (or the installed
  // app). See the popstate listener near the bottom of this file.
  let modalHistoryPushed = false;
  let activeConfirmCancel = null;
  let suppressHistoryBack = false;

  const DEFAULT_SETTINGS = {
    currency: "NGN",
    theme: "light",
    dateFormat: "DD/MM/YYYY",
    userName: "",
    userEmail: "",
    spendingAlerts: false,
    monthlySummary: false,
    version: "1.0.0",
  };

  const CATEGORIES = [
    "Salary",
    "Food",
    "Transport",
    "Bills",
    "Entertainment",
    "Shopping",
    "Other",
  ];

  const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };

  /* ---------------- Storage ---------------- */

  function getTransactions() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.transactions);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("MoneyFlow: Unable to load transactions.", error);
      return [];
    }
  }

  function saveTransactions(transactions) {
    try {
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
      return true;
    } catch (error) {
      console.error("MoneyFlow: Unable to save transactions.", error);
      return false;
    }
  }

  function getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.settings);
      if (!stored) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (error) {
      console.error("MoneyFlow: Unable to load settings.", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ ...DEFAULT_SETTINGS, ...settings })
      );
      return true;
    } catch (error) {
      console.error("MoneyFlow: Unable to save settings.", error);
      return false;
    }
  }

  /* ---------------- Helpers ---------------- */

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  function formatCurrency(amount) {
    const settings = getSettings();
    const currency = settings.currency || "NGN";
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch {
      return `${CURRENCY_SYMBOLS[currency] || "₦"}${(Number(amount) || 0).toFixed(2)}`;
    }
  }

  function formatShortCurrency(amount) {
    const settings = getSettings();
    const symbol = CURRENCY_SYMBOLS[settings.currency] || "₦";
    return `${symbol}${(Number(amount) || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }

  function formatDate(dateString) {
    if (!dateString) return "No date";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;

    const settings = getSettings();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    switch (settings.dateFormat) {
      case "MM/DD/YYYY":
        return `${month}/${day}/${year}`;
      case "YYYY-MM-DD":
        return `${year}-${month}-${day}`;
      default:
        return `${day}/${month}/${year}`;
    }
  }

  function formatPercent(value) {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  /* ---------------- Calculations ---------------- */

  function calculateTotals(transactions) {
    let income = 0;
    let expenses = 0;

    transactions.forEach((t) => {
      const amount = Number(t.amount) || 0;
      if (t.type === "income") income += amount;
      if (t.type === "expense") expenses += amount;
    });

    return { income, expenses, balance: income - expenses };
  }

  function calculateCategoryTotals(transactions) {
    const categories = {};
    CATEGORIES.forEach((c) => (categories[c] = 0));

    transactions.forEach((t) => {
      if (t.type !== "expense") return;
      const category = t.category || "Other";
      if (!(category in categories)) categories[category] = 0;
      categories[category] += Number(t.amount) || 0;
    });

    return categories;
  }

  function filterTransactions(transactions, { search = "", type = "all", category = "all" } = {}) {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      const matchesSearch =
        !term ||
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term);
      const matchesType = type === "all" || t.type === type;
      const matchesCategory = category === "all" || t.category === category;
      return matchesSearch && matchesType && matchesCategory;
    });
  }

  function sortByDateDesc(transactions) {
    return [...transactions].sort(
      (a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`)
    );
  }

  /* ---------------- Toast notifications ---------------- */
  // A small in-app message that slides in and auto-dismisses, styled
  // to match the app instead of the browser's native alert() box.

  function showToast(message, type = "success") {
    let container = document.getElementById("moneyflowToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "moneyflowToastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  /* ---------------- Confirm dialog ---------------- */
  // Replaces the browser's native confirm() box for destructive
  // actions. Returns a Promise<boolean> — true if the person
  // confirmed, false if they cancelled/dismissed it.

  function showConfirm({ message, confirmText = "Continue", cancelText = "Cancel", danger = true } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "confirm-overlay";

      const box = document.createElement("div");
      box.className = "confirm-box";

      const messageEl = document.createElement("p");
      messageEl.className = "confirm-message";
      messageEl.textContent = message || "Are you sure?";

      const actions = document.createElement("div");
      actions.className = "confirm-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "secondary-button";
      cancelBtn.textContent = cancelText;

      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = danger ? "primary-button confirm-danger" : "primary-button";
      confirmBtn.textContent = confirmText;

      function cleanup(result) {
        overlay.classList.remove("show");
        document.removeEventListener("keydown", onKeydown);
        setTimeout(() => overlay.remove(), 200);

        if (activeConfirmCancel) {
          activeConfirmCancel = null;
          if (!suppressHistoryBack) {
            suppressHistoryBack = true;
            history.back();
          }
        }

        resolve(result);
      }

      function onKeydown(event) {
        if (event.key === "Escape") cleanup(false);
      }

      cancelBtn.addEventListener("click", () => cleanup(false));
      confirmBtn.addEventListener("click", () => cleanup(true));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) cleanup(false);
      });

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      box.appendChild(messageEl);
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // So the Android back button cancels this dialog instead of
      // navigating away — same pattern as the transaction modal.
      activeConfirmCancel = () => cleanup(false);
      history.pushState({ moneyflowConfirm: true }, "", location.href);

      document.addEventListener("keydown", onKeydown);
      requestAnimationFrame(() => overlay.classList.add("show"));
      setTimeout(() => confirmBtn.focus(), 50);
    });
  }

  /* ---------------- Validation & mutation ---------------- */

  function validateTransaction(data) {
    if (!data) return { valid: false, message: "Transaction data is missing." };

    if (data.type !== "income" && data.type !== "expense") {
      return { valid: false, message: "Please select a valid transaction type." };
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { valid: false, message: "Please enter a valid amount greater than zero." };
    }

    if (!data.category) return { valid: false, message: "Please select a category." };
    if (!data.description?.trim()) return { valid: false, message: "Please enter a description." };
    if (!data.date) return { valid: false, message: "Please select a date." };

    return { valid: true, message: "" };
  }

  function addTransaction(data) {
    const validation = validateTransaction(data);
    if (!validation.valid) {
      showToast(validation.message, "error");
      return false;
    }

    const transactions = getTransactions();

    transactions.push({
      id: generateId(),
      type: data.type,
      amount: Number(data.amount),
      category: data.category,
      description: data.description.trim(),
      date: data.date,
      createdAt: new Date().toISOString(),
    });

    if (!saveTransactions(transactions)) {
      showToast("Unable to save the transaction. Please try again.", "error");
      return false;
    }

    showToast("Transaction added.", "success");
    return true;
  }

  function deleteTransaction(id) {
    const transactions = getTransactions().filter((t) => t.id !== id);
    return saveTransactions(transactions);
  }

  /* ---------------- Theme ---------------- */
  // Convention used across every page: a `dark` class on <html>,
  // persisted inside moneyflow_settings.theme.

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Keep these two in sync with the pre-paint inline script in <head>.
    root.style.backgroundColor = theme === "dark" ? "#090E17" : "#F3F6F9";

    // Matches --color-surface for each theme, so Android's status bar
    // blends with the header instead of staying a fixed navy that
    // looks wrong against a white header in light mode.
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", theme === "dark" ? "#111A28" : "#FFFFFF");
    }

    const settings = getSettings();
    if (settings.theme !== theme) {
      saveSettings({ ...settings, theme });
    }
  }

  function toggleTheme() {
    const settings = getSettings();
    applyTheme(settings.theme === "dark" ? "light" : "dark");
  }

  function initTheme() {
    applyTheme(getSettings().theme);
  }

  /* ---------------- Transaction modal ---------------- */
  // Convention used across every page: `.active` class + aria-hidden
  // on #transactionModal (matches dashboard's original markup/CSS).

  function openModal(type = "expense") {
    const modal = document.getElementById("transactionModal");
    const form = document.getElementById("transactionForm");
    const typeInput = document.getElementById("transactionType");
    const dateInput = document.getElementById("transactionDate");

    if (!modal) return;

    if (form) {
      form.reset();
      // form.reset() silently resets any <select> in it too — resync
      // every custom dropdown trigger in the modal so labels don't go stale.
      form.querySelectorAll("select").forEach((select) => {
        if (typeof select.moneyflowRefresh === "function") select.moneyflowRefresh();
      });
    }

    if (typeInput) {
      typeInput.value = type === "income" ? "income" : "expense";
      if (typeof typeInput.moneyflowRefresh === "function") {
        typeInput.moneyflowRefresh();
      }
    }

    if (dateInput) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      dateInput.value = `${year}-${month}-${day}`;
    }

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("active");

    if (!modalHistoryPushed) {
      modalHistoryPushed = true;
      history.pushState({ moneyflowModal: true }, "", location.href);
    }

    const amountInput = document.getElementById("transactionAmount");
    if (amountInput) setTimeout(() => amountInput.focus(), 100);
  }

  function closeModal() {
    const modal = document.getElementById("transactionModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("active");

    if (modalHistoryPushed) {
      modalHistoryPushed = false;
      // If this close was triggered BY the back button (popstate),
      // the browser already moved back one entry — calling
      // history.back() again here would skip an extra page.
      if (!suppressHistoryBack) {
        suppressHistoryBack = true;
        history.back();
      }
    }
  }

  function bindModalBaseListeners() {
    const closeButton = document.getElementById("closeModalBtn");
    if (closeButton) closeButton.addEventListener("click", closeModal);

    const cancelButton = document.getElementById("cancelTransactionBtn");
    if (cancelButton) cancelButton.addEventListener("click", closeModal);

    const modal = document.getElementById("transactionModal");
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  function bindThemeToggle() {
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
  }

  /* ---------------- Custom select (kills the native OS picker) ---------------- */
  // Mobile browsers always open their own system picker for a <select>,
  // no matter what CSS says — that's the "wrong font/radio buttons"
  // screenshot problem. This wraps every <select> in the app with our
  // own styled trigger + dropdown, so nothing native ever shows.
  // The original <select> stays in the DOM (hidden) so existing
  // 'change' listeners and form values keep working unchanged.

  function enhanceSelect(select) {
    if (select.dataset.enhanced === "true") return;
    select.dataset.enhanced = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    select.parentNode.insertBefore(wrapper, select);

    select.classList.add("custom-select-native");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML =
      '<span class="custom-select-value"></span>' +
      '<svg class="custom-select-caret" viewBox="0 0 24 24" fill="none">' +
      '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>";

    const valueEl = trigger.querySelector(".custom-select-value");

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");

    function buildOptions() {
      menu.innerHTML = "";
      Array.from(select.options).forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "custom-select-option";
        item.textContent = option.textContent;
        item.setAttribute("role", "option");
        if (option.value === select.value) {
          item.classList.add("selected");
          item.setAttribute("aria-selected", "true");
        }
        item.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          closeMenu();
        });
        menu.appendChild(item);
      });
    }

    function syncTrigger() {
      const selected = select.options[select.selectedIndex];
      valueEl.textContent = selected ? selected.textContent : "";
      buildOptions();
    }

    function openMenu() {
      document.querySelectorAll(".custom-select.open").forEach((el) => {
        if (el !== wrapper) el.classList.remove("open");
      });
      wrapper.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("click", handleOutsideClick);
      document.addEventListener("keydown", handleKeydown);
    }

    function closeMenu() {
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleKeydown);
    }

    function handleOutsideClick(event) {
      if (!wrapper.contains(event.target)) closeMenu();
    }

    function handleKeydown(event) {
      if (event.key === "Escape") closeMenu();
    }

    trigger.addEventListener("click", () => {
      wrapper.classList.contains("open") ? closeMenu() : openMenu();
    });

    select.addEventListener("change", syncTrigger);
    select.moneyflowRefresh = syncTrigger;

    wrapper.appendChild(trigger);
    wrapper.appendChild(select);
    wrapper.appendChild(menu);

    syncTrigger();
  }

  function enhanceSelects(root = document) {
    root.querySelectorAll("select").forEach(enhanceSelect);
  }

  /* ---------------- Cross-page sync ---------------- */
  // Pass a callback to run whenever transactions or settings change
  // in another tab/page (fires on the `storage` event).

  function onExternalChange(callback) {
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEYS.transactions) {
        callback("transactions");
      }
      if (event.key === STORAGE_KEYS.settings) {
        applyTheme(getSettings().theme);
        callback("settings");
      }
    });
  }

  /* ---------------- Back button (Android) ---------------- */
  // Both openModal() and showConfirm() push one history entry when
  // they open, specifically so this fires instead of the browser
  // navigating away or the installed app closing. We only ever act
  // when one of our overlays is actually the reason a state exists —
  // a real "go to the previous page" back-press is left completely
  // alone and behaves normally.

  window.addEventListener("popstate", () => {
    if (!modalHistoryPushed && !activeConfirmCancel) return; // real navigation — do nothing

    suppressHistoryBack = true;

    if (modalHistoryPushed) {
      closeModal();
    } else if (activeConfirmCancel) {
      activeConfirmCancel();
    }

    // Let the synchronous close-handlers above finish deciding NOT to
    // call history.back() again before re-arming it for future manual
    // closes (the X button, Cancel, backdrop tap, Escape key).
    setTimeout(() => {
      suppressHistoryBack = false;
    }, 0);
  });

  /* ---------------- Public API ---------------- */

  return {
    STORAGE_KEYS,
    CATEGORIES,

    getTransactions,
    saveTransactions,
    getSettings,
    saveSettings,

    generateId,
    formatCurrency,
    formatShortCurrency,
    formatDate,
    formatPercent,
    escapeHTML,

    calculateTotals,
    calculateCategoryTotals,
    filterTransactions,
    sortByDateDesc,

    validateTransaction,
    addTransaction,
    deleteTransaction,
    showToast,
    showConfirm,

    applyTheme,
    toggleTheme,
    initTheme,
    bindThemeToggle,

    openModal,
    closeModal,
    bindModalBaseListeners,

    enhanceSelects,

    onExternalChange,
  };

})();

// Auto-run on every page — no page script needs to remember to call
// this. Runs before page-specific DOMContentLoaded handlers since
// core.js loads (and its listeners register) first.
document.addEventListener("DOMContentLoaded", () => {
  MoneyFlow.enhanceSelects();
});

/* =====================================================================
   SERVICE WORKER REGISTRATION + UPDATE BANNER
   Self-contained — doesn't touch anything in the MoneyFlow object
   above, and runs on every page since core.js loads everywhere.
   ===================================================================== */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            const alreadyHadAControllerBeforeThis = !!navigator.serviceWorker.controller;

            if (newWorker.state === "installed" && alreadyHadAControllerBeforeThis) {
              // A controller already existed, so this isn't the very
              // first install on this device — a genuinely new
              // version just finished downloading and is ready.
              showUpdateBanner(registration);
            }
          });
        });
      })
      .catch((error) => {
        console.error("MoneyFlow: Service worker registration failed.", error);
      });

    // Reload once the new worker actually takes control, so the
    // person is running the new files instead of a half-updated page.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner(registration) {
  if (document.getElementById("moneyflowUpdateBanner")) return;

  const banner = document.createElement("div");
  banner.id = "moneyflowUpdateBanner";
  banner.className = "update-banner";
  banner.innerHTML = `
    <span>A new version of MoneyFlow is available.</span>
    <button type="button">Refresh</button>
  `;

  banner.querySelector("button").addEventListener("click", () => {
    if (registration.waiting) {
      registration.waiting.postMessage("SKIP_WAITING");
    }
  });

  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add("show"));
}

registerServiceWorker();

/* =====================================================================
   INSTALL APP PROMPT
   Uses the real beforeinstallprompt event — nothing here fakes an
   install. If the browser never fires that event (Safari, Firefox
   desktop, already installed, etc.), no prompt is ever built, so
   there's never a button that doesn't work.
   ===================================================================== */

const INSTALL_DISMISS_KEY = "moneyflow_install_dismissed_at";
const INSTALL_DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const INSTALL_PROMPT_DELAY_MS = 2500; // let the page settle first

let deferredInstallPrompt = null;

function isRunningInstalled() {
  const standaloneMedia =
    window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = window.navigator.standalone === true; // iOS Safari's own flag
  return !!(standaloneMedia || iosStandalone);
}

function wasInstallPromptRecentlyDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY));
    if (!dismissedAt) return false;
    return Date.now() - dismissedAt < INSTALL_DISMISS_COOLDOWN_MS;
  } catch (error) {
    return false;
  }
}

function recordInstallPromptDismissal() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  } catch (error) {
    // Storage unavailable (private browsing, quota, etc.) — worst
    // case the prompt just shows again next visit, not a big deal.
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  // Stop the browser's own mini-infobar so we control the UI instead.
  event.preventDefault();
  deferredInstallPrompt = event;

  if (isRunningInstalled() || wasInstallPromptRecentlyDismissed()) return;

  setTimeout(showInstallPrompt, INSTALL_PROMPT_DELAY_MS);
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  hideInstallPrompt();
  MoneyFlow.showToast("MoneyFlow installed — check your home screen!");
});

function showInstallPrompt() {
  if (!deferredInstallPrompt) return; // dismissed/installed before the delay fired
  if (isRunningInstalled()) return;
  if (document.getElementById("moneyflowInstallPrompt")) return;

  const card = document.createElement("div");
  card.id = "moneyflowInstallPrompt";
  card.className = "install-prompt";
  card.innerHTML = `
    <button type="button" class="install-prompt-close" aria-label="Dismiss">&times;</button>
    <div class="install-prompt-body">
      <div class="install-prompt-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 16L9.5 10.5L13.5 14.5L20 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15 8H20V13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="install-prompt-text">
        <h3>Install MoneyFlow</h3>
        <p>Install the MoneyFlow app for a faster, smoother experience and quick access from your home screen.</p>
      </div>
    </div>
    <div class="install-prompt-actions">
      <button type="button" class="secondary-button" id="installPromptLater">Maybe Later</button>
      <button type="button" class="primary-button" id="installPromptInstall">Install App</button>
    </div>
  `;

  document.body.appendChild(card);
  requestAnimationFrame(() => card.classList.add("show"));

  card.querySelector(".install-prompt-close").addEventListener("click", dismissInstallPrompt);
  document.getElementById("installPromptLater").addEventListener("click", dismissInstallPrompt);
  document.getElementById("installPromptInstall").addEventListener("click", triggerInstall);
}

function hideInstallPrompt() {
  const card = document.getElementById("moneyflowInstallPrompt");
  if (!card) return;
  card.classList.remove("show");
  setTimeout(() => card.remove(), 250);
}

function dismissInstallPrompt() {
  recordInstallPromptDismissal();
  hideInstallPrompt();
}

async function triggerInstall() {
  if (!deferredInstallPrompt) {
    hideInstallPrompt();
    return;
  }

  hideInstallPrompt();

  // This is the real, browser-native install prompt — not a fake one.
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;

  if (outcome !== "accepted") {
    recordInstallPromptDismissal();
  }
  // If accepted, the 'appinstalled' listener above handles cleanup.
}
