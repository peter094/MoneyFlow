/* =====================================================================
   MONEYFLOW — TRANSACTIONS PAGE
   Depends on core.js (load it first). Handles only what's specific
   to transactions.html: the full list, search/filter, delete, and
   the transaction-history summary cards.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  let filters = { search: "", type: "all", category: "all" };

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

    const form = document.getElementById("transactionForm");
    if (form) form.addEventListener("submit", handleSubmit);

    const search = document.getElementById("searchTransactions");
    if (search) {
      search.addEventListener("input", (e) => {
        filters.search = e.target.value;
        renderList();
      });
    }

    const typeFilter = document.getElementById("typeFilter");
    if (typeFilter) {
      typeFilter.addEventListener("change", (e) => {
        filters.type = e.target.value;
        renderList();
      });
    }

    const categoryFilter = document.getElementById("categoryFilter");
    if (categoryFilter) {
      categoryFilter.addEventListener("change", (e) => {
        filters.category = e.target.value;
        renderList();
      });
    }

    const list = document.getElementById("transactionsList");
    if (list) {
      list.addEventListener("click", (e) => {
        const deleteBtn = e.target.closest("[data-delete-id]");
        if (deleteBtn) {
          MoneyFlow.deleteTransaction(deleteBtn.getAttribute("data-delete-id"));
          render();
        }
      });
    }

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
    renderSummary();
    renderList();
  }

  function renderSummary() {
    const transactions = MoneyFlow.getTransactions();
    const income = transactions.filter((t) => t.type === "income");
    const expenses = transactions.filter((t) => t.type === "expense");
    const totals = MoneyFlow.calculateTotals(transactions);

    setText("balance", MoneyFlow.formatCurrency(totals.balance));
    setText("totalIncome", MoneyFlow.formatCurrency(totals.income));
    setText("totalExpenses", MoneyFlow.formatCurrency(totals.expenses));
    setText("transactionCount", transactions.length);

    setText("incomeCount", income.length);
    setText("expenseCount", expenses.length);

    const avgExpense = expenses.length ? totals.expenses / expenses.length : 0;
    setText("averageExpense", MoneyFlow.formatCurrency(avgExpense));

    const largestExpense = expenses.length ? Math.max(...expenses.map((t) => t.amount)) : 0;
    setText("largestExpense", MoneyFlow.formatCurrency(largestExpense));

    const status = document.getElementById("balanceStatus");
    if (status) {
      status.textContent =
        transactions.length === 0
          ? "Your current balance"
          : totals.balance >= 0
          ? "You're in the positive"
          : "Expenses exceed income";
    }
  }

  function renderList() {
    const list = document.getElementById("transactionsList");
    if (!list) return;

    const transactions = MoneyFlow.getTransactions();
    const filtered = MoneyFlow.filterTransactions(transactions, filters);

    if (filtered.length === 0) {
      list.innerHTML = buildEmptyStateHTML(transactions.length > 0);
      bindEmptyStateButton();
      return;
    }

    const sorted = MoneyFlow.sortByDateDesc(filtered);

    list.innerHTML = sorted.map(buildTransactionRowHTML).join("");
  }

  function buildEmptyStateHTML(hasAnyTransactions) {
    if (hasAnyTransactions) {
      return `
        <div class="empty-state" id="emptyTransactions">
          <h3>No matching transactions</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      `;
    }

    return `
      <div class="empty-state" id="emptyTransactions">
        <h3>No transactions yet</h3>
        <p>Your income and expenses will appear here once you add them.</p>
        <button id="emptyAddBtn" class="primary-button">Add Transaction</button>
      </div>
    `;
  }

  function buildTransactionRowHTML(t) {
    const isIncome = t.type === "income";
    const sign = isIncome ? "+" : "−";

    return `
      <div class="transaction-item ${isIncome ? "income" : "expense"}" data-id="${t.id}">
        <div class="transaction-icon">${isIncome ? "+" : "−"}</div>
        <div class="transaction-details">
          <strong>${MoneyFlow.escapeHTML(t.description)}</strong>
          <span>${MoneyFlow.escapeHTML(t.category)} · ${MoneyFlow.formatDate(t.date)}</span>
        </div>
        <div class="transaction-amount ${isIncome ? "income" : "expense"}">
          ${sign}${MoneyFlow.formatCurrency(t.amount)}
        </div>
        <a class="mf-receipt-link" href="receipt.html?type=${isIncome ? "income" : "expense"}&amp;id=${encodeURIComponent(String(t.id))}"
           aria-label="View transaction receipt" title="Receipt">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8h6M9 12h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </a>
        <button
          class="icon-button delete-button"
          data-delete-id="${t.id}"
          aria-label="Delete transaction"
          title="Delete transaction"
        >&times;</button>
      </div>
    `;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

});
