
/* ============================================
   MONEYFLOW — BUDGET PAGE
   Reads existing records; only writes the
   monthlyBudget field in moneyflow_settings.
   Requires core.js before budget.js.
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const MF = typeof MoneyFlow !== "undefined" ? MoneyFlow : null;
  const $ = (id) => document.getElementById(id);

  if (!MF || typeof MF.getSettings !== "function" ||
      typeof MF.saveSettings !== "function") {
    console.error("Budget: MoneyFlow core.js is unavailable.");
    showWarning("The budget service could not load. No data was changed.");
    return;
  }

  document.documentElement.classList.add("dark");

  const today = new Date();
  const currentMonth =
    today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0");

  const moneyFormatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const percentFormatter = new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 1
  });

  const money = (value) => moneyFormatter.format(value);
  const percent = (value) => percentFormatter.format(value);

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value);
  }

  function showWarning(message) {
    const element = $("budgetDataWarning");
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
  }

  function showFeedback(message, isError = false) {
    const element = $("budgetFormFeedback");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  // Validate raw storage before using the shared getters.
  // Never replace damaged or unreadable financial data with [].
  function readRecords(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return { data: [], error: false };

      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        throw new Error(storageKey + " does not contain an array.");
      }
      return { data, error: false };
    } catch (error) {
      console.error("Budget: Unable to read " + storageKey, error);
      return { data: [], error: true };
    }
  }

  function readSettings() {
    try {
      const raw = localStorage.getItem("moneyflow_settings");
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" ||
            Array.isArray(parsed)) {
          throw new Error("Saved settings are not a valid object.");
        }
      }
      return MF.getSettings();
    } catch (error) {
      console.error("Budget: Unable to read settings", error);
      return null;
    }
  }

  function validDate(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day;
  }

  function validAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  function getCategory(item) {
    return typeof item.category === "string" && item.category.trim()
      ? item.category.trim().slice(0, 80)
      : "Other";
  }

  function paidThisMonth(records) {
    const result = [];
    let missingDateCount = 0;

    for (const item of records) {
      if (!item || typeof item !== "object" ||
          item.status !== "paid") continue;

      const amount = validAmount(item.amount);
      if (!amount) continue;

      if (!validDate(item.paidDate)) {
        missingDateCount++;
        continue;
      }
      if (item.paidDate.slice(0, 7) !== currentMonth) continue;

      result.push({ category: getCategory(item), amount });
    }
    return { entries: result, missingDateCount };
  }

  function spendingThisMonth(records) {
    const result = [];
    for (const item of records) {
      if (!item || typeof item !== "object" ||
          item.type !== "expense" ||
          !validDate(item.date) ||
          item.date.slice(0, 7) !== currentMonth) continue;

      const amount = validAmount(item.amount);
      if (!amount) continue;

      result.push({ category: getCategory(item), amount });
    }
    return result;
  }

  function totalOf(entries) {
    return entries.reduce((sum, item) => sum + item.amount, 0);
  }

  function emptyCategory(container, message) {
    container.replaceChildren();
    const box = document.createElement("div");
    box.className = "budget-empty-state";
    const text = document.createElement("p");
    text.textContent = message;
    box.appendChild(text);
    container.appendChild(box);
  }

  // Create text nodes (not HTML strings), so category names
  // from saved records cannot inject markup or scripts.
  function renderCategories(id, entries, kind, hasError) {
    const container = $(id);
    if (!container) return;

    if (hasError) {
      emptyCategory(container, "Unable to read saved " + kind + " records.");
      return;
    }
    if (!entries.length) {
      emptyCategory(
        container,
        kind === "Payments"
          ? "No paid payments recorded this month yet."
          : "No spending recorded this month yet."
      );
      return;
    }

    const totals = new Map();
    for (const entry of entries) {
      totals.set(
        entry.category,
        (totals.get(entry.category) || 0) + entry.amount
      );
    }

    const grandTotal = totalOf(entries);
    const fragment = document.createDocumentFragment();

    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, amount] of sorted) {
      const share = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;

      const card = document.createElement("article");
      card.className = "budget-category-item";

      const heading = document.createElement("div");
      heading.className = "budget-category-head";

      const title = document.createElement("h3");
      title.className = "budget-category-name";
      title.textContent = name;

      const value = document.createElement("strong");
      value.className = "budget-category-amount";
      value.textContent = money(amount);

      heading.append(title, value);

      const track = document.createElement("div");
      track.className = "budget-category-track";
      const fill = document.createElement("div");
      fill.className = "budget-category-fill";
      if (kind === "Spending") fill.classList.add("spending");
      fill.style.width = Math.min(100, share) + "%";
      track.appendChild(fill);

      const footer = document.createElement("div");
      footer.className = "budget-category-meta";
      const label = document.createElement("span");
      label.textContent = "Share of " + kind.toLowerCase();
      const ratio = document.createElement("span");
      ratio.className = "budget-category-percent";
      ratio.textContent = percent(share) + "%";
      footer.append(label, ratio);

      card.append(heading, track, footer);
      fragment.appendChild(card);
    }

    container.replaceChildren(fragment);
  }

  function renderOverview(budget, paymentTotal, spendingTotal) {
    const total = paymentTotal + spendingTotal;
    const progress = budget > 0 ? (total / budget) * 100 : 0;
    const overBudget = budget > 0 && total > budget;

    setText("monthlyBudgetValue", money(budget));
    setText("budgetPaymentsTotal", money(paymentTotal));
    setText("budgetSpendingTotal", money(spendingTotal));

    setText("budgetPaymentsPercent",
      percent(total ? (paymentTotal / total) * 100 : 0) + "% of spend");
    setText("budgetSpendingPercent",
      percent(total ? (spendingTotal / total) * 100 : 0) + "% of spend");

    const track = $("budgetProgressTrack");
    const fill = $("budgetProgressFill");
    if (fill) {
      fill.style.width = Math.min(100, Math.max(0, progress)) + "%";
      fill.classList.toggle("over-budget", overBudget);
    }
    if (track) {
      track.setAttribute("aria-valuenow",
        String(Math.min(100, Math.max(0, progress))));
      track.setAttribute("aria-valuetext",
        money(total) + " spent out of " + money(budget));
    }

    if (budget <= 0) {
      setText("budgetSpentSummary", money(total) + " spent (no budget set)");
      setText("budgetRemainingSummary",
        "Set a monthly budget to see your remaining limit.");
    } else {
      setText("budgetSpentSummary",
        money(total) + " spent (" + percent(progress) + "%)");
      setText("budgetRemainingSummary",
        overBudget
          ? money(total - budget) + " over budget"
          : money(budget - total) + " remaining");
    }

    $("budgetRemainingSummary")?.classList.toggle("over-budget", overBudget);
  }

  function renderUnavailable(settings, payments, spending) {
    const budgetValue = settings ? Number(settings.monthlyBudget) : NaN;
    setText("monthlyBudgetValue",
      Number.isFinite(budgetValue) && budgetValue >= 0
        ? money(budgetValue) : "—");
    setText("budgetPaymentsTotal", payments.error ? "—" : money(totalOf(payments.entries)));
    setText("budgetSpendingTotal", spending.error ? "—" : money(totalOf(spending.entries)));
    setText("budgetPaymentsPercent", "Total unavailable");
    setText("budgetSpendingPercent", "Total unavailable");
    setText("budgetSpentSummary", "Unable to calculate monthly total");
    setText("budgetRemainingSummary", "Please check the saved-data warning above.");
    const track = $("budgetProgressTrack");
    if (track) {
      track.setAttribute("aria-valuenow", "0");
      track.setAttribute("aria-valuetext", "Budget data unavailable");
    }
    const fill = $("budgetProgressFill");
    if (fill) {
      fill.style.width = "0%";
      fill.classList.remove("over-budget");
    }
    $("budgetRemainingSummary")?.classList.remove("over-budget");
  }

  function render(updateInput = false) {
    const settings = readSettings();
    const paymentsRaw = readRecords("moneyflow_payments");
    const spendingRaw = readRecords("moneyflow_transactions");
    const payments = paidThisMonth(paymentsRaw.data);
    const spending = spendingThisMonth(spendingRaw.data);

    const warnings = [];
    if (!settings) warnings.push("Saved settings could not be read.");
    if (paymentsRaw.error) warnings.push("Saved Payments records could not be read.");
    if (spendingRaw.error) warnings.push("Saved Spending records could not be read.");
    if (!paymentsRaw.error && payments.missingDateCount) {
      warnings.push(
        payments.missingDateCount + " paid payment(s) have no valid paid date " +
        "and cannot be assigned to this month."
      );
    }

    const parsedBudget = settings ? Number(settings.monthlyBudget) : NaN;
    const validBudget = Number.isFinite(parsedBudget) && parsedBudget >= 0;
    if (settings && !validBudget) {
      warnings.push("The saved monthly budget amount is invalid.");
    }
    if (warnings.length) warnings.push("No saved records were changed.");
    showWarning(warnings.join(" "));

    const paymentsData = {
      entries: payments.entries,
      error: paymentsRaw.error
    };
    const spendingData = {
      entries: spending,
      error: spendingRaw.error
    };

    renderCategories("budgetPaymentsCategories", payments.entries,
      "Payments", paymentsRaw.error);
    renderCategories("budgetSpendingCategories", spending,
      "Spending", spendingRaw.error);

    if (!settings || !validBudget || paymentsRaw.error || spendingRaw.error) {
      renderUnavailable(settings, paymentsData, spendingData);
    } else {
      renderOverview(parsedBudget, totalOf(payments.entries), totalOf(spending));
    }

    const saveButton = $("updateBudgetBtn");
    if (saveButton) saveButton.disabled = !settings;
    if (updateInput && settings && validBudget) {
      const field = $("budgetAmount");
      if (field) field.value = String(parsedBudget);
    }
  }

  $("budgetForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    showFeedback("");

    const field = $("budgetAmount");
    const raw = field?.value.trim() || "";
    const amount = Number(raw);

    if (!field || raw === "" || !field.checkValidity() ||
        !Number.isFinite(amount) || amount < 0 ||
        amount > Number.MAX_SAFE_INTEGER) {
      showFeedback("Enter a valid monthly budget amount.", true);
      field?.focus();
      return;
    }

    const settings = readSettings();
    if (!settings) {
      showFeedback("Saved settings could not be read. Nothing was changed.", true);
      render();
      return;
    }

    const saved = MF.saveSettings({ ...settings, monthlyBudget: amount });
    if (!saved) {
      showFeedback("Could not save the budget. Please try again.", true);
      return;
    }

    render(true);
    showFeedback(amount === 0
      ? "Monthly budget removed successfully."
      : "Monthly budget updated successfully.");
    MF.showToast?.("Monthly budget saved.");
  });

  setText("budgetPeriod", today.toLocaleDateString("en-GB", {
    month: "long", year: "numeric"
  }));
  render(true);

  window.addEventListener("pageshow", () => render(false));
  window.addEventListener("storage", (event) => {
    if (!event.key || ["moneyflow_settings", "moneyflow_payments",
        "moneyflow_transactions"].includes(event.key)) {
      render(true);
    }
  });
});
