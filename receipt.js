document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const M = window.MoneyFlowDocs;
  const params = new URLSearchParams(location.search);
  const kind = params.get("type"), id = params.get("id");
  const fallback = kind === "payment" ? "payments.html" : kind === "income" ? "income.html" : kind === "expense" ? "spending.html" : "transactions.html";
  document.getElementById("backLink").href = fallback;
  const error = document.getElementById("receiptError");
  const paper = document.getElementById("receiptPaper");
  const actions = document.getElementById("receiptActions");
  function fail(message) {
    error.hidden = false; error.textContent = message;
    paper.hidden = true; actions.hidden = true;
  }
  let record;
  try { record = id ? M.findRecord(kind, id) : null; }
  catch (err) { return fail("We couldn't safely read your saved records. Nothing was modified. " + err.message); }
  if (!record) return fail("That record wasn't found on this device. It may have been deleted or saved in a different browser.");
  if (kind === "payment" && record.status !== "paid") return fail("Payment receipts are only available for payments marked as paid. Return to Payments to update its status.");
  const heading = kind === "payment" ? "PAYMENT RECORD" : kind === "income" ? "INCOME RECORD" : "SPENDING RECORD";
  const name = kind === "payment" ? M.text(record.title,"Payment") : M.text(record.description,kind === "income" ? "Income" : "Spending");
  const recordDate = kind === "payment" ? record.paidDate : record.date;
  const displayDate = M.localDate(recordDate);
  const reference = "MF-" + (kind === "payment" ? "PAY" : kind === "income" ? "INC" : "EXP") + "-" + M.text(record.id,"N/A");
  document.title = "MoneyFlow " + heading.toLowerCase() + " " + reference.slice(0,30);
  document.getElementById("documentType").textContent = heading;
  document.getElementById("amount").textContent = M.money(record.amount);
  document.getElementById("status").textContent = kind === "payment" ? "Marked as paid" : "Saved in MoneyFlow";
  const details = document.getElementById("details");
  const fields = [
    ["Description", name],
    ["Category", M.text(record.category,"Other")],
    [kind === "payment" ? "Paid date" : "Transaction date", displayDate],
    ...(kind === "payment" ? [["Due date",M.localDate(record.dueDate)],["Frequency",M.text(record.frequency,"One-time")]] : []),
    ["Currency",M.currencyCode()],
    ["Reference",reference],
    ...(record.notes ? [["Notes",String(record.notes)]] : [])
  ];
  for (const [label,value] of fields) {
    const row = M.elt("div","detail-row");
    row.append(M.elt("dt","",label),M.elt("dd","",value));
    details.append(row);
  }
  document.getElementById("printReceiptBtn").addEventListener("click", () => window.print());
  document.getElementById("shareReceiptBtn").addEventListener("click", async () => {
    const message = `MoneyFlow ${heading.toLowerCase()}\n${name}\nAmount: ${M.money(record.amount)}\nDate: ${displayDate}\nReference: ${reference}\nPersonal record only. Not bank-issued proof of payment.`;
    try {
      if (navigator.share) await navigator.share({title:"MoneyFlow record details",text:message});
      else if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(message); alert("Details copied. You can paste them into WhatsApp or email.");}
      else alert("To share, use Print / Save PDF, then share the saved file.");
    } catch (err) { if (err.name !== "AbortError") alert("Unable to share. You can use Print / Save PDF instead."); }
  });
});
