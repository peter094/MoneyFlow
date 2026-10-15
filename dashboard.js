
/* ============================================
   MONEYFLOW — AMOLED HOME DASHBOARD
   Requires core.js before dashboard.js
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const MF =
    typeof MoneyFlow !== "undefined"
      ? MoneyFlow
      : null;

  const $ = (id) => document.getElementById(id);

  if (!MF) {
    console.error("MoneyFlow core.js is missing.");
    return;
  }

  document.documentElement.classList.add("dark");

  const themeMeta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (themeMeta) {
    themeMeta.content = "#09090f";
  }

  setAccountDisplay();
  bindActions();
  render();

  MF.onExternalChange(() => {
    setAccountDisplay();
    render();
  });

  window.addEventListener("pageshow", () => {
    setAccountDisplay();
    render();
  });

  // Debt records use separate storage.
  window.addEventListener("storage", (event) => {
    if (event.key === "moneyflow_debts") {
      render();
    }
  });

  /* ==========================================
     ACCOUNT NAME AND GREETING
     ========================================== */

  function setAccountDisplay() {
    const user = MF.getAuthUser() || {};
    const preferences = MF.getSettings();

    const name = String(
      preferences.userName ||
      user.name ||
      user.fullName ||
      user.firstName ||
      ""
    ).trim();

    const firstName = name
      ? name.split(/\s+/)[0]
      : "there";

    const hour = new Date().getHours();

    const part =
      hour < 12
        ? "morning"
        : hour < 18
          ? "afternoon"
          : "evening";

    setText(
      "greetingHeading",
      `Good ${part}, ${firstName}! 👋`
    );

    const initial = name || user.email || "M";

    setText(
      "userAvatar",
      String(initial).charAt(0).toUpperCase()
    );
  }

  /* ==========================================
     BUTTON FUNCTIONS
     ========================================== */

  function bindActions() {
    MF.bindModalBaseListeners();

    // QUICK ADD: INCOME

    $("incomeBtn")?.addEventListener(
      "click",
      () => {
        location.href = "income.html?add=1";
      }
    );

    // FIRST CARD: INCOME OVERVIEW

    makeCardInteractive(
      "monthIncome",
      "View income details",
      () => {
        location.href = "income.html";
      }
    );

    // SECOND CARD: REMAINING MONEY

    makeCardInteractive(
      "monthRemaining",
      "View or update monthly budget",
      () => {
        openBudgetModal();
      }
    );

    // THIRD CARD: OUTSTANDING DEBTS

    makeCardInteractive(
      "monthOwed",
      "View borrowed and lent debts",
      () => {
        location.href = "debts.html?tab=borrowed";
      }
    );

    // QUICK ADD: EXPENSE

    $("expenseBtn")?.addEventListener(
      "click",
      () => openTransaction("expense")
    );

    // QUICK ADD: BILL / LOAN

    $("billLoanBtn")?.addEventListener(
      "click",
      () => {
        location.href = "payments.html";
      }
    );

    $("transactionForm")?.addEventListener(
      "submit",
      saveTransaction
    );

    $("transactionType")?.addEventListener(
      "change",
      chooseCategoryForType
    );

    
    /* =====================================
       MONEYFLOW — HOME NOTIFICATIONS
       Open the Notifications Centre
       ===================================== */

    $("notificationBellBtn")?.addEventListener(
      "click",
      () => {
        window.location.href = "notifications.html";
      }
    );


    $("userAvatar")?.addEventListener(
      "click",
      () => {
        location.href = "settings.html";
      }
    );

    $("referFriendsBtn")?.addEventListener(
      "click",
      shareMoneyFlow
    );

    bindBudget();
    bindNavigation();
  }

  /* ==========================================
     MAKE SUMMARY CARDS CLICKABLE
     ========================================== */

  function makeCardInteractive(
    amountId,
    label,
    action
  ) {
    const card = $(amountId)?.closest(
      ".summary-card"
    );

    if (!card) return;

    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", label);

    card.style.cursor = "pointer";

    card.addEventListener("click", action);

    card.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          action();
        }
      }
    );
  }

  /* ==========================================
     ADD EXPENSE POPUP
     ========================================== */

  function openTransaction(type) {
    MF.openModal(type);
    chooseCategoryForType();
  }

  function chooseCategoryForType() {
    const type = $("transactionType")?.value;
    const category = $("transactionCategory");

    if (!category) return;

    if (
      type === "expense" &&
      category.value === "Salary"
    ) {
      category.value = "Food";
    } else if (
      type === "income" &&
      category.value === "Food"
    ) {
      category.value = "Salary";
    }

    if (
      typeof category.moneyflowRefresh ===
      "function"
    ) {
      category.moneyflowRefresh();
    }
  }

  function saveTransaction(event) {
    event.preventDefault();

    const success = MF.addTransaction({
      type: $("transactionType")?.value,
      amount: $("transactionAmount")?.value,
      category: $("transactionCategory")?.value,
      description:
        $("transactionDescription")?.value,
      date: $("transactionDate")?.value
    });

    if (!success) return;

    MF.closeModal();
    event.target.reset();
    render();
  }

  /* ==========================================
     MONTHLY BUDGET
     ========================================== */

  function bindBudget() {
    $("budgetStripBtn")?.addEventListener(
      "click",
      openBudgetModal
    );

    $("closeBudgetModalBtn")?.addEventListener(
      "click",
      closeBudgetModal
    );

    $("cancelBudgetBtn")?.addEventListener(
      "click",
      closeBudgetModal
    );

    $("budgetForm")?.addEventListener(
      "submit",
      saveBudget
    );

    $("budgetModal")?.addEventListener(
      "click",
      (event) => {
        if (event.target === $("budgetModal")) {
          closeBudgetModal();
        }
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          $("budgetModal")?.classList.contains(
            "active"
          )
        ) {
          closeBudgetModal();
        }
      }
    );
  }

  function openBudgetModal() {
    const modal = $("budgetModal");

    if (!modal) return;

    const saved =
      Number(MF.getSettings().monthlyBudget) || 0;

    const input = $("budgetAmount");

    if (input) {
      input.value = saved || "";
    }

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    modal.classList.add("active");

    setTimeout(() => {
      input?.focus();
    }, 100);
  }

  function closeBudgetModal() {
    const modal = $("budgetModal");

    if (!modal) return;

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    modal.classList.remove("active");
  }

  function saveBudget(event) {
    event.preventDefault();

    const value = $("budgetAmount")?.value;
    const amount = Number(value);

    if (
      value === "" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      MF.showToast(
        "Enter a valid budget amount.",
        "error"
      );

      return;
    }

    const saved = MF.saveSettings({
      ...MF.getSettings(),
      monthlyBudget: amount
    });

    if (!saved) {
      MF.showToast(
        "Could not save your budget.",
        "error"
      );

      return;
    }

    closeBudgetModal();
    MF.showToast("Monthly budget saved.");
    render();
  }

  /* ==========================================
     BOTTOM NAVIGATION
     ========================================== */

  function bindNavigation() {

    // PAYMENTS

    $("navPayments")?.addEventListener(
      "click",
      () => {
        location.href = "payments.html";
      }
    );

    // SPENDING

    $("navSpending")?.addEventListener(
      "click",
      () => {
        location.href = "spending.html";
      }
    );

    // DEBTS

    $("navDebts")?.addEventListener(
      "click",
      () => {
        location.href = "debts.html";
      }
    );

    // MORE — NEW PAGE

    $("navMore")?.addEventListener(
      "click",
      () => {
        location.href = "more.html";
      }
    );
  }

  /* ==========================================
     REFER FRIENDS
     ========================================== */

  async function shareMoneyFlow() {
    const isLocal = [
      "localhost",
      "127.0.0.1"
    ].includes(location.hostname);

    const appUrl = isLocal
      ? "https://moneyflow-finance.netlify.app/"
      : new URL(
          "welcome.html",
          location.href
        ).href;

    const shareData = {
      title: "MoneyFlow",
      text:
        "Track your income, expenses and bills with MoneyFlow.",
      url: appUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== "AbortError") {
          MF.showToast(
            "Couldn't open sharing. Try again.",
            "error"
          );
        }
      }

      return;
    }

    try {
      await navigator.clipboard.writeText(
        appUrl
      );

      MF.showToast("MoneyFlow link copied.");
    } catch (error) {
      window.prompt(
        "Copy the MoneyFlow link:",
        appUrl
      );
    }
  }

  /* ==========================================
     CALCULATE ACTUAL BORROWED DEBTS
     ========================================== */

  function borrowedBalance() {
    let debts;

    try {
      const data = JSON.parse(
        localStorage.getItem("moneyflow_debts") ||
        "[]"
      );

      if (!Array.isArray(data)) {
        return null;
      }

      debts = data;

    } catch (error) {
      console.error(
        "MoneyFlow: Could not read debts.",
        error
      );

      return null;
    }

    let amountOwed = 0;
    let active = 0;

    for (const debt of debts) {
      if (
        !debt ||
        debt.type !== "borrowed"
      ) {
        continue;
      }

      const principal = Number(debt.amount);

      if (
        !Number.isFinite(principal) ||
        principal <= 0
      ) {
        continue;
      }

      const payments = Array.isArray(
        debt.repayments
      )
        ? debt.repayments
        : [];

      const repaid = payments.reduce(
        (sum, payment) => {
          const amount = Number(
            payment?.amount
          );

          return sum + (
            Number.isFinite(amount) &&
            amount > 0
              ? amount
              : 0
          );
        },
        0
      );

      const left = Math.max(
        0,
        Math.round(
          (principal - repaid) * 100
        ) / 100
      );

      amountOwed += left;

      if (left > 0) {
        active++;
      }
    }

    return {
      amountOwed,
      active
    };
  }

  /* ==========================================
     DASHBOARD DATA
     ========================================== */

  function render() {
    const transactions =
      MF.getTransactions();

    const monthly =
      thisMonth(transactions);

    const totals =
      MF.calculateTotals(monthly);

    const settings =
      MF.getSettings();

    const now = new Date();

    const monthLabel =
      now.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric"
      });

    setText(
      "monthPillLabel",
      monthLabel
    );

    setText(
      "transactionsHeading",
      `Transactions · ${monthLabel}`
    );

    setText(
      "monthIncome",
      MF.formatCurrency(totals.income)
    );

    setText(
      "monthRemaining",
      MF.formatCurrency(totals.balance)
    );

    // REAL DEBT TOTALS

    const debtTotals = borrowedBalance();

    if (debtTotals === null) {
      setText("monthOwed", "—");

      setText(
        "owedSummaryNote",
        "Debt records could not be loaded"
      );

    } else {
      setText(
        "monthOwed",
        MF.formatCurrency(
          debtTotals.amountOwed
        )
      );

      const debtNote =
        debtTotals.active === 0
          ? "No outstanding borrowed debts"
          : `${debtTotals.active} active borrowed ${
              debtTotals.active === 1
                ? "debt"
                : "debts"
            }`;

      setText(
        "owedSummaryNote",
        debtNote
      );
    }

    setText(
      "incomeSummaryNote",
      totals.income > 0
        ? "Income recorded this month"
        : "No income logged yet — tap to add one"
    );

    const budget =
      Number(settings.monthlyBudget) || 0;

    const budgetMessage =
      budget > 0
        ? `Your monthly budget is ${MF.formatCurrency(budget)}. Tap to update it.`
        : "Set a monthly budget to track how much you have left to spend.";

    setText(
      "budgetStripText",
      budgetMessage
    );

    renderRecent(monthly);
  }

  /* ==========================================
     CURRENT MONTH TRANSACTIONS
     ========================================== */

  function thisMonth(transactions) {
    const now = new Date();

    const monthKey =
      `${now.getFullYear()}-` +
      String(
        now.getMonth() + 1
      ).padStart(2, "0");

    return transactions.filter(
      (item) =>
        typeof item.date === "string" &&
        item.date.startsWith(monthKey)
    );
  }

  /* ==========================================
     RECENT TRANSACTIONS
     ========================================== */

  function renderRecent(monthly) {
    const list = $("recentTransactions");

    if (!list) return;

    if (monthly.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>
            No transactions logged yet this month.
          </p>
        </div>
      `;

      return;
    }

    const recent =
      MF.sortByDateDesc(monthly)
        .slice(0, 5);

    list.innerHTML = recent.map(
      (item) => {
        const income =
          item.type === "income";

        const safeName =
          MF.escapeHTML(
            item.description || "Transaction"
          );

        const safeCategory =
          MF.escapeHTML(
            item.category || "Other"
          );

        const sign =
          income ? "+" : "−";

        const kind =
          income ? "income" : "expense";

        return `
          <div class="transaction-item ${kind}">

            <div class="transaction-icon">
              ${income ? "+" : "−"}
            </div>

            <div class="transaction-details">
              <strong>
                ${safeName}
              </strong>

              <span>
                ${safeCategory} ·
                ${MF.formatDate(item.date)}
              </span>
            </div>

            <div class="transaction-amount ${kind}">
              ${sign}${MF.formatCurrency(item.amount)}
            </div>

          </div>
        `;
      }
    ).join("");
  }

  /* ==========================================
     TEXT HELPER
     ========================================== */

  function setText(id, text) {
    const element = $(id);

    if (element) {
      element.textContent = String(text);
    }
  }

});
