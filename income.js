
/* =============================================
   MONEYFLOW — INCOME PAGE
   Requires core.js, uses shared transactions
   ============================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const MF = typeof MoneyFlow !== "undefined" ? MoneyFlow : null;
  const $ = (id) => document.getElementById(id);
  const REPEAT_KEY = "moneyflow_income_repeat_rules";

  const state = {
    month: localMonth(new Date()),
    category: "all",
    query: "",
    sort: 0,
    adding: false,
    saving: false
  };

  if (!MF) {
    console.error("Income: core.js was not loaded.");
    return;
  }

  const sortOptions = [
    { label: "Sort · Date ↓", key: "newest" },
    { label: "Sort · Date ↑", key: "oldest" },
    { label: "Sort · Amount ↓", key: "highest" },
    { label: "Sort · Amount ↑", key: "lowest" }
  ];

  initialize();

  function initialize() {
    const picker = $("incomeMonthPicker");
    if (picker) picker.value = state.month;

    bindEvents();
    syncRepeats();
    render();

    MF.onExternalChange(() => {
      syncRepeats();
      render();
    });

    window.addEventListener("pageshow", () => {
      syncRepeats();
      render();
    });

    window.addEventListener("popstate", () => {
      if (state.adding) hideAddView();
    });

    if (new URLSearchParams(location.search).get("add") === "1") {
      showAddView();
    }
  }

  /* =====================================
     BUTTON EVENTS
  ===================================== */

  function bindEvents() {

    // MONTH PICKER

    $("incomeMonthPicker")?.addEventListener("change", (event) => {
      const value = event.target.value;

      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;

      state.month = value;
      render();
    });

    $("incomeCalendarBtn")?.addEventListener("click", () => {
      const picker = $("incomeMonthPicker");
      if (!picker) return;

      if (typeof picker.showPicker === "function") {
        try {
          picker.showPicker();
          return;
        } catch (error) {
          // Some Android webviews use the normal input control.
        }
      }

      picker.focus();
      picker.click();
    });

    // SEARCH

    $("incomeSearchBtn")?.addEventListener("click", () => {
      const panel = $("incomeSearchPanel");
      if (!panel) return;

      panel.hidden = !panel.hidden;

      $("incomeSearchBtn").setAttribute(
        "aria-expanded",
        String(!panel.hidden)
      );

      if (!panel.hidden) {
        $("incomeSearchInput")?.focus();
      } else {
        const search = $("incomeSearchInput");

        if (search) search.value = "";

        state.query = "";
        renderList();
      }
    });

    $("incomeSearchInput")?.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      renderList();
    });

    // CATEGORY FILTERS

    $("incomeCategoryFilters")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;

      state.category = button.dataset.category;

      document.querySelectorAll(".income-filter-chip").forEach((chip) => {
        const active = chip === button;

        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      renderList();
    });

    // SORTING

    $("incomeSortBtn")?.addEventListener("click", () => {
      state.sort = (state.sort + 1) % sortOptions.length;

      $("incomeSortBtn").textContent =
        sortOptions[state.sort].label;

      renderList();
    });

    // ADD INCOME

    ["incomeAddTopBtn", "incomeEmptyAddBtn"].forEach((id) => {
      $(id)?.addEventListener("click", showAddView);
    });

    $("incomeBackFromAdd")?.addEventListener(
      "click",
      closeAddView
    );

    $("incomeForm")?.addEventListener("submit", saveIncome);
  }

  /* =====================================
     ADD INCOME SCREEN
  ===================================== */

  function showAddView() {
    if (state.adding) return;

    const form = $("incomeForm");
    form?.reset();

    if ($("incomeDate")) {
      $("incomeDate").value = localDate(new Date());
    }

    $("incomeMainView").hidden = true;
    $("incomeAddView").hidden = false;

    state.adding = true;

    history.pushState(
      { moneyflowIncomeAdd: true },
      "",
      location.href
    );

    window.scrollTo(0, 0);
  }

  function hideAddView() {
    state.adding = false;

    $("incomeAddView").hidden = true;
    $("incomeMainView").hidden = false;

    window.scrollTo(0, 0);
  }

  function closeAddView() {
    if (!state.adding) return;

    hideAddView();

    if (history.state?.moneyflowIncomeAdd) {
      history.back();
    }
  }

  /* =====================================
     SAVE INCOME
  ===================================== */

  function saveIncome(event) {
    event.preventDefault();

    if (state.saving) return;

    const name = $("incomeName").value.trim();
    const amount = Number($("incomeAmount").value);
    const date = $("incomeDate").value;

    const category = document.querySelector(
      'input[name="incomeCategory"]:checked'
    )?.value || "Other";

    const repeat = document.querySelector(
      'input[name="incomeRepeat"]:checked'
    )?.value || "none";

    const notes = $("incomeNotes").value.trim();

    const payload = {
      type: "income",
      amount,
      category,
      description: name,
      date
    };

    const validation = MF.validateTransaction(payload);

    if (!validation.valid) {
      MF.showToast(validation.message, "error");
      return;
    }

    if (
      !isDate(date) ||
      !["none", "weekly", "monthly", "yearly"].includes(repeat)
    ) {
      MF.showToast(
        "Choose a valid date and repeat option.",
        "error"
      );
      return;
    }

    state.saving = true;

    const button = $("incomeSaveTopBtn");
    if (button) button.disabled = true;

    try {
      const transaction = {
        ...payload,
        id: MF.generateId(),
        notes,
        repeat,
        createdAt: new Date().toISOString()
      };

      const transactions = MF.getTransactions();

      if (!MF.saveTransactions([...transactions, transaction])) {
        MF.showToast(
          "Could not save income. Try again.",
          "error"
        );
        return;
      }

      // SAVE RECURRING INCOME SCHEDULE

      if (repeat !== "none") {
        const rule = {
          id: MF.generateId(),
          startDate: date,
          lastIndex: 0,
          repeat,
          name,
          amount,
          category,
          notes
        };

        const rules = getRepeatRules();

        if (saveRepeatRules([...rules, rule])) {
          syncRepeats();
        } else {
          MF.showToast(
            "Income saved, but the repeat schedule could not be saved safely.",
            "error"
          );
        }
      }

      // SHOW THE MONTH CONTAINING THE SAVED INCOME

      state.month = date.slice(0, 7);

      if ($("incomeMonthPicker")) {
        $("incomeMonthPicker").value = state.month;
        window.MoneyFlowMonthPicker?.refreshAll();
      }

      state.category = "all";
      state.query = "";

      if ($("incomeSearchInput")) {
        $("incomeSearchInput").value = "";
      }

      $("incomeSearchPanel").hidden = true;

      $("incomeSearchBtn").setAttribute(
        "aria-expanded",
        "false"
      );

      document.querySelectorAll(".income-filter-chip").forEach((chip) => {
        const active = chip.dataset.category === "all";

        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      closeAddView();

      render();

      MF.showToast("Income saved successfully.");

    } catch (error) {
      console.error("Income save failed:", error);

      MF.showToast(
        "Unable to save income.",
        "error"
      );

    } finally {
      state.saving = false;

      if (button) button.disabled = false;
    }
  }

  /* =====================================
     RECURRING INCOME
  ===================================== */

  function getRepeatRules() {
    try {
      const data = JSON.parse(
        localStorage.getItem(REPEAT_KEY) || "[]"
      );

      if (!Array.isArray(data)) {
        throw new Error("Repeat schedules are not a valid list.");
      }
      return data;

    } catch (error) {
      console.error(
        "Income repeat rules could not be read:",
        error
      );

      return [];
    }
  }

  function saveRepeatRules(rules) {
    if (!Array.isArray(rules)) return false;
    try {
      const raw = localStorage.getItem(REPEAT_KEY);
      if (raw !== null && !Array.isArray(JSON.parse(raw))) {
        throw new Error("Existing repeat rules are not a valid list.");
      }
      localStorage.setItem(REPEAT_KEY, JSON.stringify(rules));
      return true;
    } catch (error) {
      console.error("Income repeat schedule was not saved; old data preserved:", error);
      return false;
    }
  }

  function syncRepeats() {
    const rules = getRepeatRules();

    if (!rules.length) return;

    const today = localDate(new Date());

    const transactions = MF.getTransactions();

    const existing = new Set(
      transactions.map((t) => String(t.id))
    );

    let dirty = false;

    rules.forEach((rule) => {
      if (
        !rule ||
        !isDate(rule.startDate) ||
        !["weekly", "monthly", "yearly"].includes(rule.repeat)
      ) {
        return;
      }

      let index = Number(rule.lastIndex) || 0;
      let generated = 0;

      while (generated < 500) {
        const nextIndex = index + 1;

        const nextDate = occurrenceDate(
          rule.startDate,
          rule.repeat,
          nextIndex
        );

        if (!nextDate || nextDate > today) break;

        const id = `income-repeat-${rule.id}-${nextIndex}`;

        if (!existing.has(id)) {
          transactions.push({
            id,
            type: "income",
            amount: Number(rule.amount),
            category: rule.category,
            description: rule.name,
            date: nextDate,
            notes: rule.notes || "",
            repeat: rule.repeat,
            recurrenceId: rule.id,
            createdAt: new Date().toISOString()
          });

          existing.add(id);
          dirty = true;
        }

        index = nextIndex;
        generated++;
      }

      rule.lastIndex = index;
    });

    if (!dirty) return;

    if (MF.saveTransactions(transactions)) {
      if (!saveRepeatRules(rules)) {
        MF.showToast(
          "Recurring income rules could not be updated safely.",
          "error"
        );
      }
    } else {
      MF.showToast(
        "Could not update recurring income.",
        "error"
      );
    }
  }

  function occurrenceDate(start, repeat, index) {
    const [year, month, day] = start.split("-").map(Number);

    if (
      ![year, month, day, index].every(Number.isFinite)
    ) {
      return "";
    }

    if (repeat === "weekly") {
      const date = new Date(
        Date.UTC(year, month - 1, day + 7 * index)
      );

      return utcDate(date);
    }

    const months =
      repeat === "monthly"
        ? index
        : 12 * index;

    const first = new Date(
      Date.UTC(year, month - 1 + months, 1)
    );

    const lastDay = new Date(
      Date.UTC(
        first.getUTCFullYear(),
        first.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

    return utcDate(
      new Date(
        Date.UTC(
          first.getUTCFullYear(),
          first.getUTCMonth(),
          Math.min(day, lastDay)
        )
      )
    );
  }

  /* =====================================
     UPDATE INCOME OVERVIEW
  ===================================== */

  function render() {
    const [year, month] = state.month.split("-").map(Number);

    const monthLabel = new Date(
      year,
      month - 1,
      1
    ).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric"
    });

    text("incomeOverviewMonth", monthLabel);

    const items = incomeInMonth(state.month);

    const total = items.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );

    const priorMonth = new Date(
      year,
      month - 2,
      1
    );

    const priorKey = localMonth(priorMonth);

    const previous = incomeInMonth(priorKey).reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );

    text(
      "incomeOverviewAmount",
      MF.formatCurrency(total)
    );

    text(
      "incomeTotalStat",
      MF.formatCurrency(total)
    );

    text(
      "incomeTransactionCount",
      items.length
    );

    // DAILY AVERAGE

    const now = new Date();

    const selected = new Date(
      year,
      month - 1,
      1
    );

    const thisMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const daysInMonth = new Date(
      year,
      month,
      0
    ).getDate();

    const days =
      selected > thisMonth
        ? 0
        : selected.getTime() === thisMonth.getTime()
          ? now.getDate()
          : daysInMonth;

    text(
      "incomeDailyAverage",
      MF.formatCurrency(
        days ? total / days : 0
      )
    );

    // COMPARE WITH LAST MONTH

    if (previous <= 0) {
      text(
        "incomeComparison",
        total > 0
          ? "New income compared with last month"
          : "No income last month to compare"
      );

    } else {
      const change =
        (total - previous) / previous * 100;

      text(
        "incomeComparison",
        Math.abs(change) < 0.05
          ? "Same income as last month"
          : `${Math.abs(change).toFixed(1)}% ${
              change >= 0 ? "more" : "less"
            } than last month`
      );
    }

    renderList();
  }

  function incomeInMonth(month) {
    return MF.getTransactions().filter((t) =>
      t.type === "income" &&
      typeof t.date === "string" &&
      t.date.startsWith(month) &&
      Number.isFinite(Number(t.amount))
    );
  }

  /* =====================================
     DISPLAY INCOME TRANSACTIONS
  ===================================== */

  function renderList() {
    let items = incomeInMonth(state.month);

    // CATEGORY FILTER

    if (state.category !== "all") {
      items = items.filter(
        (t) => t.category === state.category
      );
    }

    // SEARCH

    if (state.query) {
      items = items.filter((t) =>
        [
          t.description,
          t.category,
          t.notes
        ].some((part) =>
          String(part || "")
            .toLowerCase()
            .includes(state.query)
        )
      );
    }

    // SORTING

    switch (sortOptions[state.sort].key) {
      case "oldest":
        items.sort((a, b) =>
          String(a.date).localeCompare(String(b.date))
        );
        break;

      case "highest":
        items.sort((a, b) =>
          Number(b.amount) - Number(a.amount)
        );
        break;

      case "lowest":
        items.sort((a, b) =>
          Number(a.amount) - Number(b.amount)
        );
        break;

      default:
        items.sort((a, b) =>
          String(b.date).localeCompare(String(a.date))
        );
    }

    text(
      "incomeEntriesCount",
      `${items.length} ${
        items.length === 1 ? "entry" : "entries"
      }`
    );

    const list = $("incomeTransactionsList");
    if (!list) return;

    list.innerHTML = items.map((t) => `
      <article class="income-entry">

        <span
          class="income-entry-icon"
          aria-hidden="true"
        >
          ${window.MoneyFlowCategoryIcons?.iconElement(t.category || "Other")?.outerHTML || "↗"}
        </span>

        <div class="income-entry-copy">

          <strong>
            ${MF.escapeHTML(
              String(t.description || "Income")
            )}
          </strong>

          <span>
            ${MF.escapeHTML(
              String(t.category || "Other")
            )}
            ·
            ${MF.escapeHTML(
              MF.formatDate(t.date)
            )}
          </span>

        </div>

        <strong class="income-entry-amount">
          +${MF.formatCurrency(t.amount)}
        </strong>

        <a class="mf-receipt-link" href="receipt.html?type=income&amp;id=${encodeURIComponent(String(t.id))}"
           aria-label="View income receipt" title="Receipt">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8h6M9 12h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </a>

      </article>
    `).join("");

    const empty = $("incomeEmptyState");

    if (empty) {
      empty.hidden = items.length > 0;
    }

    if (!items.length) {
      const filtered =
        state.category !== "all" ||
        state.query;

      text(
        "incomeEmptyTitle",
        filtered
          ? "No matching income"
          : "No income logged this month"
      );

      text(
        "incomeEmptyDescription",
        filtered
          ? "Try another category or search term."
          : "Add your first income to start tracking and see your overview here."
      );

      if ($("incomeEmptyAddBtn")) {
        $("incomeEmptyAddBtn").hidden =
          Boolean(filtered);
      }
    }
  }

  /* =====================================
     DATE HELPERS
  ===================================== */

  function localDate(date) {
    return [
      date.getFullYear(),
      String(
        date.getMonth() + 1
      ).padStart(2, "0"),
      String(
        date.getDate()
      ).padStart(2, "0")
    ].join("-");
  }

  function localMonth(date) {
    return localDate(date).slice(0, 7);
  }

  function utcDate(date) {
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return [
      date.getUTCFullYear(),
      String(
        date.getUTCMonth() + 1
      ).padStart(2, "0"),
      String(
        date.getUTCDate()
      ).padStart(2, "0")
    ].join("-");
  }

  function isDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] =
      value.split("-").map(Number);

    return utcDate(
      new Date(
        Date.UTC(year, month - 1, day)
      )
    ) === value;
  }

  /* =====================================
     TEXT HELPER
  ===================================== */

  function text(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = String(value);
    }
  }

});
