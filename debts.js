
/* ============================================
   MONEYFLOW — DEBT TRACKER
   Borrowed, Lent and repayments
   Requires core.js before debts.js
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const MF =
    typeof MoneyFlow === "undefined"
      ? null
      : MoneyFlow;

  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = "moneyflow_debts";

  if (!MF) {
    console.error(
      "Debt Tracker: MoneyFlow core.js is missing."
    );
    return;
  }

  // Keep this page in AMOLED dark mode.
  document.documentElement.classList.add("dark");

  const state = {
    type:
      new URLSearchParams(location.search)
        .get("tab") === "lent"
        ? "lent"
        : "borrowed",

    sort: "newest",
    view: "main",
    repaymentId: null,
    busy: false
  };

  bindEvents();
  showMain();
  render();

  // Support links like debts.html?add=1.

  if (
    new URLSearchParams(location.search)
      .get("add") === "1"
  ) {
    const clean = new URL(location.href);

    clean.searchParams.delete("add");

    history.replaceState(
      null,
      "",
      clean.pathname +
      clean.search +
      clean.hash
    );

    showAdd();
  }

  window.addEventListener("pageshow", render);

  window.addEventListener(
    "storage",
    (event) => {
      if (
        event.key === STORAGE_KEY ||
        event.key === null
      ) {
        render();
      }
    }
  );

  window.addEventListener(
    "popstate",
    () => {
      showMain();
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        state.view !== "main"
      ) {
        closeScreen();
      }
    }
  );

  /* ==========================================
     SAVING AND READING DEBT RECORDS
     ========================================== */

  function getDebts() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      return Array.isArray(saved)
        ? saved
        : [];

    } catch (error) {
      console.error(
        "Could not read saved debts:",
        error
      );

      MF.showToast(
        "Your saved debts could not be read.",
        "error"
      );

      return [];
    }
  }

  function saveDebts(debts) {
    try {
      if (!Array.isArray(debts)) {
        throw new Error("Refusing to save a non-list of debts.");
      }

      const existingRaw = localStorage.getItem(STORAGE_KEY);
      if (existingRaw !== null) {
        const existing = JSON.parse(existingRaw);
        if (!Array.isArray(existing)) {
          throw new Error("Existing debt records are unreadable.");
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
      return true;
    } catch (error) {
      console.error("Could not save debts; existing data preserved:", error);
      MF.showToast(
        "Debt records could not be saved safely. Existing data was preserved.",
        "error"
      );
      return false;
    }
  }

  /* ==========================================
     AMOUNT CALCULATIONS
     ========================================== */

  function money(value) {
    return Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100;
  }

  function totalRepaid(debt) {
    const entries = Array.isArray(
      debt.repayments
    )
      ? debt.repayments
      : [];

    const total = entries.reduce(
      (sum, item) => {
        const amount = Number(item.amount);

        return sum + (
          Number.isFinite(amount) &&
          amount > 0
            ? amount
            : 0
        );
      },
      0
    );

    return Math.max(0, money(total));
  }

  function outstanding(debt) {
    const principal =
      Number(debt.amount) || 0;

    return Math.max(
      0,
      money(
        principal - totalRepaid(debt)
      )
    );
  }

  function formatAmount(value) {
    return MF.formatCurrency(value);
  }

  /* ==========================================
     HELPER FUNCTIONS
     ========================================== */

  function escape(value) {
    return MF.escapeHTML(
      String(value ?? "")
    );
  }

  function escapeAttribute(value) {
    return escape(value)
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = String(value);
    }
  }

  function dateToday() {
    const date = new Date();

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

  function validDate(value) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const [year, month, day] =
      value.split("-").map(Number);

    const actual = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    return (
      actual.getUTCFullYear() === year &&
      actual.getUTCMonth() === month - 1 &&
      actual.getUTCDate() === day
    );
  }

  /* ==========================================
     BUTTON EVENTS
     ========================================== */

  function bindEvents() {

    // BORROWED TAB

    $("debtsBorrowedTab")?.addEventListener(
      "click",
      () => setType("borrowed")
    );

    // LENT TAB

    $("debtsLentTab")?.addEventListener(
      "click",
      () => setType("lent")
    );

    // ADD DEBT BUTTONS

    [
      "debtsAddTopBtn",
      "debtsEmptyAddBtn"
    ].forEach((id) => {
      $(id)?.addEventListener(
        "click",
        showAdd
      );
    });

    // BACK BUTTONS

    $("debtsBackFromAdd")?.addEventListener(
      "click",
      closeScreen
    );

    $("debtsBackFromRepayment")?.addEventListener(
      "click",
      closeScreen
    );

    // FORMS

    $("debtsForm")?.addEventListener(
      "submit",
      addDebt
    );

    $("debtsRepaymentForm")?.addEventListener(
      "submit",
      saveRepayment
    );

    // CHANGE FORM TITLE

    document.querySelectorAll(
      'input[name="debtType"]'
    ).forEach((radio) => {

      radio.addEventListener(
        "change",
        () => {
          if (radio.checked) {
            updateAddTitle(radio.value);
          }
        }
      );

    });

    // SORT

    $("debtsSortBtn")?.addEventListener(
      "click",
      () => {
        const order = [
          "newest",
          "oldest",
          "highest"
        ];

        const next =
          (order.indexOf(state.sort) + 1) %
          order.length;

        state.sort = order[next];

        render();
      }
    );

    // REPAYMENT BUTTONS

    $("debtsRecordsList")?.addEventListener(
      "click",
      (event) => {

        const button = event.target.closest(
          "[data-repay-id]"
        );

        if (button) {
          showRepayment(
            button.dataset.repayId
          );
        }

      }
    );
  }

  function setType(type) {
    if (
      type !== "borrowed" &&
      type !== "lent"
    ) {
      return;
    }

    state.type = type;
    render();
  }

  /* ==========================================
     SCREEN NAVIGATION
     ========================================== */

  function showMain() {
    state.view = "main";
    state.repaymentId = null;

    $("debtsMainView").hidden = false;
    $("debtsAddView").hidden = true;
    $("debtsRepaymentView").hidden = true;

    window.scrollTo(0, 0);
  }

  function openScreen(view) {
    $("debtsMainView").hidden = true;

    $("debtsAddView").hidden =
      view !== "add";

    $("debtsRepaymentView").hidden =
      view !== "repayment";

    state.view = view;

    history.pushState(
      {
        moneyflowDebtScreen: view
      },
      "",
      location.href
    );

    window.scrollTo(0, 0);
  }

  function closeScreen() {
    if (state.view === "main") {
      return;
    }

    showMain();
    render();

    if (
      history.state?.moneyflowDebtScreen
    ) {
      history.back();
    }
  }

  /* ==========================================
     SHOW ADD DEBT SCREEN
     ========================================== */

  function showAdd() {
    const form = $("debtsForm");

    if (
      !form ||
      state.view !== "main"
    ) {
      return;
    }

    form.reset();

    $("debtsDate").value = dateToday();

    const selected = form.querySelector(
      `input[name="debtType"][value="${state.type}"]`
    );

    if (selected) {
      selected.checked = true;
    }

    updateAddTitle(state.type);

    openScreen("add");
  }

  function updateAddTitle(type) {
    setText(
      "debtsAddTitle",
      type === "lent"
        ? "Add Lent Money"
        : "Add Borrowed Money"
    );
  }

  /* ==========================================
     SHOW REPAYMENT SCREEN
     ========================================== */

  function showRepayment(id) {
    const debt = getDebts().find(
      (item) =>
        String(item.id) === String(id)
    );

    if (!debt) {
      MF.showToast(
        "This debt could not be found.",
        "error"
      );

      return;
    }

    const balance = outstanding(debt);

    if (balance <= 0) {
      MF.showToast(
        "This debt has already been fully repaid."
      );

      return;
    }

    $("debtsRepaymentForm").reset();

    $("debtsRepaymentDebtId").value =
      String(debt.id);

    $("debtsRepaymentDate").value =
      dateToday();

    $("debtsRepaymentAmount").max =
      String(balance);

    setText(
      "debtsRepaymentPerson",
      debt.type === "lent"
        ? `Money returned by ${debt.person}`
        : `Money repaid to ${debt.person}`
    );

    setText(
      "debtsRepaymentBalance",
      formatAmount(balance)
    );

    state.repaymentId =
      String(debt.id);

    openScreen("repayment");
  }

  /* ==========================================
     ADD A NEW DEBT
     ========================================== */

  function addDebt(event) {
    event.preventDefault();

    if (state.busy) return;

    const type = document.querySelector(
      'input[name="debtType"]:checked'
    )?.value;

    const person =
      $("debtsPersonName").value.trim();

    const amount = money(
      $("debtsAmount").value
    );

    const date =
      $("debtsDate").value;

    const dueDate =
      $("debtsDueDate").value;

    const notes =
      $("debtsNotes").value.trim();

    // VALIDATION

    if (
      type !== "borrowed" &&
      type !== "lent"
    ) {
      MF.showToast(
        "Choose Borrowed or Lent.",
        "error"
      );

      return;
    }

    if (!person) {
      MF.showToast(
        "Enter the person's name.",
        "error"
      );

      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      MF.showToast(
        "Enter an amount greater than zero.",
        "error"
      );

      return;
    }

    if (!validDate(date)) {
      MF.showToast(
        "Choose a valid debt date.",
        "error"
      );

      return;
    }

    if (
      dueDate &&
      (
        !validDate(dueDate) ||
        dueDate < date
      )
    ) {
      MF.showToast(
        "Repayment due date must be on or after the debt date.",
        "error"
      );

      return;
    }

    // BUILD DEBT RECORD

    const debt = {
      id: MF.generateId(),
      type,
      person,
      amount,
      date,
      dueDate,
      notes,
      repayments: [],
      createdAt:
        new Date().toISOString()
    };

    state.busy = true;

    const button =
      $("debtsSaveBtn");

    if (button) {
      button.disabled = true;
    }

    try {
      const debts = getDebts();

      debts.push(debt);

      if (!saveDebts(debts)) {
        return;
      }

      state.type = type;

      closeScreen();

      MF.showToast(
        type === "borrowed"
          ? "Borrowed money saved."
          : "Lent money saved."
      );

    } finally {
      state.busy = false;

      if (button) {
        button.disabled = false;
      }
    }
  }

  /* ==========================================
     SAVE A REPAYMENT
     ========================================== */

  function saveRepayment(event) {
    event.preventDefault();

    if (state.busy) return;

    const id =
      $("debtsRepaymentDebtId").value;

    const amount = money(
      $("debtsRepaymentAmount").value
    );

    const date =
      $("debtsRepaymentDate").value;

    const notes =
      $("debtsRepaymentNotes").value.trim();

    const debts = getDebts();

    const debt = debts.find(
      (item) =>
        String(item.id) === id
    );

    if (!debt) {
      MF.showToast(
        "Debt record not found.",
        "error"
      );

      return;
    }

    const balance =
      outstanding(debt);

    // CHECK REPAYMENT AMOUNT

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > balance
    ) {
      MF.showToast(
        `Enter a repayment between ₦0.01 and ${formatAmount(balance)}.`,
        "error"
      );

      return;
    }

    // CHECK REPAYMENT DATE

    if (
      !validDate(date) ||
      date < debt.date ||
      date > dateToday()
    ) {
      MF.showToast(
        "Repayment date must be between the debt date and today.",
        "error"
      );

      return;
    }

    if (
      !Array.isArray(
        debt.repayments
      )
    ) {
      debt.repayments = [];
    }

    // ADD REPAYMENT TO DEBT

    debt.repayments.push({
      id: MF.generateId(),
      amount,
      date,
      notes,
      createdAt:
        new Date().toISOString()
    });

    state.busy = true;

    const button =
      $("debtsRepaymentSaveBtn");

    if (button) {
      button.disabled = true;
    }

    try {
      if (!saveDebts(debts)) {
        return;
      }

      state.type = debt.type;

      closeScreen();

      MF.showToast(
        "Repayment recorded successfully."
      );

    } finally {
      state.busy = false;

      if (button) {
        button.disabled = false;
      }
    }
  }

  /* ==========================================
     UPDATE THE DEBT TRACKER
     ========================================== */

  function render() {

    const isBorrowed =
      state.type === "borrowed";

    const all = getDebts();

    const debts = all.filter(
      (item) =>
        item.type === state.type
    );

    // CALCULATE TOTALS

    const total = debts.reduce(
      (sum, debt) =>
        sum +
        (Number(debt.amount) || 0),
      0
    );

    const repaid = debts.reduce(
      (sum, debt) =>
        sum + totalRepaid(debt),
      0
    );

    const stillOwed = debts.reduce(
      (sum, debt) =>
        sum + outstanding(debt),
      0
    );

    const active = debts.filter(
      (debt) =>
        outstanding(debt) > 0
    ).length;

    $("debtsMainView").dataset.activeType =
      state.type;

    // UPDATE TABS

    $("debtsBorrowedTab").classList.toggle(
      "active",
      isBorrowed
    );

    $("debtsLentTab").classList.toggle(
      "active",
      !isBorrowed
    );

    $("debtsBorrowedTab").setAttribute(
      "aria-pressed",
      String(isBorrowed)
    );

    $("debtsLentTab").setAttribute(
      "aria-pressed",
      String(!isBorrowed)
    );

    // OVERVIEW CONTENT

    setText(
      "debtsOverviewLabel",
      isBorrowed
        ? "Total Money You Owe"
        : "Total Money Owed to You"
    );

    setText(
      "debtsOverviewDescription",
      isBorrowed
        ? "Your outstanding borrowed balance."
        : "Money you are still expecting back."
    );

    setText(
      "debtsOutstandingAmount",
      formatAmount(stillOwed)
    );

    setText(
      "debtsTotalPrincipal",
      formatAmount(total)
    );

    setText(
      "debtsTotalRepaid",
      formatAmount(repaid)
    );

    setText(
      "debtsActiveCount",
      active
    );

    setText(
      "debtsRecordsTitle",
      isBorrowed
        ? "Borrowed Money"
        : "Lent Money"
    );

    // SORT LABEL

    setText(
      "debtsSortBtn",
      state.sort === "newest"
        ? "Latest First ↓"
        : state.sort === "oldest"
          ? "Oldest First ↑"
          : "Amount High ↓"
    );

    // EMPTY STATE

    if (!debts.length) {

      setText(
        "debtsEmptyTitle",
        isBorrowed
          ? "No borrowed money yet"
          : "No lent money yet"
      );

      setText(
        "debtsEmptyDescription",
        isBorrowed
          ? "Record money you've borrowed to keep track of repayments."
          : "Record money you've lent to track when it is returned."
      );
    }

    $("debtsEmptyState").hidden =
      debts.length > 0;

    // SORT DEBT RECORDS

    const ordered = [...debts];

    if (state.sort === "oldest") {

      ordered.sort(
        (a, b) =>
          String(a.date).localeCompare(
            String(b.date)
          )
      );

    } else if (
      state.sort === "highest"
    ) {

      ordered.sort(
        (a, b) =>
          outstanding(b) -
          outstanding(a)
      );

    } else {

      ordered.sort(
        (a, b) =>
          String(b.date).localeCompare(
            String(a.date)
          )
      );
    }

    $("debtsRecordsList").innerHTML =
      ordered.map(renderCard).join("");
  }

  /* ==========================================
     BUILD EACH DEBT CARD
     ========================================== */

  function renderCard(debt) {

    const principal = Math.max(
      0,
      Number(debt.amount) || 0
    );

    const repaid =
      totalRepaid(debt);

    const left =
      outstanding(debt);

    const complete =
      left <= 0;

    const overdue =
      !complete &&
      validDate(debt.dueDate) &&
      debt.dueDate < dateToday();

    const status = complete
      ? "Repaid"
      : overdue
        ? "Overdue"
        : "Active";

    const statusClass = complete
      ? "paid"
      : overdue
        ? "overdue"
        : "";

    const progress = principal > 0
      ? Math.min(
          100,
          Math.max(
            0,
            repaid / principal * 100
          )
        )
      : 0;

    const name = String(
      debt.person || "Unknown person"
    );

    const avatar =
      name.trim().charAt(0).toUpperCase() ||
      "?";

    const dueText =
      validDate(debt.dueDate)
        ? `Due ${MF.formatDate(debt.dueDate)}`
        : "No due date";

    const repaidText =
      debt.type === "borrowed"
        ? "You've repaid"
        : "Returned to you";

    const actionText =
      debt.type === "borrowed"
        ? "Record Payment"
        : "Record Money Returned";

    const note = debt.notes
      ? `
        <p class="debt-record-note">
          ${escape(debt.notes)}
        </p>
      `
      : "";

    return `
      <article
        class="debt-record-card ${
          debt.type === "lent"
            ? "lent"
            : "borrowed"
        }"
      >

        <div class="debt-record-top">

          <div
            class="debt-record-avatar"
            aria-hidden="true"
          >
            ${escape(avatar)}
          </div>

          <div class="debt-record-person">

            <strong>
              ${escape(name)}
            </strong>

            <span>
              Recorded
              ${escape(
                MF.formatDate(debt.date)
              )}
            </span>

          </div>

          <span
            class="debt-record-status ${statusClass}"
          >
            ${status}
          </span>

        </div>

        <div class="debt-record-amounts">

          <div>
            <span>Original Amount</span>

            <strong>
              ${formatAmount(principal)}
            </strong>
          </div>

          <div>
            <span>Outstanding</span>

            <strong>
              ${formatAmount(left)}
            </strong>
          </div>

        </div>

        <div
          class="debt-progress-track"
          role="progressbar"
          aria-label="Repayment progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${Math.round(progress)}"
        >

          <div
            class="debt-progress-fill"
            style="width: ${progress.toFixed(2)}%"
          ></div>

        </div>

        <div class="debt-record-meta">

          <span>
            ${escape(repaidText)}:
            ${formatAmount(repaid)}
          </span>

          <span>
            ${escape(dueText)}
          </span>

        </div>

        ${note}

        ${
          complete
            ? ""
            : `
              <button
                type="button"
                class="debt-repay-button"
                data-repay-id="${escapeAttribute(debt.id)}"
              >
                + ${actionText}
              </button>
            `
        }

      </article>
    `;
  }

});
