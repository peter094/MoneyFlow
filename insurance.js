
/* ============================================
   MONEYFLOW — INSURANCE POLICY TRACKER
   Stores policies ONLY in moneyflow_insurance.
   No changes to transactions or other records.
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const STORAGE_KEY = "moneyflow_insurance";
  const $ = (id) => document.getElementById(id);
  const overlay = $("insuranceFormOverlay");
  const sheet = overlay?.querySelector(".insurance-form-sheet");
  const form = $("insurancePolicyForm");

  const state = {
    policies: [],
    filter: "all",
    storageError: false,
    invalidEntries: 0,
    returnFocus: null,
    previousOverflow: "",
    sheetHistory: false
  };

  const currency = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  /* ============================================
     DATE HELPERS
     ============================================ */

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function validDate(value) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const [y, m, d] = value.split("-").map(Number);
    const test = new Date(Date.UTC(y, m - 1, d));

    return (
      test.getUTCFullYear() === y &&
      test.getUTCMonth() === m - 1 &&
      test.getUTCDate() === d
    );
  }

  function dayNumber(key) {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  function policyStatus(policy) {
    const days =
      dayNumber(policy.expiryDate) -
      dayNumber(dateKey(new Date()));

    if (days < 0) return "expired";
    if (days <= 30) return "expiring";
    return "active";
  }

  function dateLabel(value) {
    if (!validDate(value)) return "Not set";

    const [y, m, d] = value.split("-").map(Number);

    return new Date(y, m - 1, d).toLocaleDateString(
      "en-NG",
      {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );
  }

  function moneyOrUnset(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "Not set";
    }

    const amount = Number(value);

    return Number.isFinite(amount)
      ? currency.format(amount)
      : "Not set";
  }

  /* ============================================
     SAFE STORAGE
     ============================================ */

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) return [];

      const rows = JSON.parse(raw);

      if (!Array.isArray(rows)) {
        throw new Error(
          "Policy data is not a list"
        );
      }

      return rows;

    } catch (error) {
      console.error(
        "MoneyFlow insurance: storage read failed",
        error
      );

      return null;
    }
  }

  function isDisplayable(row) {
    return (
      row &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      (
        typeof row.id === "string" ||
        typeof row.id === "number"
      ) &&
      String(row.id).length > 0 &&
      typeof row.policyName === "string" &&
      !!row.policyName.trim() &&
      validDate(row.expiryDate)
    );
  }

  /* ============================================
     MESSAGES
     ============================================ */

  function setWarning(message) {
    const warning = $("insuranceDataWarning");

    warning.textContent = message || "";
    warning.hidden = !message;
  }

  function announce(message, error = false) {
    let note = $("insuranceActionNotice");

    if (!note) {
      note = document.createElement("p");
      note.id = "insuranceActionNotice";

      note.setAttribute("role", "status");

      note.style.cssText =
        "margin:0;padding:12px 15px;" +
        "border-radius:13px;font-size:13px;" +
        "line-height:1.5;" +
        "border:1px solid #318d70;" +
        "background:#123a30;color:#caffea";

      $("insurancePoliciesSection").before(note);
    }

    note.textContent = message;
    note.hidden = !message;

    note.style.borderColor = error
      ? "#a85c68"
      : "#318d70";

    note.style.background = error
      ? "#3d1d29"
      : "#123a30";

    note.style.color = error
      ? "#ffc3ca"
      : "#caffea";
  }

  function clearNotice() {
    const note = $("insuranceActionNotice");

    if (note) {
      note.hidden = true;
    }
  }

  /* ============================================
     LOAD AND REFRESH
     ============================================ */

  function refresh() {
    const all = readStorage();

    state.storageError = all === null;
    state.policies = all || [];

    state.invalidEntries = state.policies.filter(
      (row) => !isDisplayable(row)
    ).length;

    if (state.storageError) {
      setWarning(
        "Existing insurance data could not be read. " +
        "Adding, editing and deleting are disabled " +
        "to protect your saved information. " +
        "No data was changed."
      );

    } else if (state.invalidEntries) {
      const count = state.invalidEntries;

      setWarning(
        count +
        " saved insurance " +
        (
          count === 1
            ? "entry is"
            : "entries are"
        ) +
        " incomplete and cannot be displayed. " +
        "The original entries have been preserved."
      );

    } else {
      setWarning("");
    }

    document.querySelectorAll(
      "[data-insurance-add]"
    ).forEach((button) => {
      button.disabled = state.storageError;
    });

    render();
  }

  /* ============================================
     SAFE HTML ELEMENT BUILDERS
     ============================================ */

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined) {
      node.textContent = String(text);
    }

    return node;
  }

  function addDetail(container, label, value) {
    const item = element(
      "div",
      "insurance-policy-detail"
    );

    item.append(
      element(
        "span",
        "insurance-policy-detail-label",
        label
      ),
      element(
        "strong",
        "insurance-policy-detail-value",
        value
      )
    );

    container.appendChild(item);
  }

  function shieldIcon() {
    const svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const shield = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );

    shield.setAttribute(
      "d",
      "M12 2 20 5v6c0 5-3 9-8 11-5-2-8-6-8-11V5l8-3Z"
    );

    svg.appendChild(shield);

    return svg;
  }

  /* ============================================
     BUILD POLICY CARDS
     ============================================ */

  function createPolicyCard(policy) {
    const status = policyStatus(policy);

    const names = {
      active: "Active",
      expiring: "Expiring Soon",
      expired: "Expired"
    };

    const card = element(
      "article",
      "insurance-policy-card"
    );

    const header = element(
      "div",
      "insurance-policy-header"
    );

    const icon = element(
      "span",
      "insurance-policy-icon"
    );

    icon.appendChild(shieldIcon());

    const info = element(
      "div",
      "insurance-policy-info"
    );

    info.append(
      element(
        "h3",
        "insurance-policy-name",
        policy.policyName
      ),
      element(
        "span",
        "insurance-policy-provider",
        policy.provider ||
          "Insurance provider not set"
      )
    );

    const badge = element(
      "span",
      "insurance-policy-status " + status,
      names[status]
    );

    header.append(icon, info, badge);

    /* POLICY DETAILS */

    const details = element(
      "div",
      "insurance-policy-details"
    );

    addDetail(
      details,
      "Insurance Type",
      policy.policyType || "Other"
    );

    addDetail(
      details,
      "Expiry Date",
      dateLabel(policy.expiryDate)
    );

    addDetail(
      details,
      "Premium",
      moneyOrUnset(policy.premium)
    );

    addDetail(
      details,
      "Next Renewal",
      dateLabel(policy.renewalDate)
    );

    addDetail(
      details,
      "Coverage",
      moneyOrUnset(policy.coverageAmount)
    );

    const frequencies = {
      monthly: "Monthly",
      quarterly: "Quarterly",
      "half-yearly": "Every 6 months",
      yearly: "Yearly",
      "one-time": "One-time"
    };

    addDetail(
      details,
      "Frequency",
      frequencies[policy.premiumFrequency] ||
        "Not set"
    );

    /* EDIT BUTTON */

    const actions = element(
      "div",
      "insurance-policy-actions"
    );

    const edit = element(
      "button",
      "insurance-edit-btn",
      "Edit Policy"
    );

    edit.type = "button";

    edit.setAttribute(
      "aria-label",
      "Edit " + policy.policyName
    );

    edit.addEventListener(
      "click",
      () => openForm(String(policy.id))
    );

    actions.appendChild(edit);

    card.append(
      header,
      details,
      actions
    );

    return card;
  }

  /* ============================================
     RENDER OVERVIEW, FILTERS AND LIST
     ============================================ */

  function render() {
    const valid = state.policies.filter(
      isDisplayable
    );

    const statuses = {
      active: 0,
      expiring: 0,
      expired: 0
    };

    valid.forEach((policy) => {
      statuses[policyStatus(policy)] += 1;
    });

    const total = state.storageError
      ? "—"
      : String(valid.length);

    $("insuranceTotalPolicies").textContent =
      total;

    $("insuranceActiveCount").textContent =
      state.storageError
        ? "—"
        : String(statuses.active);

    $("insuranceExpiringCount").textContent =
      state.storageError
        ? "—"
        : String(statuses.expiring);

    $("insuranceExpiredCount").textContent =
      state.storageError
        ? "—"
        : String(statuses.expired);

    $("insuranceOverviewDescription").textContent =
      state.storageError
        ? "Policy data needs attention"
        : valid.length
          ? "Your policy coverage at a glance"
          : "No policies added yet";

    /* FILTER BUTTONS */

    document.querySelectorAll(
      "[data-insurance-filter]"
    ).forEach((button) => {
      const active =
        button.dataset.insuranceFilter ===
        state.filter;

      button.classList.toggle(
        "active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    });

    const visible = valid.filter(
      (policy) =>
        state.filter === "all" ||
        policyStatus(policy) === state.filter
    );

    const list = $("insurancePolicyList");

    list.replaceChildren();

    const empty = $("insuranceEmptyState");
    const section = $("insurancePoliciesSection");
    const emptyTitle = $("insuranceEmptyTitle");
    const emptyDesc = $("insuranceEmptyDescription");
    const emptyButton = $("insuranceAddFirstBtn");

    if (state.storageError) {
      empty.hidden = true;
      section.hidden = true;
      return;
    }

    /* DISPLAY POLICY CARDS */

    if (visible.length) {
      const fragment =
        document.createDocumentFragment();

      visible.forEach((policy) => {
        fragment.appendChild(
          createPolicyCard(policy)
        );
      });

      list.appendChild(fragment);

      $("insuranceVisibleCount").textContent =
        visible.length +
        (
          visible.length === 1
            ? " policy"
            : " policies"
        );

      section.hidden = false;
      empty.hidden = true;

    } else {
      /* DISPLAY EMPTY STATE */

      section.hidden = true;
      empty.hidden = false;

      emptyButton.innerHTML =
        "<span aria-hidden='true'>+</span> " +
        "Add Insurance Policy";

      if (!valid.length) {
        emptyTitle.textContent =
          state.invalidEntries
            ? "No readable policies yet"
            : "No policies yet";

        emptyDesc.textContent =
          state.invalidEntries
            ? "Some saved entries need attention. " +
              "You can still add a new policy; " +
              "existing entries are preserved."
            : "Add your insurance policies " +
              "to keep track of premiums, " +
              "due dates, and coverage details.";

        emptyButton.innerHTML =
          "<span aria-hidden='true'>+</span> " +
          "Add Your First Policy";

      } else {
        const filterTitles = {
          active: "No active policies",
          expiring: "Nothing expiring soon",
          expired: "No expired policies"
        };

        emptyTitle.textContent =
          filterTitles[state.filter] ||
          "No policies found";

        emptyDesc.textContent =
          "There are no policies in this category. " +
          "Choose All to see your other policies.";
      }
    }
  }

  /* ============================================
     ADD / EDIT FORM
     ============================================ */

  function formFeedback(message) {
    $("insuranceFormFeedback").textContent =
      message || "";
  }

  function assignValue(id, value) {
    $(id).value =
      value === null ||
      value === undefined
        ? ""
        : String(value);
  }

  function openForm(id = "") {
    if (
      state.storageError ||
      !overlay ||
      !form
    ) {
      return;
    }

    /* RECHECK SAVED DATA BEFORE EDITING */

    const current = readStorage();

    if (current === null) {
      refresh();
      return;
    }

    const policy = id
      ? current.find(
          (row) =>
            isDisplayable(row) &&
            String(row.id) === id
        )
      : null;

    if (id && !policy) {
      announce(
        "This policy is no longer available. " +
        "Refresh the page.",
        true
      );

      refresh();
      return;
    }

    clearNotice();

    form.reset();
    formFeedback("");

    assignValue(
      "insuranceEditingId",
      id
    );

    assignValue(
      "insurancePolicyName",
      policy?.policyName
    );

    assignValue(
      "insuranceProvider",
      policy?.provider
    );

    assignValue(
      "insurancePolicyType",
      policy?.policyType || "Health"
    );

    assignValue(
      "insurancePolicyNumber",
      policy?.policyNumber
    );

    assignValue(
      "insuranceCoverageAmount",
      policy?.coverageAmount
    );

    assignValue(
      "insurancePremium",
      policy?.premium
    );

    assignValue(
      "insurancePremiumFrequency",
      policy?.premiumFrequency || "yearly"
    );

    assignValue(
      "insuranceStartDate",
      policy?.startDate
    );

    assignValue(
      "insuranceExpiryDate",
      policy?.expiryDate
    );

    assignValue(
      "insuranceRenewalDate",
      policy?.renewalDate
    );

    assignValue(
      "insuranceNotes",
      policy?.notes
    );

    $("insuranceFormTitle").textContent =
      id
        ? "Edit Insurance Policy"
        : "Add Insurance Policy";

    $("insuranceSavePolicyBtn").textContent =
      id
        ? "Save Changes"
        : "Save Policy";

    $("insuranceDeletePolicyBtn").hidden =
      !id;

    /* SHOW FORM */

    state.returnFocus =
      document.activeElement;

    state.previousOverflow =
      document.body.style.overflow;

    overlay.hidden = false;

    document.body.style.overflow =
      "hidden";

    /* SUPPORT ANDROID BACK BUTTON */

    try {
      history.pushState(
        {
          moneyflowInsuranceForm: true
        },
        "",
        location.href
      );

      state.sheetHistory = true;

    } catch (error) {
      state.sheetHistory = false;
    }

    sheet?.focus();
  }

  function closeForm(fromBack = false) {
    if (
      !overlay ||
      overlay.hidden
    ) {
      return;
    }

    overlay.hidden = true;

    document.body.style.overflow =
      state.previousOverflow;

    if (
      state.returnFocus?.isConnected
    ) {
      state.returnFocus.focus();
    }

    state.returnFocus = null;

    const needBack =
      state.sheetHistory &&
      !fromBack &&
      history.state?.moneyflowInsuranceForm ===
        true;

    state.sheetHistory = false;

    if (needBack) {
      history.back();
    }
  }

  /* ============================================
     AMOUNT VALIDATION
     ============================================ */

  function optionalMoney(id) {
    const text = $(id).value.trim();

    if (!text) return null;

    const amount = Number(text);

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 999999999999999
    ) {
      throw new Error(
        "Enter a valid non-negative amount."
      );
    }

    return Math.round(
      amount * 100
    ) / 100;
  }

  /* ============================================
     COLLECT AND VALIDATE FORM
     ============================================ */

  function formData() {
    const policyName =
      $("insurancePolicyName").value.trim();

    const provider =
      $("insuranceProvider").value.trim();

    const expiryDate =
      $("insuranceExpiryDate").value;

    const startDate =
      $("insuranceStartDate").value;

    const renewalDate =
      $("insuranceRenewalDate").value;

    if (
      !policyName ||
      !provider
    ) {
      throw new Error(
        "Enter the policy name and insurance provider."
      );
    }

    if (!validDate(expiryDate)) {
      throw new Error(
        "Choose a valid policy expiry date."
      );
    }

    if (
      startDate &&
      !validDate(startDate)
    ) {
      throw new Error(
        "Choose a valid start date."
      );
    }

    if (
      renewalDate &&
      !validDate(renewalDate)
    ) {
      throw new Error(
        "Choose a valid renewal date."
      );
    }

    if (
      startDate &&
      startDate > expiryDate
    ) {
      throw new Error(
        "The start date must not be after the expiry date."
      );
    }

    if (
      renewalDate &&
      startDate &&
      renewalDate < startDate
    ) {
      throw new Error(
        "The renewal date must not be before the policy starts."
      );
    }

    return {
      policyName,
      provider,

      policyType:
        $("insurancePolicyType").value,

      policyNumber:
        $("insurancePolicyNumber").value.trim(),

      coverageAmount:
        optionalMoney("insuranceCoverageAmount"),

      premium:
        optionalMoney("insurancePremium"),

      premiumFrequency:
        $("insurancePremiumFrequency").value,

      startDate,
      expiryDate,
      renewalDate,

      notes:
        $("insuranceNotes").value.trim()
    };
  }

  /* ============================================
     UNIQUE POLICY IDS
     ============================================ */

  function newId(rows) {
    let id;

    do {
      id =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : (
              "policy-" +
              Date.now() +
              "-" +
              Math.random().toString(36).slice(2)
            );

    } while (
      rows.some(
        (row) =>
          row &&
          String(row.id) === id
      )
    );

    return id;
  }

  /* ============================================
     SAVE POLICY
     ============================================ */

  form?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      formFeedback("");

      try {
        const fields = formData();

        /* ALWAYS RE-READ BEFORE WRITING */

        const rows = readStorage();

        if (rows === null) {
          throw new Error(
            "Saved insurance data could not be read. " +
            "No changes were made."
          );
        }

        const editId =
          $("insuranceEditingId").value;

        const timestamp =
          new Date().toISOString();

        let message;

        if (editId) {
          const index = rows.findIndex(
            (row) =>
              isDisplayable(row) &&
              String(row.id) === editId
          );

          if (index === -1) {
            throw new Error(
              "This policy could not be found. " +
              "No changes were made."
            );
          }

          rows[index] = {
            ...rows[index],
            ...fields,
            updatedAt: timestamp
          };

          message =
            "Insurance policy updated successfully.";

        } else {
          rows.push({
            id: newId(rows),
            ...fields,
            createdAt: timestamp,
            updatedAt: timestamp
          });

          message =
            "Insurance policy saved successfully.";
        }

        /* WRITE ONLY INSURANCE RECORDS */

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(rows)
        );

        closeForm();
        refresh();
        announce(message);

      } catch (error) {
        console.error(
          "MoneyFlow insurance: save failed",
          error
        );

        formFeedback(
          error.message ||
          "Unable to save policy. " +
          "Your existing data is unchanged."
        );
      }
    }
  );

  /* ============================================
     DELETE POLICY WITH CONFIRMATION
     ============================================ */

  $("insuranceDeletePolicyBtn")
    ?.addEventListener(
      "click",
      () => {
        const id =
          $("insuranceEditingId").value;

        if (!id) return;

        const confirmed = window.confirm(
          "Delete this insurance policy? " +
          "This action cannot be undone."
        );

        if (!confirmed) return;

        try {
          const rows = readStorage();

          if (rows === null) {
            throw new Error(
              "Saved insurance data could not be read. " +
              "Nothing was deleted."
            );
          }

          const index = rows.findIndex(
            (row) =>
              isDisplayable(row) &&
              String(row.id) === id
          );

          if (index === -1) {
            throw new Error(
              "Policy not found. " +
              "Nothing was deleted."
            );
          }

          rows.splice(index, 1);

          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(rows)
          );

          closeForm();
          refresh();

          announce(
            "Insurance policy deleted."
          );

        } catch (error) {
          console.error(
            "MoneyFlow insurance: delete failed",
            error
          );

          formFeedback(
            error.message ||
            "Could not delete this policy."
          );
        }
      }
    );

  /* ============================================
     OPEN FORM BUTTONS
     ============================================ */

  document.querySelectorAll(
    "[data-insurance-add]"
  ).forEach((button) => {
    button.addEventListener(
      "click",
      () => openForm()
    );
  });

  /* ============================================
     FILTER BUTTONS
     ============================================ */

  document.querySelectorAll(
    "[data-insurance-filter]"
  ).forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        state.filter =
          button.dataset.insuranceFilter;

        clearNotice();
        render();
      }
    );
  });

  /* ============================================
     CLOSE FORM
     ============================================ */

  $("insuranceCloseFormBtn")
    ?.addEventListener(
      "click",
      () => closeForm()
    );

  $("insuranceCancelFormBtn")
    ?.addEventListener(
      "click",
      () => closeForm()
    );

  overlay?.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeForm();
      }
    }
  );

  /* ============================================
     KEYBOARD ACCESSIBILITY
     ============================================ */

  document.addEventListener(
    "keydown",
    (event) => {
      if (!overlay || overlay.hidden) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeForm();
        return;
      }

      if (event.key !== "Tab" || !sheet) {
        return;
      }

      const fields = Array.from(
        sheet.querySelectorAll(
          "button:not([disabled]):not([hidden]), " +
          "input:not([disabled]):not([type=hidden]), " +
          "select:not([disabled]), " +
          "textarea:not([disabled])"
        )
      ).filter(
        (node) => node.offsetParent !== null
      );

      if (!fields.length) return;

      const first = fields[0];
      const last = fields[fields.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();

      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  );

  /* ============================================
     ANDROID BACK BUTTON
     ============================================ */

  window.addEventListener(
    "popstate",
    () => {
      if (
        overlay &&
        !overlay.hidden
      ) {
        closeForm(true);
      }
    }
  );

  /* ============================================
     REFRESH STORED POLICIES
     ============================================ */

  window.addEventListener(
    "pageshow",
    refresh
  );

  window.addEventListener(
    "focus",
    refresh
  );

  window.addEventListener(
    "storage",
    (event) => {
      if (
        !event.key ||
        event.key === STORAGE_KEY
      ) {
        refresh();
      }
    }
  );

  /* ============================================
     INITIAL LOAD
     ============================================ */

  refresh();

});
