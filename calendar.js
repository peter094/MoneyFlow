
/* MONEYFLOW CALENDAR — READ-ONLY FINANCIAL TIMELINE
   Uses existing MoneyFlow storage.
   Does not edit financial records.

   Requires:
   calendar.html
   calendar.css
   core.js
*/

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const now = new Date();

  const state = {
    year: now.getFullYear(),
    month: now.getMonth(),
    selected: dateKey(now),
    events: [],
    errors: [],
    hasSheetHistory: false,
    previousFocus: null,
    oldOverflow: "",
    nextPage: null
  };

  const TYPES = {
    payments: {
      label: "Payments",
      symbol: "▣",
      color: "#a18cff"
    },
    income: {
      label: "Income",
      symbol: "↗",
      color: "#35d99f"
    },
    spending: {
      label: "Spending",
      symbol: "↘",
      color: "#f4ac3f"
    },
    debts: {
      label: "Debts",
      symbol: "⇄",
      color: "#ff737e"
    },
    insurance: {
      label: "Insurance",
      symbol: "◇",
      color: "#62acff"
    }
  };

  const formatMoney = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  /* ==========================================
     DATE HELPERS
     ========================================== */

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function validDate(raw) {
    if (typeof raw !== "string") return "";

    const date = raw.slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return "";
    }

    const [y, m, d] = date.split("-").map(Number);

    const test = new Date(
      Date.UTC(y, m - 1, d)
    );

    return (
      test.getUTCFullYear() === y &&
      test.getUTCMonth() === m - 1 &&
      test.getUTCDate() === d
    ) ? date : "";
  }

  function positiveAmount(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0
      ? number
      : 0;
  }

  /* ==========================================
     SAFE STORAGE READERS
     ========================================== */

  function readList(key, title) {
    try {
      const raw = localStorage.getItem(key);

      if (raw === null) return [];

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        throw new Error(
          "Expected a list of records"
        );
      }

      return parsed;

    } catch (error) {
      console.error(
        "Calendar could not read " + key,
        error
      );

      state.errors.push(
        title + " records could not be read"
      );

      return [];
    }
  }

  function readBudget() {
    try {
      const raw = localStorage.getItem(
        "moneyflow_settings"
      );

      if (raw === null) return 0;

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Invalid settings data");
      }

      const value = Number(
        parsed.monthlyBudget ?? 0
      );

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        throw new Error(
          "Invalid monthly budget"
        );
      }

      return value;

    } catch (error) {
      console.error(
        "Calendar could not read budget",
        error
      );

      state.errors.push(
        "Budget settings could not be read"
      );

      return null;
    }
  }

  function titleText(value, fallback) {
    return (
      typeof value === "string" &&
      value.trim()
    )
      ? value.trim().slice(0, 110)
      : fallback;
  }

  /* ==========================================
     BUILD CALENDAR EVENTS
     ========================================== */

  function addEvent(
    list,
    date,
    type,
    title,
    amount,
    detail
  ) {
    const key = validDate(date);

    if (!key) return;

    list.push({
      date: key,
      type,
      title,
      amount: positiveAmount(amount),
      detail
    });
  }

  function gatherEvents(
    transactions,
    payments,
    debts,
    insurance
  ) {
    const list = [];

    /* INCOME AND SPENDING */

    for (const row of transactions) {
      if (
        !row ||
        typeof row !== "object"
      ) continue;

      if (
        row.type !== "income" &&
        row.type !== "expense"
      ) continue;

      const type = row.type === "income"
        ? "income"
        : "spending";

      addEvent(
        list,
        row.date,
        type,
        titleText(
          row.description,
          type === "income"
            ? "Income received"
            : "Expense"
        ),
        row.amount,
        titleText(
          row.category,
          TYPES[type].label
        )
      );
    }

    /* PAYMENTS */

    for (const row of payments) {
      if (
        !row ||
        typeof row !== "object"
      ) continue;

      const title = titleText(
        row.title,
        "Payment"
      );

      const dueDate = validDate(
        row.dueDate
      );

      const paidDate = row.status === "paid"
        ? validDate(row.paidDate)
        : "";

      if (dueDate) {
        addEvent(
          list,
          dueDate,
          "payments",
          title,
          row.amount,
          row.status === "paid"
            ? "Payment due date · marked paid"
            : "Payment due"
        );
      }

      if (
        paidDate &&
        paidDate !== dueDate
      ) {
        addEvent(
          list,
          paidDate,
          "payments",
          title,
          row.amount,
          "Paid on this date"
        );
      }
    }

    /* DEBTS AND REPAYMENTS */

    for (const row of debts) {
      if (
        !row ||
        typeof row !== "object"
      ) continue;

      const who = titleText(
        row.person,
        "someone"
      );

      const isBorrowed =
        row.type === "borrowed";

      const principal = positiveAmount(
        row.amount
      );

      const repayments = Array.isArray(
        row.repayments
      )
        ? row.repayments
        : [];

      const repaid = repayments.reduce(
        (sum, repayment) => {
          return sum + positiveAmount(
            repayment?.amount
          );
        },
        0
      );

      addEvent(
        list,
        row.date,
        "debts",
        (
          isBorrowed
            ? "Borrowed from "
            : "Lent to "
        ) + who,
        principal,
        "Debt recorded"
      );

      if (
        principal > repaid &&
        validDate(row.dueDate)
      ) {
        addEvent(
          list,
          row.dueDate,
          "debts",
          "Repayment due · " + who,
          principal - repaid,
          "Outstanding balance due"
        );
      }

      for (const payment of repayments) {
        if (
          !payment ||
          typeof payment !== "object"
        ) continue;

        addEvent(
          list,
          payment.date,
          "debts",
          "Debt repayment · " + who,
          payment.amount,
          "Repayment recorded"
        );
      }
    }

    /* INSURANCE
       This will begin displaying dates when
       our Insurance page saves policies.
    */

    for (const row of insurance) {
      if (
        !row ||
        typeof row !== "object"
      ) continue;

      const name = titleText(
        row.policyName || row.name,
        "Insurance policy"
      );

      const expiry = validDate(
        row.expiryDate
      );

      const renewal = validDate(
        row.renewalDate ||
        row.premiumDueDate
      );

      if (renewal) {
        addEvent(
          list,
          renewal,
          "insurance",
          name,
          row.premium,
          "Insurance renewal / premium due"
        );
      }

      if (
        expiry &&
        expiry !== renewal
      ) {
        addEvent(
          list,
          expiry,
          "insurance",
          name,
          0,
          "Insurance policy expires"
        );
      }
    }

    return list;
  }

  /* ==========================================
     RELOAD FINANCIAL DATA
     ========================================== */

  function reloadData() {
    state.errors = [];

    const transactions = readList(
      "moneyflow_transactions",
      "Income/Spending"
    );

    const payments = readList(
      "moneyflow_payments",
      "Payments"
    );

    const debts = readList(
      "moneyflow_debts",
      "Debts"
    );

    const insurance = readList(
      "moneyflow_insurance",
      "Insurance"
    );

    const budget = readBudget();

    state.events = gatherEvents(
      transactions,
      payments,
      debts,
      insurance
    );

    renderOverview(
      transactions,
      payments,
      budget
    );

    renderWarning();
    renderCalendar();
  }

  /* ==========================================
     DATA WARNING
     ========================================== */

  function renderWarning() {
    let warning = $(
      "calendarDataWarning"
    );

    if (
      !warning &&
      state.errors.length
    ) {
      warning = document.createElement("p");

      warning.id = "calendarDataWarning";

      warning.setAttribute(
        "role",
        "alert"
      );

      warning.style.cssText =
        "margin:0;padding:13px 15px;" +
        "border:1px solid #b77e40;" +
        "border-radius:14px;" +
        "background:#272015;" +
        "color:#ffd09a;" +
        "font-size:12px;" +
        "line-height:1.6";

      document.querySelector(
        ".calendar-overview"
      )?.after(warning);

      if (!warning.isConnected) {
        $("calendarDays")?.before(
          warning
        );
      }
    }

    if (warning) {
      warning.hidden = !state.errors.length;

      warning.textContent =
        state.errors.join(". ") +
        ". Some amounts or activities " +
        "may be incomplete. No saved " +
        "data was changed.";
    }
  }

  /* ==========================================
     MONTHLY OVERVIEW
     ========================================== */

  function renderOverview(
    transactions,
    payments,
    budget
  ) {
    const month =
      state.year +
      "-" +
      String(
        state.month + 1
      ).padStart(2, "0");

    const label = new Date(
      state.year,
      state.month,
      1
    ).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric"
    });

    $("calendarOverviewMonth").textContent =
      label;

    let income = 0;
    let spending = 0;

    /* TRANSACTION TOTALS */

    for (const entry of transactions) {
      if (
        !entry ||
        validDate(
          entry.date
        ).slice(0, 7) !== month
      ) continue;

      if (entry.type === "income") {
        income += positiveAmount(
          entry.amount
        );
      }

      if (entry.type === "expense") {
        spending += positiveAmount(
          entry.amount
        );
      }
    }

    /* PAID PAYMENT TOTALS */

    for (const entry of payments) {
      if (
        entry &&
        entry.status === "paid" &&
        validDate(
          entry.paidDate
        ).slice(0, 7) === month
      ) {
        spending += positiveAmount(
          entry.amount
        );
      }
    }

    const unreadableTransactions =
      state.errors.some((error) =>
        error.startsWith(
          "Income/Spending"
        )
      );

    const unreadablePayments =
      state.errors.some((error) =>
        error.startsWith("Payments")
      );

    const incomeOk =
      !unreadableTransactions;

    const spendingOk =
      incomeOk &&
      !unreadablePayments;

    $("calendarIncomeValue").textContent =
      incomeOk
        ? formatMoney.format(income)
        : "—";

    $("calendarSpentValue").textContent =
      spendingOk
        ? formatMoney.format(spending)
        : "—";

    $("calendarBudgetValue").textContent =
      budget === null
        ? "—"
        : formatMoney.format(budget);

    const remaining = $(
      "calendarRemaining"
    );

    const description = $(
      "calendarRemainingLabel"
    );

    if (
      budget === null ||
      !spendingOk
    ) {
      remaining.textContent = "—";

      description.textContent =
        "Some monthly figures are unavailable";

    } else if (budget === 0) {
      remaining.textContent = "—";

      description.textContent =
        "Set a monthly budget in More → Budget";

    } else {
      remaining.textContent =
        formatMoney.format(
          budget - spending
        );

      description.textContent =
        budget < spending
          ? "Over budget this month"
          : "Remaining to spend this month";
    }
  }

  /* ==========================================
     CALENDAR GRID
     ========================================== */

  function renderCalendar() {
    const first = new Date(
      state.year,
      state.month,
      1
    );

    const offset = first.getDay();

    const count = new Date(
      state.year,
      state.month + 1,
      0
    ).getDate();

    const cells = Math.ceil(
      (offset + count) / 7
    ) * 7;

    const monthName =
      first.toLocaleDateString(
        "en-GB",
        {
          month: "long",
          year: "numeric"
        }
      );

    $("calendarMonthTitle").textContent =
      monthName;

    const byDay = new Map();

    for (const item of state.events) {
      if (!byDay.has(item.date)) {
        byDay.set(
          item.date,
          new Set()
        );
      }

      byDay.get(
        item.date
      ).add(item.type);
    }

    const grid =
      document.createDocumentFragment();

    for (
      let index = 0;
      index < cells;
      index++
    ) {
      const dayDate = new Date(
        state.year,
        state.month,
        1 + index - offset
      );

      const key = dateKey(dayDate);

      const types = [
        ...(byDay.get(key) || [])
      ];

      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "calendar-day";

      if (
        dayDate.getMonth() !==
        state.month
      ) {
        button.classList.add(
          "outside"
        );
      }

      if (
        key === dateKey(now)
      ) {
        button.classList.add(
          "today"
        );
      }

      if (
        key === state.selected
      ) {
        button.classList.add(
          "selected"
        );
      }

      button.setAttribute(
        "aria-pressed",
        String(
          key === state.selected
        )
      );

      button.setAttribute(
        "aria-label",
        dayDate.toLocaleDateString(
          "en-GB",
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          }
        ) +
        (
          types.length
            ? ", has financial activities"
            : ""
        )
      );

      /* DATE NUMBER */

      const number =
        document.createElement("span");

      number.className =
        "calendar-day-number";

      number.textContent =
        String(
          dayDate.getDate()
        );

      button.appendChild(number);

      /* ACTIVITY DOTS */

      const dots =
        document.createElement("span");

      dots.className =
        "calendar-day-dots";

      dots.setAttribute(
        "aria-hidden",
        "true"
      );

      for (const type of types) {
        const dot =
          document.createElement("span");

        dot.className =
          "calendar-dot " + type;

        dots.appendChild(dot);
      }

      button.appendChild(dots);

      /* SELECT DATE */

      button.addEventListener(
        "click",
        () => {
          state.selected = key;

          state.year =
            dayDate.getFullYear();

          state.month =
            dayDate.getMonth();

          reloadData();
        }
      );

      grid.appendChild(button);
    }

    $("calendarDays").replaceChildren(
      grid
    );

    renderSelectedDay();
  }

  /* ==========================================
     SELECTED DAY ACTIVITIES
     ========================================== */

  function renderSelectedDay() {
    const [year, month, day] =
      state.selected
        .split("-")
        .map(Number);

    const selected = new Date(
      year,
      month - 1,
      day
    );

    $("calendarSelectedDate").textContent =
      selected.toLocaleDateString(
        "en-GB",
        {
          weekday: "short",
          day: "numeric",
          month: "short"
        }
      );

    const entries =
      state.events.filter(
        (event) =>
          event.date === state.selected
      );

    $("calendarEventCount").textContent =
      entries.length +
      (
        entries.length === 1
          ? " activity"
          : " activities"
      );

    const container = $(
      "calendarDayEvents"
    );

    const empty = $(
      "calendarEmptyState"
    );

    container.replaceChildren();

    empty.hidden =
      entries.length > 0;

    if (!entries.length) {
      const title =
        empty.querySelector("h3");

      if (title) {
        title.textContent =
          state.errors.length
            ? "No readable activities for this day"
            : "Nothing scheduled.";
      }

      return;
    }

    const fragment =
      document.createDocumentFragment();

    for (const event of entries) {
      const type = TYPES[
        event.type
      ];

      const card =
        document.createElement("article");

      card.className =
        "calendar-event-card";

      const icon =
        document.createElement("span");

      icon.className =
        "calendar-event-icon";

      icon.style.color =
        type.color;

      icon.textContent =
        type.symbol;

      icon.setAttribute(
        "aria-hidden",
        "true"
      );

      const content =
        document.createElement("div");

      content.className =
        "calendar-event-content";

      const heading =
        document.createElement("strong");

      heading.className =
        "calendar-event-title";

      heading.textContent =
        event.title;

      const detail =
        document.createElement("span");

      detail.className =
        "calendar-event-meta";

      detail.textContent =
        type.label +
        " · " +
        event.detail;

      content.append(
        heading,
        detail
      );

      card.append(
        icon,
        content
      );

      if (
        event.amount > 0
      ) {
        const money =
          document.createElement("strong");

        money.className =
          "calendar-event-amount";

        money.textContent =
          formatMoney.format(
            event.amount
          );

        card.appendChild(money);
      }

      fragment.appendChild(card);
    }

    container.appendChild(
      fragment
    );
  }

  /* ==========================================
     PREVIOUS / NEXT MONTH
     ========================================== */

  function changeMonth(delta) {
    const newFirst = new Date(
      state.year,
      state.month + delta,
      1
    );

    const selectedDay = Number(
      state.selected.slice(8, 10)
    );

    const last = new Date(
      newFirst.getFullYear(),
      newFirst.getMonth() + 1,
      0
    ).getDate();

    state.year =
      newFirst.getFullYear();

    state.month =
      newFirst.getMonth();

    state.selected = dateKey(
      new Date(
        state.year,
        state.month,
        Math.min(
          selectedDay,
          last
        )
      )
    );

    reloadData();
  }

  /* ==========================================
     ADD SOMETHING BOTTOM SHEET
     ========================================== */

  const overlay = $(
    "calendarAddOverlay"
  );

  const sheet =
    overlay?.querySelector(
      ".calendar-add-sheet"
    );

  function openSheet() {
    if (
      !overlay ||
      !overlay.hidden
    ) return;

    state.previousFocus =
      document.activeElement;

    state.oldOverflow =
      document.body.style.overflow;

    overlay.hidden = false;

    document.body.style.overflow =
      "hidden";

    try {
      history.pushState(
        {
          moneyflowCalendarSheet: true
        },
        "",
        location.href
      );

      state.hasSheetHistory = true;

    } catch (error) {
      state.hasSheetHistory = false;
    }

    sheet?.focus();
  }

  function closeSheet(
    fromBack = false
  ) {
    if (
      !overlay ||
      overlay.hidden
    ) return;

    overlay.hidden = true;

    document.body.style.overflow =
      state.oldOverflow;

    if (
      state.previousFocus?.isConnected
    ) {
      state.previousFocus.focus();
    }

    state.previousFocus = null;

    const shouldBack =
      state.hasSheetHistory &&
      !fromBack &&
      history.state?.moneyflowCalendarSheet === true;

    state.hasSheetHistory = false;

    if (shouldBack) {
      history.back();
    }
  }

  /* OPEN SHEET BUTTONS */

  document.querySelectorAll(
    "[data-calendar-add]"
  ).forEach((button) => {
    button.addEventListener(
      "click",
      openSheet
    );
  });

  /* CLOSE BUTTON */

  $("calendarCloseAddBtn")?.addEventListener(
    "click",
    () => closeSheet()
  );

  /* CLOSE BY TAPPING OUTSIDE */

  overlay?.addEventListener(
    "click",
    (event) => {
      if (
        event.target === overlay
      ) {
        closeSheet();
      }
    }
  );

  /* ESCAPE KEY */

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        overlay &&
        !overlay.hidden
      ) {
        event.preventDefault();
        closeSheet();
      }
    }
  );

  /* ANDROID HARDWARE BACK */

  window.addEventListener(
    "popstate",
    () => {
      if (
        overlay &&
        !overlay.hidden
      ) {
        closeSheet(true);
      }

      if (state.nextPage) {
        const page =
          state.nextPage;

        state.nextPage = null;

        window.location.assign(
          page
        );
      }
    }
  );

  /*
    Remove the temporary sheet-history
    entry before opening another page.

    This prevents an extra Back press
    when returning to Calendar.
  */

  overlay?.querySelectorAll(
    ".calendar-add-option[href]"
  ).forEach((link) => {

    link.addEventListener(
      "click",
      (event) => {

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        if (
          !state.hasSheetHistory ||
          !history.state?.moneyflowCalendarSheet
        ) {
          return;
        }

        event.preventDefault();

        state.nextPage = link.href;

        history.back();
      }
    );
  });

  /* ==========================================
     MONTH BUTTONS
     ========================================== */

  $("calendarPreviousMonth")?.addEventListener(
    "click",
    () => changeMonth(-1)
  );

  $("calendarNextMonth")?.addEventListener(
    "click",
    () => changeMonth(1)
  );

  /* ==========================================
     REFRESH ON RETURN / STORAGE CHANGE
     ========================================== */

  window.addEventListener(
    "pageshow",
    () => {
      if (
        overlay &&
        !overlay.hidden
      ) {
        closeSheet(true);
      }

      reloadData();
    }
  );

  window.addEventListener(
    "storage",
    (event) => {
      const relevantKeys = [
        "moneyflow_transactions",
        "moneyflow_payments",
        "moneyflow_debts",
        "moneyflow_insurance",
        "moneyflow_settings"
      ];

      if (
        !event.key ||
        relevantKeys.includes(
          event.key
        )
      ) {
        reloadData();
      }
    }
  );

  /* FIRST RENDER */

  reloadData();

});
