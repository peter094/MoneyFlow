
/* ============================================
   MONEYFLOW — SPENDING
   AMOLED EMERALD EDITION

   Requires core.js before spending.js
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const MF =
    typeof MoneyFlow === "undefined"
      ? null
      : MoneyFlow;

  const $ = (id) =>
    document.getElementById(id);

  if (!MF) {
    console.error(
      "Spending: core.js was not loaded."
    );
    return;
  }

  document.documentElement.classList.add("dark");

  /* ==========================================
     CURRENT DATE
     ========================================== */

  const today = () => {
    const d = new Date();

    return [
      d.getFullYear(),

      String(
        d.getMonth() + 1
      ).padStart(2, "0"),

      String(
        d.getDate()
      ).padStart(2, "0")

    ].join("-");
  };

  /* ==========================================
     PAGE STATE
     ========================================== */

  const state = {
    month: today().slice(0, 7),
    category: "all",
    query: "",
    sortIndex: 0,
    adding: false,
    saving: false
  };

  const sortOrders = [
    {
      label: "Date ↓",
      key: "newest"
    },
    {
      label: "Date ↑",
      key: "oldest"
    },
    {
      label: "Amount ↓",
      key: "highest"
    },
    {
      label: "Amount ↑",
      key: "lowest"
    }
  ];

  /* ==========================================
     CATEGORY COLOURS
     ========================================== */

  const categoryColours = {
    Food: "#39DDAA",
    Shopping: "#F5B85B",
    Transport: "#6EA8FF",
    Bills: "#FF838C",
    Health: "#B5A1FF",
    Entertainment: "#FEA2DB",
    Other: "#8091A9"
  };

  const extraColours = [
    "#41C6D7",
    "#E3A965",
    "#A7D677",
    "#CE96EC"
  ];

  // Category pictograms come from the shared MoneyFlow SVG library.
  const categoryIconMarkup = (category) =>
    window.MoneyFlowCategoryIcons?.iconElement(category)?.outerHTML || "◇";

  /* ==========================================
     INITIALIZE
     ========================================== */

  $("spendingMonthPicker").value =
    state.month;

  bindEvents();
  render();

  // Refresh when another tab changes transactions.
  MF.onExternalChange(render);

  // Refresh when returning to Spending.
  window.addEventListener(
    "pageshow",
    render
  );

  // Handle Android/browser Back navigation.
  window.addEventListener(
    "popstate",
    () => {
      if (state.adding) {
        hideAddView();
      }
    }
  );

  // Support direct links from Home.
  // Example: spending.html?add=1

  if (
    new URLSearchParams(
      location.search
    ).get("add") === "1"
  ) {
    const cleanUrl =
      new URL(location.href);

    cleanUrl.searchParams.delete("add");

    history.replaceState(
      null,
      "",
      cleanUrl.pathname + cleanUrl.search
    );

    showAddView();
  }

  /* ==========================================
     BUTTONS AND FILTERS
     ========================================== */

  function bindEvents() {

    // CALENDAR BUTTON

    $("spendingCalendarBtn")?.addEventListener(
      "click",
      () => {
        const picker =
          $("spendingMonthPicker");

        if (
          typeof picker.showPicker ===
          "function"
        ) {
          try {
            picker.showPicker();
            return;
          } catch (error) {
            // Use the normal picker as fallback.
          }
        }

        picker.focus();
        picker.click();
      }
    );

    // MONTH SELECTION

    $("spendingMonthPicker")?.addEventListener(
      "change",
      (event) => {
        const selected =
          event.target.value;

        if (
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(
            selected
          )
        ) {
          return;
        }

        state.month = selected;
        render();
      }
    );

    // SEARCH BUTTON

    $("spendingSearchBtn")?.addEventListener(
      "click",
      () => {
        const panel =
          $("spendingSearchPanel");

        panel.hidden = !panel.hidden;

        $("spendingSearchBtn").setAttribute(
          "aria-expanded",
          String(!panel.hidden)
        );

        if (panel.hidden) {
          state.query = "";

          $("spendingSearchInput").value = "";

          renderList();

        } else {
          $("spendingSearchInput").focus();
        }
      }
    );

    // SEARCH INPUT

    $("spendingSearchInput")?.addEventListener(
      "input",
      (event) => {
        state.query =
          event.target.value
            .trim()
            .toLocaleLowerCase();

        renderList();
      }
    );

    // CATEGORY CHIPS

    $("spendingCategoryFilters")?.addEventListener(
      "click",
      (event) => {
        const chip =
          event.target.closest(
            "[data-category]"
          );

        if (!chip) return;

        state.category =
          chip.dataset.category;

        updateChips();
        renderList();
      }
    );

    // SORT BUTTON

    $("spendingSortBtn")?.addEventListener(
      "click",
      () => {
        state.sortIndex =
          (
            state.sortIndex + 1
          ) % sortOrders.length;

        renderList();
      }
    );

    // ADD SPENDING BUTTONS

    [
      "spendingAddTopBtn",
      "spendingEmptyAddBtn"
    ].forEach((id) => {
      $(id)?.addEventListener(
        "click",
        showAddView
      );
    });

    // BACK FROM ADD FORM

    $("spendingBackFromAdd")?.addEventListener(
      "click",
      closeAddView
    );

    // SAVE SPENDING

    $("spendingForm")?.addEventListener(
      "submit",
      saveSpending
    );
  }

  /* ==========================================
     ADD SPENDING SCREEN
     ========================================== */

  function showAddView() {
    if (state.adding) return;

    $("spendingForm").reset();

    $("spendingDate").value =
      today();

    state.adding = true;

    $("spendingMainView").hidden = true;

    $("spendingAddView").hidden = false;

    history.pushState(
      {
        moneyflowSpendingAdd: true
      },
      "",
      "#add"
    );

    window.scrollTo(0, 0);
  }

  function hideAddView() {
    state.adding = false;

    $("spendingAddView").hidden = true;

    $("spendingMainView").hidden = false;

    window.scrollTo(0, 0);
  }

  function closeAddView() {
    if (!state.adding) return;

    hideAddView();

    if (
      history.state?.moneyflowSpendingAdd
    ) {
      history.back();
    }
  }

  /* ==========================================
     VALIDATE SPENDING DATE
     ========================================== */

  function validDate(value) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const [year, month, day] =
      value.split("-").map(Number);

    const candidate = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }

  /* ==========================================
     SAVE SPENDING
     ========================================== */

  function saveSpending(event) {
    event.preventDefault();

    if (state.saving) return;

    const name =
      $("spendingName").value.trim();

    const amount =
      Number(
        $("spendingAmount").value
      );

    const date =
      $("spendingDate").value;

    const category =
      document.querySelector(
        'input[name="spendingCategory"]:checked'
      )?.value || "Other";

    const notes =
      $("spendingNotes").value.trim();

    const input = {
      type: "expense",
      amount,
      category,
      description: name,
      date
    };

    // USE MONEYFLOW'S EXISTING VALIDATOR

    const check =
      MF.validateTransaction(input);

    if (!check.valid) {
      MF.showToast(
        check.message,
        "error"
      );

      return;
    }

    if (!validDate(date)) {
      MF.showToast(
        "Please choose a valid spending date.",
        "error"
      );

      return;
    }

    state.saving = true;

    $("spendingSaveTopBtn").disabled = true;

    $("spendingSaveBottomBtn").disabled = true;

    try {

      // CREATE ONE SHARED TRANSACTION

      const transaction = {
        ...input,

        id: MF.generateId(),

        notes,

        createdAt:
          new Date().toISOString()
      };

      const transactions =
        MF.getTransactions();

      const saved =
        MF.saveTransactions([
          ...transactions,
          transaction
        ]);

      if (!saved) {
        MF.showToast(
          "Could not save spending. Please try again.",
          "error"
        );

        return;
      }

      // DISPLAY THE MONTH OF THE NEW EXPENSE

      state.month =
        date.slice(0, 7);

      $("spendingMonthPicker").value =
        state.month;
      window.MoneyFlowMonthPicker?.refreshAll();

      // RESET FILTERS

      state.category = "all";
      state.query = "";

      $("spendingSearchInput").value = "";

      $("spendingSearchPanel").hidden = true;

      $("spendingSearchBtn").setAttribute(
        "aria-expanded",
        "false"
      );

      closeAddView();

      render();

      MF.showToast(
        "Spending saved successfully."
      );

    } catch (error) {
      console.error(
        "Spending save error:",
        error
      );

      MF.showToast(
        "Unable to save spending.",
        "error"
      );

    } finally {
      state.saving = false;

      $("spendingSaveTopBtn").disabled = false;

      $("spendingSaveBottomBtn").disabled = false;
    }
  }

  /* ==========================================
     GET EXPENSES FOR A MONTH
     ========================================== */

  function monthExpenses(month) {
    return MF.getTransactions().filter(
      (item) =>
        item?.type === "expense" &&
        typeof item.date === "string" &&
        item.date.startsWith(month) &&
        Number.isFinite(
          Number(item.amount)
        ) &&
        Number(item.amount) > 0
    );
  }

  function monthBefore(month) {
    const [year, number] =
      month.split("-").map(Number);

    const date = new Date(
      year,
      number - 2,
      1
    );

    return (
      date.getFullYear() +
      "-" +
      String(
        date.getMonth() + 1
      ).padStart(2, "0")
    );
  }

  /* ==========================================
     UPDATE SPENDING OVERVIEW
     ========================================== */

  function render() {
    const entries =
      monthExpenses(state.month);

    const total =
      entries.reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );

    const previous =
      monthExpenses(
        monthBefore(state.month)
      ).reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );

    const [year, month] =
      state.month.split("-").map(Number);

    const selectedStart =
      new Date(
        year,
        month - 1,
        1
      );

    const current =
      new Date();

    const currentStart =
      new Date(
        current.getFullYear(),
        current.getMonth(),
        1
      );

    const daysInMonth =
      new Date(
        year,
        month,
        0
      ).getDate();

    // USE ELAPSED DAYS FOR THE CURRENT MONTH.
    // USE ALL DAYS FOR COMPLETED MONTHS.

    const elapsedDays =
      selectedStart > currentStart
        ? 0
        : selectedStart.getTime() ===
          currentStart.getTime()
          ? current.getDate()
          : daysInMonth;

    setText(
      "spendingOverviewMonth",
      selectedStart.toLocaleDateString(
        "en-GB",
        {
          month: "short",
          year: "numeric"
        }
      )
    );

    setText(
      "spendingTotalAmount",
      MF.formatCurrency(total)
    );

    setText(
      "spendingTotalStat",
      MF.formatCurrency(total)
    );

    setText(
      "spendingTransactionCount",
      entries.length
    );

    setText(
      "spendingDailyAverage",
      MF.formatCurrency(
        elapsedDays
          ? total / elapsedDays
          : 0
      )
    );

    // COMPARE WITH PREVIOUS MONTH

    let comparison =
      "No spending last month to compare";

    if (previous > 0) {
      const change =
        (
          (total - previous) /
          previous
        ) * 100;

      comparison =
        Math.abs(change) < 0.05
          ? "Same spending as last month"
          : (
              `${Math.abs(change).toFixed(1)}% ` +
              `${change > 0 ? "more" : "less"} ` +
              "than last month"
            );

    } else if (total > 0) {
      comparison =
        "New spending compared with last month";
    }

    setText(
      "spendingComparisonText",
      comparison
    );

    renderChart(entries, total);
    renderFilters(entries);
    renderList();
  }

  /* ==========================================
     CATEGORY DONUT CHART
     ========================================== */

  function renderChart(entries, total) {
    const totals = new Map();

    entries.forEach((item) => {
      const category =
        String(
          item.category || "Other"
        );

      totals.set(
        category,
        (
          totals.get(category) || 0
        ) + Number(item.amount)
      );
    });

    const categories =
      [...totals.entries()].sort(
        (a, b) => b[1] - a[1]
      );

    const chart =
      $("spendingDonutChart");

    const legend =
      $("spendingCategoryLegend");

    setText(
      "spendingCategoryCount",
      `${categories.length} ${
        categories.length === 1
          ? "category"
          : "categories"
      }`
    );

    setText(
      "spendingChartTotal",
      MF.formatShortCurrency(total)
    );

    // EMPTY CHART

    if (
      !total ||
      !categories.length
    ) {
      chart.style.background =
        "#2a2c38";

      chart.setAttribute(
        "aria-label",
        "No spending to display"
      );

      legend.innerHTML = `
        <p class="spending-chart-placeholder">
          Add spending to see your breakdown.
        </p>
      `;

      return;
    }

    const slices = [];
    const rows = [];

    let position = 0;

    categories.forEach(
      ([category, amount], index) => {

        const colour =
          categoryColours[category] ||
          extraColours[
            index % extraColours.length
          ];

        const start = position;

        position +=
          (amount / total) * 100;

        // BUILD ONE DONUT SEGMENT

        slices.push(
          `${colour} ` +
          `${start.toFixed(4)}% ` +
          `${
            Math.min(
              position,
              100
            ).toFixed(4)
          }%`
        );

        // BUILD LEGEND ROW

        const percentage =
          (
            (amount / total) * 100
          ).toFixed(0);

        rows.push(`
          <div class="spending-legend-item">

            <span
              class="spending-legend-dot"
              style="background:${colour}"
            ></span>

            <span class="spending-legend-label">
              ${MF.escapeHTML(category)}
            </span>

            <strong class="spending-legend-value">
              ${percentage}%
            </strong>

          </div>
        `);
      }
    );

    chart.style.background =
      `conic-gradient(${slices.join(", ")})`;

    chart.setAttribute(
      "aria-label",
      "Spending breakdown: " +
      categories.map(
        ([category, amount]) =>
          `${category}: ${
            MF.formatCurrency(amount)
          }`
      ).join(", ")
    );

    legend.innerHTML =
      rows.join("");
  }

  /* ==========================================
     CATEGORY FILTERS
     ========================================== */

  function renderFilters(entries) {
    const container =
      $("spendingCategoryFilters");

    const existing = new Set(
      [
        ...container.querySelectorAll(
          "[data-category]"
        )
      ].map(
        (element) =>
          element.dataset.category
      )
    );

    // ADD LEGACY OR CUSTOM CATEGORIES
    // IF THEY EXIST IN SAVED TRANSACTIONS

    entries.forEach((item) => {
      const category =
        String(
          item.category || "Other"
        );

      if (
        existing.has(category)
      ) {
        return;
      }

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "spending-filter-chip";

      button.dataset.category =
        category;

      button.setAttribute(
        "aria-pressed",
        "false"
      );

      const symbol = window.MoneyFlowCategoryIcons
        ? window.MoneyFlowCategoryIcons.iconElement(category)
        : document.createElement("span");

      if (!window.MoneyFlowCategoryIcons) {
        symbol.textContent = "◇";
      }

      button.append(
        symbol,
        document.createTextNode(
          " " + category
        )
      );

      container.append(button);

      existing.add(category);
    });

    updateChips();
  }

  function updateChips() {
    document.querySelectorAll(
      ".spending-filter-chip"
    ).forEach((chip) => {

      const active =
        chip.dataset.category ===
        state.category;

      chip.classList.toggle(
        "active",
        active
      );

      chip.setAttribute(
        "aria-pressed",
        String(active)
      );
    });
  }

  /* ==========================================
     SPENDING TRANSACTION LIST
     ========================================== */

  function renderList() {
    let entries =
      monthExpenses(state.month);

    // CATEGORY FILTER

    if (
      state.category !== "all"
    ) {
      entries = entries.filter(
        (item) =>
          (
            item.category || "Other"
          ) === state.category
      );
    }

    // SEARCH FILTER

    if (state.query) {
      entries = entries.filter(
        (item) =>
          [
            item.description,
            item.category,
            item.notes
          ].some(
            (field) =>
              String(field || "")
                .toLocaleLowerCase()
                .includes(state.query)
          )
      );
    }

    // SORT THE RESULTS

    switch (
      sortOrders[
        state.sortIndex
      ].key
    ) {

      case "oldest":
        entries.sort(
          (a, b) =>
            String(a.date)
              .localeCompare(
                String(b.date)
              )
        );
        break;

      case "highest":
        entries.sort(
          (a, b) =>
            Number(b.amount) -
            Number(a.amount)
        );
        break;

      case "lowest":
        entries.sort(
          (a, b) =>
            Number(a.amount) -
            Number(b.amount)
        );
        break;

      default:
        entries.sort(
          (a, b) =>
            String(b.date)
              .localeCompare(
                String(a.date)
              )
        );
    }

    setText(
      "spendingSortBtn",
      sortOrders[
        state.sortIndex
      ].label
    );

    setText(
      "spendingEntriesCount",
      `${entries.length} ${
        entries.length === 1
          ? "entry"
          : "entries"
      }`
    );

    // DISPLAY THE TRANSACTIONS

    $("spendingTransactionsList").innerHTML =
      entries.map(
        (item) => {

          const category =
            String(
              item.category || "Other"
            );

          const icon = categoryIconMarkup(category);

          const name =
            MF.escapeHTML(
              item.description ||
              "Spending"
            );

          const safeCategory =
            MF.escapeHTML(category);

          const date =
            MF.escapeHTML(
              MF.formatDate(item.date)
            );

          return `
            <article class="spending-entry">

              <div
                class="spending-entry-icon"
                aria-hidden="true"
              >
                ${icon}
              </div>

              <div class="spending-entry-copy">

                <strong>
                  ${name}
                </strong>

                <span>
                  ${safeCategory} · ${date}
                </span>

              </div>

              <strong class="spending-entry-amount">
                −${MF.formatCurrency(item.amount)}
              </strong>

              <a class="mf-receipt-link" href="receipt.html?type=expense&amp;id=${encodeURIComponent(String(item.id))}"
                 aria-label="View spending receipt" title="Receipt">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8h6M9 12h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
              </a>

            </article>
          `;
        }
      ).join("");

    // EMPTY STATE

    const filtered =
      state.category !== "all" ||
      Boolean(state.query);

    $("spendingEmptyState").hidden =
      entries.length > 0;

    $("spendingEmptyAddBtn").hidden =
      Boolean(filtered);

    setText(
      "spendingEmptyTitle",
      filtered
        ? "No matching spending"
        : "No spending logged this month"
    );

    setText(
      "spendingEmptyDescription",
      filtered
        ? "Try another category or search term."
        : "Add your first expense to start understanding your spending habits."
    );
  }

  /* ==========================================
     SAFE TEXT HELPER
     ========================================== */

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent =
        String(value);
    }
  }

});
