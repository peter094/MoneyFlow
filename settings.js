/* =====================================================================
   MONEYFLOW — SETTINGS PAGE
   Depends on core.js (load it first). Handles only what's specific
   to settings.html: profile, appearance, notification prefs, and
   data management (export / import / clear / reset).
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  MoneyFlow.initTheme();
  bindEvents();
  render();
  initProfilePanel();
  MoneyFlow.onExternalChange(render);

  /* ---------------- Events ---------------- */

  function bindEvents() {
    MoneyFlow.bindThemeToggle(); // header "Theme" button

    const settingsThemeToggle = document.getElementById("settingsThemeToggle");
    if (settingsThemeToggle) {
      settingsThemeToggle.addEventListener("click", () => {
        MoneyFlow.toggleTheme();
        renderAppearance();
      });
    }

    const profileForm = document.getElementById("profileForm");
    if (profileForm) profileForm.addEventListener("submit", handleProfileSubmit);

    const editProfileBtn = document.getElementById("editProfileBtn");
    if (editProfileBtn) editProfileBtn.addEventListener("click", enterProfileEditMode);

    const cancelProfileEditBtn = document.getElementById("cancelProfileEditBtn");
    if (cancelProfileEditBtn) cancelProfileEditBtn.addEventListener("click", exitProfileEditMode);

    const currencySelect = document.getElementById("currencySelect");
    if (currencySelect) {
      currencySelect.addEventListener("change", (e) => {
        updateSettings({ currency: e.target.value });
      });
    }

    const dateFormatSelect = document.getElementById("dateFormatSelect");
    if (dateFormatSelect) {
      dateFormatSelect.addEventListener("change", (e) => {
        updateSettings({ dateFormat: e.target.value });
      });
    }

    const spendingAlertsToggle = document.getElementById("spendingAlertsToggle");
    if (spendingAlertsToggle) {
      spendingAlertsToggle.addEventListener("click", () => {
        const settings = MoneyFlow.getSettings();
        updateSettings({ spendingAlerts: !settings.spendingAlerts });
      });
    }

    const monthlySummaryToggle = document.getElementById("monthlySummaryToggle");
    if (monthlySummaryToggle) {
      monthlySummaryToggle.addEventListener("click", () => {
        const settings = MoneyFlow.getSettings();
        updateSettings({ monthlySummary: !settings.monthlySummary });
      });
    }

    const exportBtn = document.getElementById("exportDataBtn");
    if (exportBtn) exportBtn.addEventListener("click", handleExport);

    const importBtn = document.getElementById("importDataBtn");
    const importFile = document.getElementById("importFile");
    if (importBtn && importFile) {
      importBtn.addEventListener("click", () => importFile.click());
      importFile.addEventListener("change", handleImport);
    }

    const clearBtn = document.getElementById("clearTransactionsBtn");
    if (clearBtn) clearBtn.addEventListener("click", handleClearTransactions);

    const resetBtn = document.getElementById("resetAppBtn");
    if (resetBtn) resetBtn.addEventListener("click", handleResetApp);

    const checkUpdateBtn = document.getElementById("checkUpdateBtn");
    if (checkUpdateBtn) checkUpdateBtn.addEventListener("click", handleCheckUpdate);
  }

  /* ---------------- Profile: edit / view panels ---------------- */

  function handleProfileSubmit(event) {
    event.preventDefault();

    const userName = document.getElementById("userName")?.value.trim() || "";
    const userEmail = document.getElementById("userEmail")?.value.trim() || "";

    updateSettings({ userName, userEmail });
    renderProfileView();
    MoneyFlow.showToast("Profile saved.");
    switchProfilePanel("view");
  }

  function enterProfileEditMode() {
    const settings = MoneyFlow.getSettings();
    const hasProfile = !!(settings.userName && settings.userName.trim());

    const cancelBtn = document.getElementById("cancelProfileEditBtn");
    if (cancelBtn) cancelBtn.hidden = !hasProfile;

    switchProfilePanel("form");
  }

  function exitProfileEditMode() {
    // Discard any unsaved edits by re-filling the form from what's
    // actually saved, then go back to the view.
    const settings = MoneyFlow.getSettings();
    setValue("userName", settings.userName);
    setValue("userEmail", settings.userEmail);
    switchProfilePanel("view");
  }

  /* Instant, no-animation panel choice — used once on page load. */
  function initProfilePanel() {
    const settings = MoneyFlow.getSettings();
    const hasProfile = !!(settings.userName && settings.userName.trim());

    const formCard = document.getElementById("profileFormCard");
    const viewCard = document.getElementById("profileViewCard");
    const cancelBtn = document.getElementById("cancelProfileEditBtn");
    if (!formCard || !viewCard) return;

    formCard.hidden = hasProfile;
    viewCard.hidden = !hasProfile;
    if (cancelBtn) cancelBtn.hidden = true;
  }

  /* Animated crossfade between the two panels — used for user actions. */
  function switchProfilePanel(target) {
    const formCard = document.getElementById("profileFormCard");
    const viewCard = document.getElementById("profileViewCard");
    if (!formCard || !viewCard) return;

    const showEl = target === "view" ? viewCard : formCard;
    const hideEl = target === "view" ? formCard : viewCard;

    if (!hideEl.hidden) {
      hideEl.classList.add("fade-out");
    }

    setTimeout(() => {
      hideEl.hidden = true;
      hideEl.classList.remove("fade-out");

      showEl.hidden = false;
      showEl.classList.add("fade-out");
      // Force layout so the browser registers the starting state
      // before we remove the class — otherwise it just snaps in.
      void showEl.offsetWidth;
      showEl.classList.remove("fade-out");
    }, 160);
  }

  function renderProfileView() {
    const settings = MoneyFlow.getSettings();
    setText("profileViewName", settings.userName?.trim() || "—");
    setText("profileViewEmail", settings.userEmail?.trim() || "—");
  }

  /* ---------------- Data management ---------------- */

  function handleExport() {
    const data = {
      transactions: MoneyFlow.getTransactions(),
      settings: MoneyFlow.getSettings(),
      exportedAt: new Date().toISOString(),
      version: MoneyFlow.getSettings().version,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `moneyflow-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);

        if (!Array.isArray(data.transactions)) {
          MoneyFlow.showToast("This file doesn't look like a valid MoneyFlow backup.", "error");
          return;
        }

        const confirmed = await MoneyFlow.showConfirm({
          message: `Import ${data.transactions.length} transaction(s)? This will replace your current data.`,
          confirmText: "Import",
        });

        if (!confirmed) return;

        MoneyFlow.saveTransactions(data.transactions);

        if (data.settings) {
          MoneyFlow.saveSettings(data.settings);
          MoneyFlow.applyTheme(MoneyFlow.getSettings().theme);
        }

        render();
        initProfilePanel();
        MoneyFlow.showToast("Data imported successfully.");

      } catch (error) {
        console.error("MoneyFlow: Import failed.", error);
        MoneyFlow.showToast("Unable to read that file. Make sure it's a valid MoneyFlow backup.", "error");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  async function handleClearTransactions() {
    const confirmed = await MoneyFlow.showConfirm({
      message: "This will permanently delete all your transactions. This cannot be undone. Continue?",
      confirmText: "Clear",
    });
    if (!confirmed) return;

    MoneyFlow.saveTransactions([]);
    render();
    MoneyFlow.showToast("All transactions have been cleared.");
  }

  async function handleResetApp() {
    const confirmed = await MoneyFlow.showConfirm({
      message: "This will delete all transactions and reset every setting to default. This cannot be undone. Continue?",
      confirmText: "Reset",
    });
    if (!confirmed) return;

    localStorage.removeItem(MoneyFlow.STORAGE_KEYS.transactions);
    localStorage.removeItem(MoneyFlow.STORAGE_KEYS.settings);

    MoneyFlow.applyTheme("light");
    render();
    initProfilePanel();
    MoneyFlow.showToast("MoneyFlow has been reset to its default settings.");
  }

  function handleCheckUpdate() {
    const status = document.getElementById("updateStatus");
    if (status) status.textContent = "Checking for updates...";

    setTimeout(() => {
      if (status) {
        status.textContent = `You're on the latest version (v${MoneyFlow.getSettings().version}).`;
      }
    }, 700);
  }

  /* ---------------- Helpers ---------------- */

  function updateSettings(partial) {
    const settings = MoneyFlow.getSettings();
    MoneyFlow.saveSettings({ ...settings, ...partial });
    render();
  }

  /* ---------------- Render ---------------- */

  function render() {
    const settings = MoneyFlow.getSettings();

    setValue("userName", settings.userName);
    setValue("userEmail", settings.userEmail);
    setValue("currencySelect", settings.currency);
    setValue("dateFormatSelect", settings.dateFormat);

    setToggleText("spendingAlertsToggle", settings.spendingAlerts);
    setToggleText("monthlySummaryToggle", settings.monthlySummary);

    setText("appVersion", `v${settings.version}`);

    renderProfileView();
    renderAppearance();
  }

  function renderAppearance() {
    // Nothing extra needed right now — MoneyFlow.applyTheme already
    // keeps the <html class="dark"> state in sync with settings.
    // Kept as its own function in case the appearance section grows.
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? "";
    // Syncs the custom dropdown's visible label without re-firing
    // 'change' (that would loop back into updateSettings -> render).
    if (typeof el.moneyflowRefresh === "function") {
      el.moneyflowRefresh();
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setToggleText(id, isOn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = isOn ? "On" : "Off";
    el.classList.toggle("active", isOn);
  }

});
