/* =====================================================================
   MONEYFLOW — DASHBOARD PAGE
   Depends on core.js (load it first). Handles only what's specific
   to index.html: summary cards, recent transactions, spending
   overview, and the quick-action buttons.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  MoneyFlow.initTheme();
  bindEvents();
  render();
  MoneyFlow.onExternalChange(render);

  /* ---------------- Events ---------------- */

  function bindEvents() {
    MoneyFlow.bindThemeToggle();
    MoneyFlow.bindModalBaseListeners();

    const addBtn = document.getElementById("addTransactionBtn");
    if (addBtn) addBtn.addEventListener("click", () => MoneyFlow.openModal("expense"));

    const incomeBtn = document.getElementById("incomeBtn");
    if (incomeBtn) incomeBtn.addEventListener("click", () => MoneyFlow.openModal("income"));

    const expenseBtn = document.getElementById("expenseBtn");
    if (expenseBtn) expenseBtn.addEventListener("click", () => MoneyFlow.openModal("expense"));

    const form = document.getElementById("transactionForm");
    if (form) form.addEventListener("submit", handleSubmit);

    bindEmptyStateButton();
  }

  function bindEmptyStateButton() {
    const btn = document.getElementById("emptyAddBtn");
    if (btn) btn.addEventListener("click", () => MoneyFlow.openModal("expense"));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const success = MoneyFlow.addTransaction({
      type: document.getElementById("transactionType")?.value,
      amount: document.getElementById("transactionAmount")?.value,
      category: document.getElementById("transactionCategory")?.value,
      description: document.getElementById("transactionDescription")?.value,
      date: document.getElementById("transactionDate")?.value,
    });

    if (success) {
      MoneyFlow.closeModal();
      event.target.reset();
      render();
    }
  }

  /* ---------------- Render ---------------- */

  function render() {
    const transactions = MoneyFlow.getTransactions();
    renderSummary(transactions);
    renderRecentTransactions(transactions);
    renderSpendingOverview(transactions);
  }

  function renderSummary(transactions) {
    const totals = MoneyFlow.calculateTotals(transactions);

    setText("balance", MoneyFlow.formatCurrency(totals.balance));
    setText("totalIncome", MoneyFlow.formatCurrency(totals.income));
    setText("totalExpenses", MoneyFlow.formatCurrency(totals.expenses));
    setText("transactionCount", transactions.length.toLocaleString());

    const status = document.getElementById("balanceStatus");
    if (!status) return;

    if (transactions.length === 0) {
      status.textContent = "Your current balance";
    } else if (totals.balance > 0) {
      status.textContent = "You're in the positive";
    } else if (totals.balance < 0) {
      status.textContent = "Expenses exceed income";
    } else {
      status.textContent = "Income and expenses are equal";
    }
  }

  function renderRecentTransactions(transactions) {
    const container = document.getElementById("recentTransactions");
    if (!container) return;

    if (transactions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No transactions yet</h3>
          <p>Add your first income or expense to get started.</p>
          <button id="emptyAddBtn" class="primary-button">Add Transaction</button>
        </div>
      `;
      bindEmptyStateButton();
      return;
    }

    const recent = MoneyFlow.sortByDateDesc(transactions).slice(0, 5);

    container.innerHTML = recent
      .map((t) => {
        const isIncome = t.type === "income";
        const sign = isIncome ? "+" : "−";

        return `
          <div class="transaction-item ${isIncome ? "income" : "expense"}">
            <div class="transaction-icon">${isIncome ? "+" : "−"}</div>
            <div class="transaction-details">
              <strong>${MoneyFlow.escapeHTML(t.description)}</strong>
              <span>${MoneyFlow.escapeHTML(t.category)} · ${MoneyFlow.formatDate(t.date)}</span>
            </div>
            <div class="transaction-amount ${isIncome ? "income" : "expense"}">
              ${sign}${MoneyFlow.formatCurrency(t.amount)}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderSpendingOverview(transactions) {
    const categories = MoneyFlow.calculateCategoryTotals(transactions);
    const totalExpenses = Object.values(categories).reduce((sum, v) => sum + v, 0);

    const categoryMap = {
      Food: { amount: "foodAmount", progress: "foodProgress" },
      Transport: { amount: "transportAmount", progress: "transportProgress" },
      Bills: { amount: "billsAmount", progress: "billsProgress" },
      Other: { amount: "otherAmount", progress: "otherProgress" },
    };

    Object.entries(categoryMap).forEach(([category, ids]) => {
      const amount = categories[category] || 0;

      setText(ids.amount, MoneyFlow.formatShortCurrency(amount));

      const progressEl = document.getElementById(ids.progress);
      if (progressEl) {
        const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
        progressEl.style.width = `${Math.min(pct, 100)}%`;
      }
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

});
