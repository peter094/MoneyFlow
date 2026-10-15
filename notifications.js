
/* MONEYFLOW NOTIFICATIONS — IN-APP REMINDERS
   Reads financial records; only writes notification read IDs.
   Can also run on Home to update its bell badge.
*/

(function () {
  "use strict";

  const READ_KEY = "moneyflow_notifications_read_v1";
  const DAY_MS = 86400000;

  const money = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const $ = (id) => document.getElementById(id);

  const state = {
    alerts: [],
    read: new Set(),
    filter: "all",
    errors: [],
    readError: false
  };

  /* ==========================================
     DATE HELPERS
     ========================================== */

  function todayKey() {
    const d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function dayValue(value) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) return null;

    const [y, m, d] = value.split("-").map(Number);

    const date = new Date(Date.UTC(y, m - 1, d));

    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d
    ) return null;

    return date.getTime() / DAY_MS;
  }

  function daysUntil(date) {
    const value = dayValue(date);
    const today = dayValue(todayKey());

    return value === null ? null : value - today;
  }

  function showDate(value) {
    const day = dayValue(value);

    return day === null
      ? "Unknown date"
      : new Date(day * DAY_MS).toLocaleDateString(
          "en-NG",
          {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
          }
        );
  }

  function amount(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0
      ? number
      : 0;
  }

  function name(value, fallback) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, 100)
      : fallback;
  }

  function recordId(row, index) {
    return row &&
      (
        typeof row.id === "string" ||
        typeof row.id === "number"
      ) &&
      String(row.id).trim()
        ? String(row.id)
        : "row-" + index;
  }

  /* ==========================================
     SAFE STORAGE READERS
     ========================================== */

  function readList(key, label) {
    try {
      const raw = localStorage.getItem(key);

      if (raw === null) return [];

      const rows = JSON.parse(raw);

      if (!Array.isArray(rows)) {
        throw new Error("Expected a list");
      }

      return rows;

    } catch (error) {
      console.error(
        "Notifications: cannot read " + key,
        error
      );

      state.errors.push(
        label + " could not be read"
      );

      return null;
    }
  }

  function readNotificationSettings() {
    const defaults = {
      monthlyBudget: 0,
      paymentReminders: true,
      insuranceAlerts: true
    };

    try {
      const raw = localStorage.getItem("moneyflow_settings");
      if (raw === null) return defaults;

      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        throw new Error("Invalid settings data");
      }

      const budget = Number(saved.monthlyBudget ?? 0);
      const validBudget = Number.isFinite(budget) && budget >= 0;
      if (!validBudget) {
        state.errors.push("Monthly budget is invalid");
      }

      return {
        monthlyBudget: validBudget ? budget : null,
        // Explicit false means the user turned reminders off.
        // Existing accounts without these fields default to on.
        paymentReminders: saved.paymentReminders !== false,
        insuranceAlerts: saved.insuranceAlerts !== false
      };
    } catch (error) {
      console.error("Notifications: cannot read settings", error);
      state.errors.push("Notification settings could not be read");
      return {
        monthlyBudget: null,
        paymentReminders: false,
        insuranceAlerts: false
      };
    }
  }

  /* ==========================================
     NOTIFICATIONS READ HISTORY
     ========================================== */

  function readMarkers() {
    try {
      const raw = localStorage.getItem(READ_KEY);

      if (raw === null) return new Set();

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        !Array.isArray(parsed.ids) ||
        parsed.ids.some(
          id => typeof id !== "string"
        )
      ) {
        throw new Error(
          "Invalid notification read markers"
        );
      }

      return new Set(parsed.ids);

    } catch (error) {
      console.error(
        "Notifications: cannot read saved read status",
        error
      );

      state.errors.push(
        "Notification read status could not be read"
      );

      state.readError = true;

      return new Set();
    }
  }

  function saveMarkers(ids) {
    if (state.readError) return false;

    try {
      // Re-read first so marks saved in
      // another tab are not lost.

      const latest = readMarkers();

      if (state.readError) return false;

      ids.forEach(id => latest.add(id));

      localStorage.setItem(
        READ_KEY,
        JSON.stringify({
          version: 1,
          ids: [...latest]
        })
      );

      state.read = latest;

      return true;

    } catch (error) {
      console.error(
        "Notifications: cannot save read status",
        error
      );

      state.errors.push(
        "Could not save notification read status"
      );

      return false;
    }
  }

  /* ==========================================
     ALERT HELPERS
     ========================================== */

  function addAlert(list, fields) {
    list.push(fields);
  }

  function deadlineTitle(noun, delta) {
    if (delta < 0) return noun + " overdue";

    if (delta === 0) return noun + " due today";

    if (delta === 1) return noun + " due tomorrow";

    return noun + " due in " + delta + " days";
  }

  function deadlineBadge(delta) {
    return delta < 0
      ? "Overdue"
      : delta === 0
        ? "Due today"
        : "Upcoming";
  }

  /* ==========================================
     PAYMENT ALERTS
     ========================================== */

  function addPaymentAlerts(list, rows) {
    if (!rows) return;

    rows.forEach((item, index) => {
      if (
        !item ||
        typeof item !== "object" ||
        item.status === "paid"
      ) return;

      const delta = daysUntil(item.dueDate);

      if (
        delta === null ||
        delta > 7
      ) return;

      const stage =
        delta < 0
          ? "overdue"
          : delta === 0
            ? "today"
            : "upcoming";

      const title = name(
        item.title,
        "Payment"
      );

      addAlert(list, {
        id: [
          "payment",
          recordId(item, index),
          item.dueDate,
          stage
        ].join(":"),

        type: "payments",

        title: deadlineTitle(
          "Payment",
          delta
        ),

        message:
          title +
          " · " +
          money.format(amount(item.amount)) +
          " · due " +
          showDate(item.dueDate) +
          ".",

        badge: deadlineBadge(delta),

        severity:
          delta <= 0
            ? "urgent"
            : "upcoming",

        days: delta,

        href: "payments.html",

        action: "View Payment"
      });
    });
  }

  /* ==========================================
     DEBT ALERTS
     ========================================== */

  function addDebtAlerts(list, rows) {
    if (!rows) return;

    rows.forEach((item, index) => {
      if (
        !item ||
        typeof item !== "object"
      ) return;

      const delta = daysUntil(item.dueDate);

      if (
        delta === null ||
        delta > 7
      ) return;

      const repayments =
        Array.isArray(item.repayments)
          ? item.repayments
          : [];

      const repaid = repayments.reduce(
        (sum, entry) =>
          sum + amount(entry?.amount),
        0
      );

      const outstanding = Math.max(
        0,
        amount(item.amount) - repaid
      );

      if (outstanding <= 0) return;

      const person = name(
        item.person,
        "Unknown person"
      );

      const direction =
        item.type === "borrowed"
          ? "You owe " + person
          : person + " owes you";

      const stage =
        delta < 0
          ? "overdue"
          : delta === 0
            ? "today"
            : "upcoming";

      addAlert(list, {
        id: [
          "debt",
          recordId(item, index),
          item.dueDate,
          stage
        ].join(":"),

        type: "debts",

        title: deadlineTitle(
          "Debt repayment",
          delta
        ),

        message:
          direction +
          " " +
          money.format(outstanding) +
          " · due " +
          showDate(item.dueDate) +
          ".",

        badge: deadlineBadge(delta),

        severity:
          delta <= 0
            ? "urgent"
            : "upcoming",

        days: delta,

        href: "debts.html",

        action: "View Debt"
      });
    });
  }

  /* ==========================================
     INSURANCE ALERTS
     ========================================== */

  function addInsuranceAlerts(list, rows) {
    if (!rows) return;

    rows.forEach((item, index) => {
      if (
        !item ||
        typeof item !== "object"
      ) return;

      const title = name(
        item.policyName || item.name,
        "Insurance policy"
      );

      const identity = recordId(
        item,
        index
      );

      const expiry = daysUntil(
        item.expiryDate
      );

      /* POLICY EXPIRY */

      if (
        expiry !== null &&
        expiry <= 30
      ) {
        const stage =
          expiry < 0
            ? "expired"
            : expiry === 0
              ? "today"
              : "upcoming";

        const headline =
          expiry < 0
            ? "Insurance policy expired"
            : expiry === 0
              ? "Insurance expires today"
              : "Insurance expires in " +
                expiry +
                " days";

        addAlert(list, {
          id: [
            "insurance-expiry",
            identity,
            item.expiryDate,
            stage
          ].join(":"),

          type: "insurance",

          title: headline,

          message:
            title +
            " · expiry " +
            showDate(item.expiryDate) +
            ".",

          badge:
            expiry < 0
              ? "Expired"
              : expiry === 0
                ? "Expires today"
                : "Expiring soon",

          severity:
            expiry <= 0
              ? "urgent"
              : "upcoming",

          days: expiry,

          href: "insurance.html",

          action: "View Policy"
        });
      }

      /* UPCOMING RENEWAL */

      const renewal = daysUntil(
        item.renewalDate
      );

      if (
        renewal !== null &&
        renewal >= -30 &&
        renewal <= 30 &&
        item.renewalDate !== item.expiryDate &&
        expiry !== null &&
        expiry >= 0
      ) {
        const stage =
          renewal < 0
            ? "overdue"
            : renewal === 0
              ? "today"
              : "upcoming";

        addAlert(list, {
          id: [
            "insurance-renewal",
            identity,
            item.renewalDate,
            stage
          ].join(":"),

          type: "insurance",

          title: deadlineTitle(
            "Insurance renewal",
            renewal
          ),

          message:
            title +
            " · renewal " +
            showDate(item.renewalDate) +
            ".",

          badge: deadlineBadge(renewal),

          severity:
            renewal <= 0
              ? "urgent"
              : "upcoming",

          days: renewal,

          href: "insurance.html",

          action: "View Policy"
        });
      }
    });
  }

  /* ==========================================
     MONTHLY BUDGET ALERT
     ========================================== */

  function addBudgetAlert(
    list,
    transactions,
    payments,
    budget
  ) {
    if (
      !transactions ||
      !payments ||
      budget === null ||
      budget <= 0
    ) return;

    const month = todayKey().slice(0, 7);

    let spent = 0;

    /* SPENDING TRANSACTIONS */

    transactions.forEach(item => {
      if (
        item &&
        item.type === "expense" &&
        daysUntil(item.date) !== null &&
        item.date.slice(0, 7) === month
      ) {
        spent += amount(item.amount);
      }
    });

    /* PAID PAYMENTS */

    payments.forEach(item => {
      if (
        item &&
        item.status === "paid" &&
        daysUntil(item.paidDate) !== null &&
        item.paidDate.slice(0, 7) === month
      ) {
        spent += amount(item.amount);
      }
    });

    const fraction = spent / budget;

    if (fraction < 0.8) return;

    const exceeded = fraction >= 1;

    addAlert(list, {
      id: [
        "budget",
        month,
        exceeded
          ? "limit"
          : "80-percent"
      ].join(":"),

      type: "budget",

      title: exceeded
        ? "Monthly budget reached"
        : "Approaching your monthly budget",

      message:
        "You've spent " +
        money.format(spent) +
        " of " +
        money.format(budget) +
        " this month (" +
        Math.round(fraction * 100) +
        "%).",

      badge: exceeded
        ? "Budget reached"
        : "80% or more used",

      severity: exceeded
        ? "urgent"
        : "warning",

      days: 0,

      href: "budget.html",

      action: "View Budget"
    });
  }

  /* ==========================================
     LOAD ALL NOTIFICATIONS
     ========================================== */

  function load() {
    state.errors = [];
    state.readError = false;

    const payments = readList(
      "moneyflow_payments",
      "Payments records"
    );

    const debts = readList(
      "moneyflow_debts",
      "Debts records"
    );

    const insurance = readList(
      "moneyflow_insurance",
      "Insurance records"
    );

    const transactions = readList(
      "moneyflow_transactions",
      "Spending records"
    );

    const preferences = readNotificationSettings();

    state.read = readMarkers();

    const list = [];

    if (preferences.paymentReminders) {
      addPaymentAlerts(list, payments);
    }
    addDebtAlerts(list, debts);
    if (preferences.insuranceAlerts) {
      addInsuranceAlerts(list, insurance);
    }

    addBudgetAlert(
      list,
      transactions,
      payments,
      preferences.monthlyBudget
    );

    const priority = {
      urgent: 0,
      warning: 1,
      upcoming: 2
    };

    list.sort(
      (a, b) =>
        priority[a.severity] -
          priority[b.severity] ||
        Math.abs(a.days) -
          Math.abs(b.days) ||
        a.title.localeCompare(b.title)
    );

    state.alerts = list;

    updateBell();
    render();
  }

  /* ==========================================
     HOME BELL BADGE
     ========================================== */

  function updateBell() {
    const badge = $("notificationBadge");
    const bell = $("notificationBellBtn");

    const count = state.alerts.filter(
      a => !state.read.has(a.id)
    ).length;

    if (badge) {
      badge.classList.toggle(
        "show",
        count > 0
      );
    }

    if (bell) {
      bell.setAttribute(
        "aria-label",
        count > 0
          ? "Notifications, " +
            count +
            " unread"
          : "Notifications, no unread alerts"
      );
    }
  }

  /* ==========================================
     SAFE ELEMENT CREATION
     ========================================== */

  function node(tag, className, value) {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    if (value !== undefined) {
      el.textContent = String(value);
    }

    return el;
  }

  /* ==========================================
     RENDER NOTIFICATION CARD
     ========================================== */

  function drawAlert(alert) {
    const unread = !state.read.has(alert.id);

    const card = node(
      "article",
      "notifications-item" +
        (unread ? " is-unread" : "")
    );

    const top = node(
      "div",
      "notifications-item-top"
    );

    const icons = {
      payments: "▣",
      debts: "⇄",
      insurance: "◇",
      budget: "◉"
    };

    const icon = node(
      "span",
      "notifications-item-icon " +
        alert.type,
      icons[alert.type]
    );

    icon.setAttribute(
      "aria-hidden",
      "true"
    );

    const content = node(
      "div",
      "notifications-item-content"
    );

    const title = node(
      "h3",
      "notifications-item-title",
      alert.title
    );

    const message = node(
      "p",
      "notifications-item-message",
      alert.message
    );

    const meta = node(
      "div",
      "notifications-item-meta"
    );

    const badge = node(
      "span",
      "notifications-item-badge " +
        alert.severity,
      alert.badge
    );

    meta.appendChild(badge);

    content.append(
      title,
      message,
      meta
    );

    top.append(
      icon,
      content
    );

    if (unread) {
      top.appendChild(
        node(
          "span",
          "notifications-unread-dot"
        )
      );
    }

    /* ACTION BUTTONS */

    const actions = node(
      "div",
      "notifications-item-actions"
    );

    const view = node(
      "a",
      "notifications-view-link",
      alert.action + " →"
    );

    view.href = alert.href;

    const read = node(
      "button",
      "notifications-read-button",
      unread
        ? "Mark as read"
        : "Read ✓"
    );

    read.type = "button";

    read.disabled =
      !unread || state.readError;

    read.addEventListener(
      "click",
      () => {
        if (saveMarkers([alert.id])) {
          render();
          updateBell();
        } else {
          load();
        }
      }
    );

    actions.append(
      view,
      read
    );

    card.append(
      top,
      actions
    );

    return card;
  }

  /* ==========================================
     RENDER NOTIFICATIONS PAGE
     ========================================== */

  function render() {
    // The same script can run on Home.
    // Home only needs its notification badge.

    if (!$("notificationsList")) return;

    const unread = state.alerts.filter(
      a => !state.read.has(a.id)
    ).length;

    const visible =
      state.filter === "unread"
        ? state.alerts.filter(
            a => !state.read.has(a.id)
          )
        : state.alerts;

    $("notificationsUnreadCount").textContent =
      state.readError
        ? "—"
        : String(unread);

    $("notificationsTotalCount").textContent =
      state.alerts.length + " alerts";

    $("notificationsVisibleCount").textContent =
      visible.length +
      (
        visible.length === 1
          ? " notification"
          : " notifications"
      );

    $("notificationsMarkAllBtn").disabled =
      unread === 0 || state.readError;

    const warning = $(
      "notificationsDataWarning"
    );

    warning.hidden =
      state.errors.length === 0;

    warning.textContent =
      state.errors.length
        ? state.errors.join(". ") +
          ". Some alerts may be unavailable. " +
          "Your financial records have not been changed."
        : "";

    /* UPDATE FILTER BUTTONS */

    document.querySelectorAll(
      "[data-notification-filter]"
    ).forEach(button => {
      const chosen =
        button.dataset.notificationFilter ===
        state.filter;

      button.classList.toggle(
        "active",
        chosen
      );

      button.setAttribute(
        "aria-pressed",
        String(chosen)
      );
    });

    /* BUILD THE ALERT LIST */

    const list = $("notificationsList");

    const fragment =
      document.createDocumentFragment();

    visible.forEach(alert => {
      fragment.appendChild(
        drawAlert(alert)
      );
    });

    list.replaceChildren(fragment);

    /* EMPTY STATE */

    const empty = $(
      "notificationsEmptyState"
    );

    empty.hidden =
      visible.length > 0;

    if (!visible.length) {
      $("notificationsEmptyTitle").textContent =
        state.filter === "unread"
          ? "You're all caught up!"
          : "No alerts right now";

      $("notificationsEmptyDescription").textContent =
        state.filter === "unread"
          ? "You've read all current alerts. " +
            "New reminders will appear here " +
            "as dates or amounts change."
          : "No payments, debt deadlines, " +
            "insurance dates or budget alerts " +
            "need attention right now.";
    }
  }

  /* ==========================================
     BUTTON EVENTS
     ========================================== */

  function bind() {

    /* REFRESH */

    $("notificationsRefreshBtn")
      ?.addEventListener(
        "click",
        load
      );

    /* MARK ALL READ */

    $("notificationsMarkAllBtn")
      ?.addEventListener(
        "click",
        () => {
          const unreadIds =
            state.alerts
              .filter(
                a => !state.read.has(a.id)
              )
              .map(a => a.id);

          if (
            unreadIds.length &&
            saveMarkers(unreadIds)
          ) {
            updateBell();
            render();

          } else if (unreadIds.length) {
            load();
          }
        }
      );

    /* FILTERS */

    document.querySelectorAll(
      "[data-notification-filter]"
    ).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          state.filter =
            button.dataset.notificationFilter ===
            "unread"
              ? "unread"
              : "all";

          render();
        }
      );
    });

    /* REFRESH WHEN REOPENED */

    window.addEventListener(
      "pageshow",
      load
    );

    /* CROSS-TAB CHANGES */

    window.addEventListener(
      "storage",
      (event) => {
        if (
          !event.key ||
          [
            "moneyflow_payments",
            "moneyflow_debts",
            "moneyflow_insurance",
            "moneyflow_transactions",
            "moneyflow_settings",
            READ_KEY
          ].includes(event.key)
        ) {
          load();
        }
      }
    );

    window.addEventListener(
      "focus",
      load
    );
  }

  /* ==========================================
     INITIALIZE
     ========================================== */

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      if (
        !$("notificationsList") &&
        !$("notificationBellBtn")
      ) return;

      bind();
      // The Home bell is handled by dashboard.js. The Payments
      // header also has a bell; make it open the same centre.
      if ($("notificationBellBtn") && !$('notificationsList') &&
          !document.body.classList.contains("home-amoled")) {
        $("notificationBellBtn").addEventListener("click", () => {
          window.location.href = "notifications.html";
        });
      }
      load();
    }
  );

})();
