
/* ============================================
   MONEYFLOW — PAYMENTS PAGE
   AMOLED EMERALD EDITION

   Requires core.js before payments.js.
   Storage key: moneyflow_payments

   Safeguards:
   - Never overwrite unreadable saved payments.
   - Refresh custom dropdowns after form reset.
   - Re-read data after delete confirmation.
   ============================================ */

const PAYMENTS_KEY = "moneyflow_payments";

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const MF = MoneyFlow;
  const $ = (id) => document.getElementById(id);

  document.documentElement.classList.add("dark");
  applyStatusBarColor();
  applyAvatar();
  bindEvents();
  render();

  window.addEventListener("pageshow", () => {
    applyAvatar();
    render();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === PAYMENTS_KEY || event.key === null) {
      render();
    }
  });

  /* ---------------- HEADER ---------------- */

  function applyStatusBarColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#09090f");
  }

  function applyAvatar() {
    const settings = MF.getSettings() || {};
    const user = MF.getAuthUser() || {};
    const source = String(
      settings.userName ||
      user.name ||
      user.fullName ||
      user.firstName ||
      user.email ||
      "M"
    ).trim();

    const avatar = $("userAvatar");
    if (avatar) avatar.textContent = source.charAt(0).toUpperCase() || "M";
  }

  /* ---------------- DATES ---------------- */

  function todayDate() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  /* ---------------- STORAGE ---------------- */

  function getPayments() {
    try {
      const raw = localStorage.getItem(PAYMENTS_KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error("Payments data is not an array.");
      }
      return parsed;
    } catch (error) {
      console.error("Unable to read saved payments:", error);
      return null; // Don't treat unreadable saved data as an empty list.
    }
  }

  function savePayments(payments) {
    try {
      if (!Array.isArray(payments)) {
        throw new Error("Refusing to save invalid payments list.");
      }
      const raw = localStorage.getItem(PAYMENTS_KEY);
      if (raw !== null && !Array.isArray(JSON.parse(raw))) {
        throw new Error("Existing payment records are unreadable.");
      }
      localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
      return true;
    } catch (error) {
      console.error("Unable to save payments; existing records preserved:", error);
      MF.showToast("Payment records could not be saved safely.", "error");
      return false;
    }
  }

  function showStorageError() {
    MF.showToast("Saved payments could not be read. Nothing was changed.", "error");
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function getEffectiveStatus(payment) {
    if (payment.status === "paid") return "paid";
    return validDate(payment.dueDate) && payment.dueDate < todayDate()
      ? "overdue"
      : "upcoming";
  }

  /* ---------------- EVENT HANDLERS ---------------- */

  function bindEvents() {
    $("addPaymentBtn")?.addEventListener("click", openPaymentModal);
    $("emptyAddPaymentBtn")?.addEventListener("click", openPaymentModal);
    $("closePaymentModalBtn")?.addEventListener("click", closePaymentModal);
    $("cancelPaymentBtn")?.addEventListener("click", closePaymentModal);

    $("paymentModal")?.addEventListener("click", (event) => {
      if (event.target === $("paymentModal")) closePaymentModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePaymentModal();
    });

    $("paymentForm")?.addEventListener("submit", handleFormSubmit);

    $("paymentsList")?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const paidButton = target.closest("[data-mark-paid]");
      if (paidButton) {
        markAsPaid(paidButton.dataset.markPaid);
        return;
      }

      const deleteButton = target.closest("[data-delete-payment]");
      if (deleteButton) handleDelete(deleteButton.dataset.deletePayment);
    });

    // New payments.html uses normal links, which already navigate.
    // Support any older button-based HTML kept in the PWA cache.
    bindLegacyNavigation();
  }

  function bindLegacyNavigation() {
    const routes = {
      navHome: "home.html",
      navSpending: "spending.html",
      navDebts: "debts.html",
      navMore: "settings.html" // Until more.html exists.
    };

    Object.entries(routes).forEach(([id, href]) => {
      const button = $(id);
      if (button?.tagName === "BUTTON") {
        button.addEventListener("click", () => {
          location.href = href;
        });
      }
    });

    const oldHistory = $("navHistory");
    if (oldHistory?.tagName === "BUTTON") {
      const label = oldHistory.querySelector("span");
      if (label) label.textContent = "Debts";
      oldHistory.setAttribute("aria-label", "Open Debt Tracker");
      oldHistory.addEventListener("click", () => {
        location.href = "debts.html";
      });
    }
  }

  /* ---------------- ADD PAYMENT MODAL ---------------- */

  function openPaymentModal() {
    const modal = $("paymentModal");
    const form = $("paymentForm");
    if (!modal) return;

    if (form) {
      form.reset();
      // core.js enhances select elements with custom dropdowns.
      // Reset their visible labels as well as their original values.
      form.querySelectorAll("select").forEach((select) => {
        if (typeof select.moneyflowRefresh === "function") {
          select.moneyflowRefresh();
        }
      });
    }

    const dueDate = $("paymentDueDate");
    if (dueDate) dueDate.value = todayDate();

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("active");
    setTimeout(() => $("paymentName")?.focus(), 100);
  }

  function closePaymentModal() {
    const modal = $("paymentModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("active");
  }

  /* ---------------- SAVE NEW PAYMENT ---------------- */

  function handleFormSubmit(event) {
    event.preventDefault();

    const title = ($("paymentName")?.value || "").trim();
    const amount = Number($("paymentAmount")?.value);
    const category = $("paymentCategory")?.value || "Other";
    const dueDate = $("paymentDueDate")?.value;
    const frequency = $("paymentFrequency")?.value || "one-time";

    if (!title) {
      MF.showToast("Please enter a payment name.", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      MF.showToast("Please enter a valid amount.", "error");
      return;
    }
    if (!validDate(dueDate)) {
      MF.showToast("Please choose a valid due date.", "error");
      return;
    }

    const payments = getPayments();
    if (payments === null) {
      showStorageError();
      return;
    }

    payments.push({
      id: generateId(),
      title,
      amount,
      category,
      dueDate,
      status: "upcoming",
      recurring: frequency !== "one-time",
      frequency,
      paidDate: null,
      createdAt: new Date().toISOString()
    });

    if (!savePayments(payments)) return;
    closePaymentModal();
    render();
    MF.showToast("Payment added successfully.");
  }

  /* ---------------- MARK AS PAID ---------------- */

  function markAsPaid(id) {
    const payments = getPayments();
    if (payments === null) return showStorageError();

    const payment = payments.find((item) =>
      item && String(item.id) === String(id)
    );
    if (!payment || payment.status === "paid") return;

    payment.status = "paid";
    payment.paidDate = todayDate();

    if (!savePayments(payments)) return;
    render();
    MF.showToast(`${payment.title || "Payment"} marked as paid.`);
  }

  /* ---------------- DELETE PAYMENT ---------------- */

  async function handleDelete(id) {
    const payments = getPayments();
    if (payments === null) return showStorageError();

    const payment = payments.find((item) =>
      item && String(item.id) === String(id)
    );
    if (!payment) return;

    const confirmed = await MF.showConfirm({
      message: `Delete "${payment.title || "Payment"}"? This cannot be undone.`,
      confirmText: "Delete"
    });
    if (!confirmed) return;

    // Data may have changed in another tab while confirmation was open.
    const latest = getPayments();
    if (latest === null) return showStorageError();
    const remaining = latest.filter((item) =>
      !item || String(item.id) !== String(id)
    );
    if (remaining.length === latest.length) return;

    if (!savePayments(remaining)) return;
    render();
    MF.showToast("Payment deleted.");
  }

  /* ---------------- RENDER ---------------- */

  function render() {
    const payments = getPayments();
    if (payments === null) {
      setText("totalOutstanding", "—");
      setText("overdueCount", "—");
      setText("upcomingCount", "—");
      setText("paidCount", "—");
      const list = $("paymentsList");
      if (list) {
        list.innerHTML = `
          <div class="empty-state">
            <h3>Unable to load payments</h3>
            <p>Your saved data has not been changed. Please check your app storage.</p>
          </div>`;
      }
      return;
    }
    renderHero(payments);
    renderList(payments);
  }

  function renderHero(payments) {
    let outstanding = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let paidCount = 0;

    payments.forEach((payment) => {
      if (!payment || typeof payment !== "object") return;
      const status = getEffectiveStatus(payment);
      const amount = Number(payment.amount);

      if (status === "paid") {
        paidCount++;
      } else {
        if (Number.isFinite(amount) && amount > 0) outstanding += amount;
        if (status === "overdue") overdueCount++;
        else upcomingCount++;
      }
    });

    setText("totalOutstanding", MF.formatCurrency(outstanding));
    setText("overdueCount", overdueCount);
    setText("upcomingCount", upcomingCount);
    setText("paidCount", paidCount);
  }

  function renderList(payments) {
    const list = $("paymentsList");
    if (!list) return;

    const items = payments.filter((payment) =>
      payment && typeof payment === "object"
    );

    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>No payments yet</h3>
          <p>Add a bill or upcoming payment to start tracking it here.</p>
          <button type="button" id="emptyAddPaymentBtn" class="primary-button">
            Add Payment
          </button>
        </div>`;
      $("emptyAddPaymentBtn")?.addEventListener("click", openPaymentModal);
      return;
    }

    const sorted = [...items].sort((a, b) =>
      String(a.dueDate || "").localeCompare(String(b.dueDate || ""))
    );
    list.innerHTML = sorted.map(buildPaymentItemHTML).join("");
  }

  function escapeAttribute(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;");
  }

  function buildPaymentItemHTML(payment) {
    const status = getEffectiveStatus(payment);
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const title = MF.escapeHTML(String(payment.title || "Payment"));
    const category = MF.escapeHTML(String(payment.category || "Other"));
    const safeId = escapeAttribute(payment.id);
    const dateLabel = validDate(payment.dueDate)
      ? MF.escapeHTML(MF.formatDate(payment.dueDate))
      : "No due date";

    return `
      <div class="payment-item">
        <div class="payment-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2"
              stroke="currentColor" stroke-width="1.8"/>
            <path d="M3 10H21" stroke="currentColor" stroke-width="1.8"/>
          </svg>
        </div>
        <div class="payment-details">
          <strong>${title}</strong>
          <span>${category} · ${dateLabel}</span>
        </div>
        <div class="payment-meta">
          <span class="payment-amount">${MF.formatCurrency(payment.amount)}</span>
          <span class="payment-status status-${status}">${statusLabel}</span>
        </div>
        <div class="payment-actions">
          ${status === "paid" ? `
            <a class="payment-action-btn mf-paid-receipt" href="receipt.html?type=payment&amp;id=${encodeURIComponent(String(payment.id))}"
               aria-label="Receipt for ${escapeAttribute(payment.title || "payment")}" title="View receipt">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M9 8h6M9 12h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              </svg>
            </a>` : ""}
          ${status !== "paid" ? `
            <button type="button" class="payment-action-btn"
              data-mark-paid="${safeId}" aria-label="Mark as paid" title="Mark as paid">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>` : ""}
          <button type="button" class="payment-action-btn danger"
            data-delete-payment="${safeId}" aria-label="Delete payment" title="Delete">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 7H20M9 7V4H15V7M6 7L7 20H17L18 7"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>`;
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value);
  }
});
