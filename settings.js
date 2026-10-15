
/* MONEYFLOW — SETTINGS FUNCTIONALITY
   Requires core.js to load first.
*/

document.addEventListener("DOMContentLoaded", () => {

  const $ = (id) => document.getElementById(id);

  // FIX: Access the global MoneyFlow variable
  // defined in core.js.
  const MF = MoneyFlow;

  if (!MF) {
    console.error("MoneyFlow core.js is missing");
    return;
  }

  const settings = () => MF.getSettings();

  const save = (partial) => MF.saveSettings({
    ...settings(),
    ...partial
  });

  const user = MF.getAuthUser?.() || {};

  const accountEmail =
    user.email || settings().userEmail || "";

  function refreshIdentity() {
    const name =
      settings().userName?.trim() ||
      user.name?.trim() ||
      "MoneyFlow User";

    $("accountName").textContent = name;
    $("accountEmail").textContent =
      accountEmail || "Signed in";

    $("accountAvatar").textContent =
      name.charAt(0).toUpperCase();
  }

  refreshIdentity();

  /* NOTIFICATION PREFERENCES */

  $("paymentRemindersToggle").checked =
    !!settings().paymentReminders;

  $("insuranceAlertsToggle").checked =
    !!settings().insuranceAlerts;

  $("paymentRemindersToggle")
    .addEventListener("change", (e) => {
      if (!save({ paymentReminders: e.target.checked })) {
        e.target.checked = !!settings().paymentReminders;
        MF.showToast?.("Unable to save reminder preference.", "error");
      }
    });

  $("insuranceAlertsToggle")
    .addEventListener("change", (e) => {
      if (!save({ insuranceAlerts: e.target.checked })) {
        e.target.checked = !!settings().insuranceAlerts;
        MF.showToast?.("Unable to save insurance alert preference.", "error");
      }
    });

  /* POPUP PANELS */

  let previousFocus = null;

  const sheets = [
    "profileSheet",
    "preferencesSheet",
    "privacySheet"
  ];

  function openSheet(which, title) {
    previousFocus = document.activeElement;

    sheets.forEach((id) => {
      $(id).hidden = id !== which;
    });

    $("sheetTitle").textContent = title;
    $("sheetOverlay").hidden = false;

    document.body.style.overflow = "hidden";
    $("closeSheetBtn").focus();
  }

  function closeSheet() {
    $("sheetOverlay").hidden = true;
    document.body.style.overflow = "";

    if (previousFocus?.focus) {
      previousFocus.focus();
    }
  }

  $("closeSheetBtn")
    .addEventListener("click", closeSheet);

  $("sheetOverlay")
    .addEventListener("click", (e) => {
      if (e.target === $("sheetOverlay")) {
        closeSheet();
      }
    });

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      !$("sheetOverlay").hidden
    ) {
      closeSheet();
    }
  });

  /* PROFILE */

  $("profileBtn")
    .addEventListener("click", () => {

      $("userName").value =
        settings().userName ||
        user.name ||
        "MoneyFlow User";

      $("userEmail").value = accountEmail;

      openSheet("profileSheet", "Profile");
    });

  $("profileForm")
    .addEventListener("submit", (e) => {
      e.preventDefault();

      const name = $("userName").value.trim();

      if (!name) return;

      if (!save({ userName: name })) {
        MF.showToast?.("Unable to save profile. Existing settings were preserved.", "error");
        return;
      }

      refreshIdentity();
      closeSheet();

      MF.showToast?.("Profile saved");
    });

  /* PREFERENCES */

  $("preferencesBtn")
    .addEventListener("click", () => {

      $("currencySelect").value =
        settings().currency || "NGN";

      $("dateFormatSelect").value =
        settings().dateFormat || "DD/MM/YYYY";

      openSheet("preferencesSheet", "Preferences");
    });

  $("savePreferencesBtn")
    .addEventListener("click", () => {

      if (!save({
        currency: $("currencySelect").value,
        dateFormat: $("dateFormatSelect").value
      })) {
        MF.showToast?.("Unable to save preferences. Existing settings were preserved.", "error");
        return;
      }

      closeSheet();

      MF.showToast?.("Preferences saved");
    });

  /* PRIVACY INFORMATION */

  $("privacyBtn")
    .addEventListener("click", () => {
      openSheet(
        "privacySheet",
        "Privacy Information"
      );
    });

 
  /* Human-readable PDF or CSV exports use a dedicated screen. */
  $("exportDataBtn").addEventListener("click", () => {
    window.location.href = "export.html";
  });

  /* Keep the existing full-fidelity backup available separately.
     PDF/CSV can't be used to restore settings, debts and recurring rules. */
  $("backupDataBtn")
    .addEventListener("click", () => {
      let downloadUrl = null;

      try {
        // These are the financial-data keys actually used
        // by the current MoneyFlow app.
        
const storageKeys = {
  transactions: "moneyflow_transactions",
  payments: "moneyflow_payments",
  debts: "moneyflow_debts",
  insurance: "moneyflow_insurance",
  incomeRepeatRules: "moneyflow_income_repeat_rules",
  settings: "moneyflow_settings"
};


        const readableData = {};
        const rawStorage = {};
        const unreadableKeys = [];

        for (const [label, key] of Object.entries(storageKeys)) {
          const raw = localStorage.getItem(key);

          // Store exact original values for safe future recovery.
          // null means this key did not exist on this device.
          rawStorage[key] = raw;

          if (raw === null) {
            readableData[label] = null;
            continue;
          }

          try {
            readableData[label] = JSON.parse(raw);
          } catch (error) {
            readableData[label] = null;
            unreadableKeys.push(key);
          }
        }

        const backup = {
          app: "MoneyFlow",
          backupFormat: "moneyflow-local-backup-v2",
          exportedAt: new Date().toISOString(),
          data: readableData,
          rawStorage: rawStorage,
          unreadableKeys: unreadableKeys,
          note: "rawStorage preserves exact saved values. " +
            "This export does not include authentication tokens."
        };

        const blob = new Blob(
          [JSON.stringify(backup, null, 2)],
          { type: "application/json" }
        );

        downloadUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download =
          "moneyflow-full-backup-" +
          new Date().toISOString().slice(0, 10) +
          ".json";

        document.body.appendChild(link);
        link.click();
        link.remove();

        const urlToRelease = downloadUrl;
        downloadUrl = null;

        setTimeout(() => {
          URL.revokeObjectURL(urlToRelease);
        }, 10000);

        if (unreadableKeys.length) {
          MF.showToast?.(
            "Backup created. Some saved data was unreadable, " +
            "but its original values were preserved.",
            "error"
          );
        } else {
          MF.showToast?.("MoneyFlow backup prepared.");
        }

      } catch (error) {
        console.error("MoneyFlow backup failed:", error);

        if (downloadUrl) {
          URL.revokeObjectURL(downloadUrl);
        }

        MF.showToast?.(
          "Unable to export your data. Nothing was changed.",
          "error"
        );
      }
    });


  if (location.hash === "#backup-data") {
    document.getElementById("backupDataBtn")?.scrollIntoView({ block: "center", behavior: "auto" });
  }

  /* LOG OUT */

  $("logoutBtn")
    .addEventListener("click", async () => {

      const confirmed = await MF.showConfirm({
        message: "Log out of MoneyFlow?",
        confirmText: "Log Out"
      });

      if (confirmed) {
        MF.logout();
      }
    });

});
