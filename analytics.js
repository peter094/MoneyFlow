/* =====================================================================
   MONEYFLOW — ANALYTICS PAGE
   Depends on core.js (load it first). Handles only what's specific
   to analytics.html: key metrics, cash flow bars, category
   breakdown, insights, and the monthly overview.
   ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {

  const CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Shopping", "Other"];

  MoneyFlow.initTheme();
  MoneyFlow.bindThemeToggle();
  render();
  MoneyFlow.onExternalChange(render);

  /* ---------------- Render ---------------- */

  function render() {
    const transactions = MoneyFlow.getTransactions();
    const income = transactions.filter((t) => t.type === "income");
    const expenses = transactions.filter((t) => t.type === "expense");
    const totals = MoneyFlow.calculateTotals(transactions);
    const savingsRate = totals.income > 0 ? (totals.balance / totals.income) * 100 : 0;

    renderKeyMetrics(totals, savingsRate);
    renderCashFlow(totals);
    const categoryTotals = renderCategoryBreakdown(expenses);
    renderInsights(totals, expenses, savingsRate, categoryTotals);
    renderMonthlyOverview(transactions);
  }

  function renderKeyMetrics(totals, savingsRate) {
    setText("analyticsBalance", MoneyFlow.formatCurrency(totals.balance));
    setText("analyticsIncome", MoneyFlow.formatCurrency(totals.income));
    setText("analyticsExpenses", MoneyFlow.formatCurrency(totals.expenses));
    setText("savingsRate", `${MoneyFlow.formatPercent(savingsRate)}%`);
  }

  function renderCashFlow(totals) {
    const max = Math.max(totals.income, totals.expenses, 1);
    const incomePct = clampPercent((totals.income / max) * 100);
    const expensePct = clampPercent((totals.expenses / max) * 100);

    setWidth("incomeBar", incomePct);
    setWidth("expenseBar", expensePct);

    setText("incomeChartAmount", MoneyFlow.formatShortCurrency(totals.income));
    setText("expenseChartAmount", MoneyFlow.formatShortCurrency(totals.expenses));
  }

  function renderCategoryBreakdown(expenses) {
    const totals = MoneyFlow.calculateCategoryTotals(expenses);
    const maxCategoryTotal = Math.max(...CATEGORIES.map((c) => totals[c] || 0), 1);

    CATEGORIES.forEach((cat) => {
      const amount = totals[cat] || 0;
      const pct = clampPercent((amount / maxCategoryTotal) * 100);

      setWidth(`analytics${cat}Progress`, pct);
      setText(`analytics${cat}Amount`, MoneyFlow.formatShortCurrency(amount));
    });

    return totals;
  }

  function renderInsights(totals, expenses, savingsRate, categoryTotals) {
    const savingsEl = document.getElementById("savingsInsight");
    if (savingsEl) {
      if (totals.income === 0) {
        savingsEl.textContent = "Add transactions to see your savings rate.";
      } else if (savingsRate >= 20) {
        savingsEl.textContent = `You're saving ${MoneyFlow.formatPercent(savingsRate)}% of your income — great habit.`;
      } else if (savingsRate >= 0) {
        savingsEl.textContent = `You're saving ${MoneyFlow.formatPercent(savingsRate)}% of your income. Aim for 20% or more.`;
      } else {
        savingsEl.textContent = `You're spending ${MoneyFlow.formatPercent(Math.abs(savingsRate))}% more than you earn.`;
      }
    }

    const topEl = document.getElementById("highestCategoryInsight");
    if (topEl) {
      const entries = Object.entries(categoryTotals).filter(([, v]) => v > 0);
      if (entries.length === 0) {
        topEl.textContent = "Your highest spending category will appear here.";
      } else {
        const [topCategory, topAmount] = entries.sort((a, b) => b[1] - a[1])[0];
        topEl.textContent = `${topCategory} is your top expense at ${MoneyFlow.formatCurrency(topAmount)}.`;
      }
    }

    const avgEl = document.getElementById("averageExpenseInsight");
    if (avgEl) {
      if (expenses.length === 0) {
        avgEl.textContent = "Your average expense will appear here.";
      } else {
        const avg = totals.expenses / expenses.length;
        avgEl.textContent = `You spend an average of ${MoneyFlow.formatCurrency(avg)} per expense.`;
      }
    }

    const statusEl = document.getElementById("financialStatusInsight");
    if (statusEl) {
      if (totals.income === 0 && totals.expenses === 0) {
        statusEl.textContent = "Add transactions to analyze your financial health.";
      } else if (totals.balance > 0) {
        statusEl.textContent = `You're in good shape — ${MoneyFlow.formatCurrency(totals.balance)} ahead this period.`;
      } else if (totals.balance === 0) {
        statusEl.textContent = "You're breaking even this period.";
      } else {
        statusEl.textContent = `You're ${MoneyFlow.formatCurrency(Math.abs(totals.balance))} in the red this period.`;
      }
    }
  }

  function renderMonthlyOverview(transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthly = transactions.filter((t) => {
      const d = new Date(`${t.date}T00:00:00`);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyTotals = MoneyFlow.calculateTotals(monthly);

    setText("monthlyIncome", MoneyFlow.formatCurrency(monthlyTotals.income));
    setText("monthlyExpenses", MoneyFlow.formatCurrency(monthlyTotals.expenses));
    setText("monthlySavings", MoneyFlow.formatCurrency(monthlyTotals.balance));

    const savingsEl = document.getElementById("monthlySavings");
    if (savingsEl) {
      savingsEl.classList.remove("income", "expense");
      savingsEl.classList.add(monthlyTotals.balance >= 0 ? "income" : "expense");
    }
  }

  /* ---------------- Helpers ---------------- */

  function clampPercent(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${pct}%`;
  }

});
