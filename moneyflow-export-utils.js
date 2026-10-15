/* MoneyFlow 2.0 - local, read-only receipt and reporting helpers.
   Never uploads records and never modifies localStorage. */
(function () {
  "use strict";
  const KEYS = Object.freeze({
    transactions: "moneyflow_transactions",
    payments: "moneyflow_payments",
    debts: "moneyflow_debts",
    insurance: "moneyflow_insurance",
    recurringIncome: "moneyflow_income_repeat_rules"
  });

  function readList(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Saved " + key + " records cannot be read safely.");
    return parsed.filter(item => item && typeof item === "object" && !Array.isArray(item));
  }

  function getRecords() {
    return {transactions: readList(KEYS.transactions), payments: readList(KEYS.payments), debts: readList(KEYS.debts), insurance: readList(KEYS.insurance), recurringIncome: readList(KEYS.recurringIncome)};
  }

  function currencyCode() {
    try {
      const settings = JSON.parse(localStorage.getItem("moneyflow_settings") || "{}");
      return ["NGN", "USD", "GBP", "EUR"].includes(settings.currency) ? settings.currency : "NGN";
    } catch (_) { return "NGN"; }
  }
  function money(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "Amount unavailable";
    const code = currencyCode();
    try { return new Intl.NumberFormat("en-NG", {style:"currency", currency:code}).format(n); }
    catch (_) { return code + " " + n.toFixed(2); }
  }
  function text(value, fallback="—") {
    const s = String(value ?? "").trim();
    return s || fallback;
  }
  function localDate(value) {
    // Preserve YYYY-MM-DD (date-only) without timezone shifting the day.
    const s = String(value || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y,m,d] = s.split("-").map(Number);
      const dt = new Date(y, m-1, d);
      if (dt.getFullYear() === y && dt.getMonth() === m-1 && dt.getDate() === d) {
        return dt.toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"});
      }
    }
    if (!s) return "—";
    const dt = new Date(s);
    return Number.isFinite(dt.getTime()) ? dt.toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"}) : text(s);
  }
  function today() {
    const d = new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  }
  function paymentStatus(payment) {
    if (payment.status === "paid") return "Paid (self-reported)";
    return payment.dueDate && String(payment.dueDate) < today() ? "Overdue" : "Upcoming";
  }
  function findRecord(kind, id) {
    if (kind === "payment") return readList(KEYS.payments).find(p => String(p.id) === String(id)) || null;
    if (kind === "income" || kind === "expense") {
      return readList(KEYS.transactions).find(t => String(t.id) === String(id) && t.type === kind) || null;
    }
    return null;
  }
  function elt(tag, classes, value) {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    if (value !== undefined) el.textContent = String(value);
    return el;
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function csvCell(v) {
    let s = String(v ?? "");
    // Excel/Sheets may execute formulas on CSV import; neutralize input.
    if (/^\s*[=+\-@\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g,'""') + '"';
  }
  const csvRow = cols => cols.map(csvCell).join(",") + "\r\n";
  function receiptLink(kind, id) {
    return "receipt.html?type=" + encodeURIComponent(kind) + "&id=" + encodeURIComponent(String(id));
  }
  window.MoneyFlowDocs = {getRecords, findRecord, currencyCode, money, text, localDate, today, paymentStatus, elt, downloadBlob, csvRow, receiptLink};
})();
