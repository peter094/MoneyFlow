/* =====================================================================
   MONEYFLOW — DASHBOARD PAGE (PHASE 2)
   Depends on core.js (load it first). Handles the new Home layout:
   greeting, month-scoped summary cards, budget strip, Quick Add,
   and recent transactions. The transaction add/edit modal logic is
   reused unchanged from Phase 1 — only the rendering around it is new.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  applyStatusBarColor();
  applyGreeting();
  applyAvatar();
  bindEvents();
  render();
  MoneyFlow.onExternalChange(render);

  /* ---------------- Header ---------------- */

  function applyStatusBarColor() {
    // Home is a fixed-dark-purple page regardless of the stored
    // theme setting — the pre-paint script in <head> still runs the
    // old green-aware logic (harmless, just redundant here), so this
    // corrects the status bar to match once this script runs.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#090E17");
  }

  function applyGreeting() {
    // Settings' Profile view shows getSettings().userName — that's
    // the value the person actually sees as "their name" and can
    // edit. getAuthUser().name can go stale (e.g. a session logged
    // in before the name was seeded/synced) without Settings' local
    // copy being affected, so prefer the same source Settings uses.
    // Falls back to the raw auth object for a brand-new user who
    // hasn't visited Settings yet (nothing to seed from otherwise).
    const nameFromSettings = MoneyFlow.getSettings()?.userName?.trim();
    const nameFromAccount = MoneyFlow.getAuthUser()?.name?.trim();
    const rawName = nameFromSettings || nameFromAccount || "";
    const firstName = rawName ? rawName.split(" ")[0] : "there";

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

    const heading = document.getElementById("greetingHeading");
    if (heading) {
      heading.textContent = `Good ${timeOfDay}, ${firstName}!\u00A0👋`;
    }
  }

  function applyAvatar() {
    const nameFromSettings = MoneyFlow.getSettings()?.userName?.trim();
    const nameFromAccount = MoneyFlow.getAuthUser()?.name?.trim();
    const source = nameFromSettings || nameFromAccount || MoneyFlow.getAuthUser()?.email || "?";
    const initial = source.charAt(0).toUpperCase();

    const avatar = document.getElementById("userAvatar");
    if (avatar) avatar.textContent = initial;
  }

  /* ---------------- Events ---------------- */

  function bindEvents() {
    MoneyFlow.bindModalBaseListeners();

    const incomeBtn = document.getElementById("incomeBtn");
    if (incomeBtn) incomeBtn.addEventListener("click", () => MoneyFlow.openModal("income"));

    const expenseBtn = document.getElementById("expenseBtn");
    if (expenseBtn) expenseBtn.addEventListener("click", () => MoneyFlow.openModal("expense"));

    const billLoanBtn = document.getElementById("billLoanBtn");
    if (billLoanBtn) {
      billLoanBtn.addEventListener("click", () => {
        MoneyFlow.showToast("Bill / Loan tracking is coming soon.");
      });
    }

    const form = document.getElementById("transactionForm");
    if (form) form.addEventListener("submit", handleTransactionSubmit);

    bindEmptyStateButton();

    const notificationBellBtn = document.getElementById("notificationBellBtn");
    if (notificationBellBtn) {
      notificationBellBtn.addEventListener("click", () => {
        MoneyFlow.showToast("Notifications are coming soon.");
      });
    }

    bindBudgetStrip();
    bindBottomNav();
  }

  function bindEmptyStateButton() {
    const btn = document.getElementById("emptyAddBtn");
    if (btn) btn.addEventListener("click", () => MoneyFlow.openModal("expense"));
  }

  function handleTransactionSubmit(event) {
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

  /* ---------------- Budget strip + modal ---------------- */

  function bindBudgetStrip() {
    const stripBtn = document.getElementById("budgetStripBtn");
    if (stripBtn) stripBtn.addEventListener("click", openBudgetModal);

    const closeBtn = document.getElementById("closeBudgetModalBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeBudgetModal);

    const cancelBtn = document.getElementById("cancelBudgetBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", closeBudgetModal);

    const modal = document.getElementById("budgetModal");
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeBudgetModal();
      });
    }

    const form = document.getElementById("budgetForm");
    if (form) form.addEventListener("submit", handleBudgetSubmit);
  }

  function openBudgetModal() {
    const settings = MoneyFlow.getSettings();
    const input = document.getElementById("budgetAmount");
    if (input) input.value = settings.monthlyBudget || "";

    const modal = document.getElementById("budgetModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("active");
    setTimeout(() => input?.focus(), 100);
  }

  function closeBudgetModal() {
    const modal = document.getElementById("budgetModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("active");
  }

  function handleBudgetSubmit(event) {
    event.preventDefault();

    const amount = Number(document.getElementById("budgetAmount")?.value);
    if (!Number.isFinite(amount) || amount < 0) {
      MoneyFlow.showToast("Please enter a valid budget amount.", "error");
      return;
    }

    const settings = MoneyFlow.getSettings();
    MoneyFlow.saveSettings({ ...settings, monthlyBudget: amount });

    closeBudgetModal();
    MoneyFlow.showToast("Budget updated.");
    render();
  }

  /* ---------------- Bottom nav ---------------- */
  // Payments/Debts have no page yet — a "coming soon" toast is the
  // honest option rather than a dead link. Spending/More bridge to
  // the existing (not-yet-redesigned) analytics.html/settings.html
  // so those pages stay reachable rather than orphaned mid-rebuild.

  function bindBottomNav() {
    const navPayments = document.getElementById("navPayments");
    if (navPayments) {
      navPayments.addEventListener("click", () => {
        window.location.href = "payments.html";
      });
    }

    const navSpending = document.getElementById("navSpending");
    if (navSpending) {
      navSpending.addEventListener("click", () => {
        window.location.href = "analytics.html";
      });
    }

    const navDebts = document.getElementById("navDebts");
    if (navDebts) {
      navDebts.addEventListener("click", () => {
        MoneyFlow.showToast("Debts is coming soon.");
      });
    }

    const navMore = document.getElementById("navMore");
    if (navMore) {
      navMore.addEventListener("click", () => {
        window.location.href = "settings.html";
      });
    }
  }

  /* ---------------- Render ---------------- */

  function render() {
    const transactions = MoneyFlow.getTransactions();
    renderMonthSummary(transactions);
    renderBudgetStrip();
    renderTransactionsHeading();
    renderRecentTransactions(transactions);
  }

  function getThisMonthTransactions(transactions) {
    const now = new Date();
    return transactions.filter((t) => {
      const d = new Date(`${t.date}T00:00:00`);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  function renderMonthSummary(transactions) {
    const monthTransactions = getThisMonthTransactions(transactions);
    const totals = MoneyFlow.calculateTotals(monthTransactions);

    setText("monthIncome", MoneyFlow.formatCurrency(totals.income));
    setText("monthRemaining", MoneyFlow.formatCurrency(totals.balance));

    // No debt-tracking feature exists yet — showing a real ₦0.00
    // rather than a fabricated number, with an honest subtitle
    // already set in the HTML ("Debt tracking is coming soon").
    setText("monthOwed", MoneyFlow.formatCurrency(0));

    const now = new Date();
    setText("monthPillLabel", now.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  }

  function renderBudgetStrip() {
    const settings = MoneyFlow.getSettings();
    setText("budgetStripAmount", MoneyFlow.formatCurrency(settings.monthlyBudget || 0));
  }

  function renderTransactionsHeading() {
    const now = new Date();
    const label = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    setText("transactionsHeading", `Transactions · ${label}`);
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

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

});
