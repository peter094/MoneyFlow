document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const M = window.MoneyFlowDocs;
  const error = document.getElementById("reportError");
  const paper = document.getElementById("reportPaper");
  const print = document.getElementById("printReportBtn");
  document.getElementById("reportDate").textContent = new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  document.getElementById("reportCurrency").textContent = M.currencyCode();
  function cell(row,value,cls) {const c=M.elt("td",cls||"",value);row.append(c);}
  try {
    const {transactions,payments,debts,insurance,recurringIncome} = M.getRecords();
    const valid = transactions.filter(t => (t.type === "income" || t.type === "expense") && Number.isFinite(Number(t.amount)));
    const income = valid.filter(t=>t.type==="income").reduce((n,t)=>n+Number(t.amount),0);
    const spending = valid.filter(t=>t.type==="expense").reduce((n,t)=>n+Number(t.amount),0);
    const paid = payments.filter(p=>p.status==="paid" && Number.isFinite(Number(p.amount))).reduce((n,p)=>n+Number(p.amount),0);
    const summary = document.getElementById("reportSummary");
    [["Recorded income",M.money(income)],["Recorded spending",M.money(spending)],["Income minus spending",M.money(income-spending)],["Tracked paid bills",M.money(paid)],["Transactions",valid.length],["Payment records",payments.length]].forEach(([label,value]) => {
      const tile=M.elt("div","tile");tile.append(M.elt("span","",label),M.elt("strong","",value));summary.append(tile);
    });
    const transactionRows = document.getElementById("transactionsRows");
    const sorted = valid.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
    if (!sorted.length) {const row=M.elt("tr");const td=M.elt("td","empty-row","No transactions recorded");td.colSpan=5;row.append(td);transactionRows.append(row);}
    for (const t of sorted) {
      const row=M.elt("tr");
      cell(row,M.localDate(t.date));cell(row,t.type==="income"?"Income":"Spending");cell(row,M.text(t.description));cell(row,M.text(t.category));
      cell(row,M.money(t.amount),"num");transactionRows.append(row);
    }
    const paymentRows = document.getElementById("paymentsRows");
    if (!payments.length) {const row=M.elt("tr");const td=M.elt("td","empty-row","No payments recorded");td.colSpan=4;row.append(td);paymentRows.append(row);}
    for (const p of payments.slice().sort((a,b)=>String(b.dueDate||"").localeCompare(String(a.dueDate||"")))) {
      const row=M.elt("tr");cell(row,M.localDate(p.dueDate));cell(row,M.text(p.title));cell(row,M.paymentStatus(p));cell(row,M.money(p.amount),"num");paymentRows.append(row);
    }
    function empty(tbodyId, cols, label) {
      const row=M.elt("tr");const td=M.elt("td","empty-row",label);td.colSpan=cols;row.append(td);document.getElementById(tbodyId).append(row);
    }
    if (!debts.length) empty("debtRows",5,"No debt records");
    for (const d of debts) {
      const repayments = Array.isArray(d.repayments) ? d.repayments : [];
      const paid = repayments.reduce((sum,r)=>sum+(Number.isFinite(Number(r.amount)) ? Number(r.amount):0),0);
      const principal = Number(d.amount);
      const row=M.elt("tr");
      cell(row,M.text(d.person));cell(row,d.type==="lent" ? "Money lent" : "Money borrowed");cell(row,M.localDate(d.dueDate));
      cell(row,M.money(d.amount),"num");cell(row,Number.isFinite(principal) ? M.money(Math.max(0,principal-paid)) : "—","num");
      document.getElementById("debtRows").append(row);
    }
    if (!insurance.length) empty("insuranceRows",5,"No insurance policies");
    for (const i of insurance) {
      const row=M.elt("tr");cell(row,M.text(i.policyName));cell(row,M.text(i.provider));cell(row,M.text(i.policyType));
      cell(row,M.localDate(i.expiryDate));cell(row,i.premium == null || i.premium === "" ? "—" : M.money(i.premium),"num");
      document.getElementById("insuranceRows").append(row);
    }
    if (!recurringIncome.length) empty("recurringRows",5,"No income schedules");
    for (const r of recurringIncome) {
      const row=M.elt("tr");cell(row,M.text(r.name));cell(row,M.text(r.category));cell(row,M.localDate(r.startDate));
      cell(row,M.text(r.repeat));cell(row,r.amount == null || r.amount === "" ? "—" : M.money(r.amount),"num");
      document.getElementById("recurringRows").append(row);
    }
    print.addEventListener("click",()=>window.print());
  } catch (err) {
    console.error("MoneyFlow report:",err);paper.hidden=true;print.disabled=true;error.hidden=false;
    error.textContent="We couldn't safely read your records. No report was generated and nothing was changed. " + err.message;
  }
});
