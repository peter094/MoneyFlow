/* =====================================================================
   MONEYFLOW — PAYMENTS PAGE
   Depends on core.js (load it first). Path A implementation: payments
   are stored entirely in localStorage under their own key, separate
   from moneyflow_transactions — a payment is a future obligation with
   a due date and a status, not a completed money movement, so it
   deliberately doesn't reuse the transaction data shape.

   NOTE: this page's Add Payment modal is self-contained (its own
   open/close logic below) rather than reusing MoneyFlow.openModal()/
   closeModal() from core.js — those are hardcoded to #transactionModal
   specifically. Extending them to a second modal, or extending the
   Android back-button-closes-modal handling to cover this one too,
   would mean editing core.js, which is out of scope for this pass.
   Known minor gap: pressing back while this modal is open does not
   close it first the way the transaction modal does.
   ===================================================================== */

const PAYMENTS_KEY = "moneyflow_payments";

document.addEventListener("DOMContentLoaded", () => {

  applyStatusBarColor();
  applyAvatar();
  bindEvents();
  render();

  window.addEventListener("storage", (event) => {
    if (event.key === PAYMENTS_KEY) render();
  });

  /* ---------------- Header (matches Home's pattern) ---------------- */

  function applyStatusBarColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#090E17");
  }

  function applyAvatar() {
    const nameFromSettings = MoneyFlow.getSettings()?.userName?.trim();
    const nameFromAccount = MoneyFlow.getAuthUser()?.name?.trim();
    const source = nameFromSettings || nameFromAccount || MoneyFlow.getAuthUser()?.email || "?";
    const initial = source.charAt(0).toUpperCase();

    const avatar = document.getElementById("userAvatar");
    if (avatar) avatar.textContent = initial;
  }

  /* ---------------- Storage ---------------- */

  function getPayments() {
    try {
      const raw = localStorage.getItem(PAYMENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("MoneyFlow: Unable to load payments.", error);
      return [];
    }
  }

  function savePayments(payments) {
    try {
      localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
      return true;
    } catch (error) {
      console.error("MoneyFlow: Unable to save payments.", error);
      return false;
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  // The stored status is only ever "upcoming" or "paid" — set by an
  // actual user action (Mark as Paid). "Overdue" is never stored; it's
  // computed here at render time from today's date vs. the due date.
  // That avoids needing a background job to flip statuses over time,
  // which a frontend-only, no-backend layer can't do reliably anyway.
  function getEffectiveStatus(payment) {
    if (payment.status === "paid") return "paid";
    const today = new Date().toISOString().split("T")[0];
    return payment.dueDate < today ? "overdue" : "upcoming";
  }

  /* ---------------- Events ---------------- */

  function bindEvents() {
    const addPaymentBtn = document.getElementById("addPaymentBtn");
    if (addPaymentBtn) addPaymentBtn.addEventListener("click", () => openPaymentModal());

    const emptyAddPaymentBtn = document.getElementById("emptyAddPaymentBtn");
    if (emptyAddPaymentBtn) emptyAddPaymentBtn.addEventListener("click", () => openPaymentModal());

    const closeBtn = document.getElementById("closePaymentModalBtn");
    if (closeBtn) closeBtn.addEventListener("click", closePaymentModal);

    const cancelBtn = document.getElementById("cancelPaymentBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", closePaymentModal);

    const modal = document.getElementById("paymentModal");
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closePaymentModal();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePaymentModal();
    });

    const form = document.getElementById("paymentForm");
    if (form) form.addEventListener("submit", handleFormSubmit);

    const list = document.getElementById("paymentsList");
    if (list) {
      list.addEventListener("click", (event) => {
        const paidBtn = event.target.closest("[data-mark-paid]");
        if (paidBtn) markAsPaid(paidBtn.getAttribute("data-mark-paid"));

        const deleteBtn = event.target.closest("[data-delete-payment]");
        if (deleteBtn) handleDelete(deleteBtn.getAttribute("data-delete-payment"));
      });
    }

    // Bottom nav bridging — same pattern as Home. Payments/Debts are
    // truly not built yet, so a toast is more honest than a dead link.
    const navHome = document.getElementById("navHome");
    if (navHome) navHome.addEventListener("click", () => (window.location.href = "index.html"));

    const navSpending = document.getElementById("navSpending");
    if (navSpending) navSpending.addEventListener("click", () => (window.location.href = "analytics.html"));

    const navDebts = document.getElementById("navDebts");
    if (navDebts) navDebts.addEventListener("click", () => MoneyFlow.showToast("Debts is coming soon."));

    const navMore = document.getElementById("navMore");
    if (navMore) navMore.addEventListener("click", () => (window.location.href = "settings.html"));
  }

  /* ---------------- Modal ---------------- */

  function openPaymentModal() {
    const modal = document.getElementById("paymentModal");
    const form = document.getElementById("paymentForm");
    if (!modal) return;

    if (form) form.reset();

    const dueDateInput = document.getElementById("paymentDueDate");
    if (dueDateInput) {
      const today = new Date();
      dueDateInput.value = today.toISOString().split("T")[0];
    }

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("active");

    const nameInput = document.getElementById("paymentName");
    if (nameInput) setTimeout(() => nameInput.focus(), 100);
  }

  function closePaymentModal() {
    const modal = document.getElementById("paymentModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("active");
  }

  /* ---------------- Form submit ---------------- */

  function handleFormSubmit(event) {
    event.preventDefault();

    const name = document.getElementById("paymentName")?.value.trim();
    const amount = Number(document.getElementById("paymentAmount")?.value);
    const category = document.getElementById("paymentCategory")?.value;
    const dueDate = document.getElementById("paymentDueDate")?.value;
    const frequency = document.getElementById("paymentFrequency")?.value;

    if (!name) return MoneyFlow.showToast("Please enter a payment name.", "error");
    if (!Number.isFinite(amount) || amount <= 0) {
      return MoneyFlow.showToast("Please enter a valid amount.", "error");
    }
    if (!dueDate) return MoneyFlow.showToast("Please choose a due date.", "error");

    const payments = getPayments();

    payments.push({
      id: generateId(),
      title: name,
      amount,
      category,
      dueDate,
      status: "upcoming",
      recurring: frequency !== "one-time",
      frequency,
      paidDate: null,
      createdAt: new Date().toISOString(),
    });

    if (!savePayments(payments)) {
      return MoneyFlow.showToast("Unable to save the payment. Please try again.", "error");
    }

    closePaymentModal();
    render();
    MoneyFlow.showToast("Payment added.");
  }

  /* ---------------- Mark as paid / delete ---------------- */

  function markAsPaid(id) {
    const payments = getPayments();
    const payment = payments.find((p) => p.id === id);
    if (!payment) return;

    payment.status = "paid";
    payment.paidDate = new Date().toISOString().split("T")[0];

    savePayments(payments);
    render();
    MoneyFlow.showToast(`${payment.title} marked as paid.`);
  }

  async function handleDelete(id) {
    const payments = getPayments();
    const payment = payments.find((p) => p.id === id);
    if (!payment) return;

    const confirmed = await MoneyFlow.showConfirm({
      message: `Delete "${payment.title}"? This cannot be undone.`,
      confirmText: "Delete",
    });
    if (!confirmed) return;

    savePayments(payments.filter((p) => p.id !== id));
    render();
    MoneyFlow.showToast("Payment deleted.");
  }

  /* ---------------- Render ---------------- */

  function render() {
    const payments = getPayments();
    renderHero(payments);
    renderList(payments);
  }

  function renderHero(payments) {
    let outstanding = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    let paidCount = 0;

    payments.forEach((p) => {
      const status = getEffectiveStatus(p);
      if (status === "paid") {
        paidCount++;
      } else {
        outstanding += p.amount;
        if (status === "overdue") overdueCount++;
        else upcomingCount++;
      }
    });

    setText("totalOutstanding", MoneyFlow.formatCurrency(outstanding));
    setText("overdueCount", overdueCount);
    setText("upcomingCount", upcomingCount);
    setText("paidCount", paidCount);
  }

  function renderList(payments) {
    const list = document.getElementById("paymentsList");
    if (!list) return;

    if (payments.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>No payments yet</h3>
          <p>Add a bill or upcoming payment to start tracking it here.</p>
          <button id="emptyAddPaymentBtn" class="primary-button">Add Payment</button>
        </div>
      `;
      const btn = document.getElementById("emptyAddPaymentBtn");
      if (btn) btn.addEventListener("click", () => openPaymentModal());
      return;
    }

    const sorted = [...payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    list.innerHTML = sorted.map(buildPaymentItemHTML).join("");
  }

  function buildPaymentItemHTML(payment) {
    const status = getEffectiveStatus(payment);
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    return `
      <div class="payment-item">
        <div class="payment-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/>
            <path d="M3 10H21" stroke="currentColor" stroke-width="1.8"/>
          </svg>
        </div>

        <div class="payment-details">
          <strong>${MoneyFlow.escapeHTML(payment.title)}</strong>
          <span>${MoneyFlow.escapeHTML(payment.category)} · ${MoneyFlow.formatDate(payment.dueDate)}</span>
        </div>

        <div class="payment-meta">
          <span class="payment-amount">${MoneyFlow.formatCurrency(payment.amount)}</span>
          <span class="payment-status status-${status}">${statusLabel}</span>
        </div>

        <div class="payment-actions">
          ${
            status !== "paid"
              ? `<button class="payment-action-btn" data-mark-paid="${payment.id}" aria-label="Mark as paid" title="Mark as paid">
                   <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                   </svg>
                 </button>`
              : ""
          }
          <button class="payment-action-btn danger" data-delete-payment="${payment.id}" aria-label="Delete payment" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7H20M9 7V4H15V7M6 7L7 20H17L18 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

});
