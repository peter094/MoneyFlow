document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const M = window.MoneyFlowDocs;
  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    const error = document.getElementById("exportError");
    error.hidden = true;
    try {
      const {transactions,payments,debts,insurance,recurringIncome} = M.getRecords();
      const lines = [M.csvRow(["Record type", "Description", "Amount", "Currency", "Category", "Date", "Status", "Reference", "Due date", "Notes"])];
      transactions.forEach(t => {
        if (t.type !== "income" && t.type !== "expense") return;
        lines.push(M.csvRow([
          t.type === "income" ? "Income" : "Spending",
          t.description || "", Number.isFinite(Number(t.amount)) ? Number(t.amount).toFixed(2) : "",
          M.currencyCode(), t.category || "", t.date || "", "Recorded", t.id || "", "", t.notes || ""
        ]));
      });
      payments.forEach(p => lines.push(M.csvRow([
        "Payment", p.title || "", Number.isFinite(Number(p.amount)) ? Number(p.amount).toFixed(2) : "",
        M.currencyCode(), p.category || "", p.status === "paid" ? (p.paidDate || p.dueDate || "") : "",
        M.paymentStatus(p), p.id || "", p.dueDate || "", ""
      ])));
      debts.forEach(d => {
        const repaid = (Array.isArray(d.repayments) ? d.repayments : []).reduce((sum,r) => sum + (Number.isFinite(Number(r.amount)) ? Number(r.amount) : 0), 0);
        const original = Number(d.amount);
        lines.push(M.csvRow([
          d.type === "lent" ? "Money lent" : "Money borrowed", d.person || "", Number.isFinite(original) ? original.toFixed(2) : "",
          M.currencyCode(), "Debt", d.date || "", Number.isFinite(original) ? "Balance: " + Math.max(0,original-repaid).toFixed(2) : "",
          d.id || "", d.dueDate || "", d.notes || ""
        ]));
        (Array.isArray(d.repayments) ? d.repayments : []).forEach(r => lines.push(M.csvRow([
          "Debt repayment", d.person || "", Number.isFinite(Number(r.amount)) ? Number(r.amount).toFixed(2) : "", M.currencyCode(),
          d.type === "lent" ? "Lent" : "Borrowed", r.date || "", "Recorded", r.id || d.id || "", "", r.notes || ""
        ])));
      });
      insurance.forEach(i => lines.push(M.csvRow([
        "Insurance policy", i.policyName || "", i.premium ?? "", M.currencyCode(), i.policyType || "", i.startDate || "",
        "Provider: " + (i.provider || ""), i.id || "", i.expiryDate || "", (i.notes || "") + (i.coverageAmount == null ? "" : " | Coverage: " + i.coverageAmount)
      ])));
      recurringIncome.forEach(r => lines.push(M.csvRow([
        "Recurring income rule", r.name || "", r.amount ?? "", M.currencyCode(), r.category || "", r.startDate || "",
        r.repeat || "", r.id || "", "", r.notes || ""
      ])));
      const date = M.today();
      M.downloadBlob(new Blob(["\uFEFF", ...lines], {type:"text/csv;charset=utf-8"}), "moneyflow-records-" + date + ".csv");
    } catch (err) {
      console.error("MoneyFlow CSV export:", err);
      error.hidden = false;
      error.textContent = "Unable to export safely: " + err.message + " Your stored records were not changed.";
    }
  });
});
