/* MONEYFLOW CATEGORY ICONS
   Consistent inline SVGs for Income and Spending filters, forms and records.
   No network requests, emoji fonts, or changes to transaction storage.
*/
(() => {
  "use strict";
  const designs = {
    all: {
      color: "#eafaf5",
      paths: '<rect x="3" y="3" width="7" height="7" rx="1.3" fill="currentColor" stroke="none"/><rect x="14" y="3" width="7" height="7" rx="1.3" fill="currentColor" stroke="none"/><rect x="3" y="14" width="7" height="7" rx="1.3" fill="currentColor" stroke="none"/><rect x="14" y="14" width="7" height="7" rx="1.3" fill="currentColor" stroke="none"/>'
    },
    salary: {
      color: "#32c781",
      paths: '<rect x="3" y="7" width="18" height="13" rx="2.5" fill="currentColor" fill-opacity=".16"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 11.5c5.6 3.2 12.4 3.2 18 0M3 7h18v13H3z"/><path d="M11 13h2" stroke-width="2.5"/>'
    },
    business: {
      color: "#53aaf4",
      paths: '<path d="M4 10v11h16V10"/><path d="M3 10l2-6h14l2 6c-.6 2.6-3.4 2.8-5 1.2-1.4 1.7-3.6 1.7-5 0-1.7 1.7-4.4 1.4-5-.2Z" fill="currentColor" fill-opacity=".17"/><path d="M9 21v-6h6v6M3 10l2-6h14l2 6"/>'
    },
    returns: {
      color: "#ae82ff",
      paths: '<path d="m3 18 6.3-6.5 4.2 3.9L21 7"/><path d="M15.5 7H21v5.5"/>'
    },
    gift: {
      color: "#f27ab3",
      paths: '<rect x="3" y="10" width="18" height="11" rx="1.7" fill="currentColor" fill-opacity=".18"/><path d="M3 10h18v11H3zM2 7h20v4H2zM12 7V21"/><path d="M12 7C7.5 8 6 6.4 6.7 4.7c.8-2.7 4.2-.9 5.3 2.3Zm0 0c4.5 1 6-0.6 5.3-2.3C16.5 2 13.1 3.8 12 7Z"/>'
    },
    other: {
      color: "#e7b145",
      paths: '<path d="M11 3H5a2 2 0 0 0-2 2v6.2c0 .5.2 1 .6 1.4l7.8 7.8a2 2 0 0 0 2.8 0l6.2-6.2a2 2 0 0 0 0-2.8L12.6 3.6A2 2 0 0 0 11 3Z" fill="currentColor" fill-opacity=".14"/><path d="M11 3H5a2 2 0 0 0-2 2v6.2c0 .5.2 1 .6 1.4l7.8 7.8a2 2 0 0 0 2.8 0l6.2-6.2a2 2 0 0 0 0-2.8L12.6 3.6A2 2 0 0 0 11 3Z"/><circle cx="7.4" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>'
    },
    food: {
      color: "#f18b47",
      paths: '<path d="M4 11a8 8 0 0 1 16 0H4Z" fill="currentColor" fill-opacity=".25"/><path d="M4 11a8 8 0 0 1 16 0M3.5 15.5h17M4.5 19.5h15M4 11h16M5 12.7h14"/><circle cx="8" cy="8.1" r=".7" fill="currentColor" stroke="none"/><circle cx="13" cy="6.8" r=".7" fill="currentColor" stroke="none"/>'
    },
    shopping: {
      color: "#eb6db2",
      paths: '<path d="M5 8h14l1 13H4L5 8Z" fill="currentColor" fill-opacity=".16"/><path d="M5 8h14l1 13H4L5 8ZM9 9V6a3 3 0 0 1 6 0v3"/>'
    },
    transport: {
      color: "#57aafa",
      paths: '<path d="m5 10 2-5h10l2 5M3 10h18v8H3z" fill="currentColor" fill-opacity=".16"/><path d="m5 10 2-5h10l2 5M3 10h18v8H3zM3 14h18"/><path d="M6 18v2M18 18v2"/><circle cx="7" cy="14.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="17" cy="14.5" r="1.1" fill="currentColor" stroke="none"/>'
    },
    bills: {
      color: "#eeb45c",
      paths: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" fill="currentColor" fill-opacity=".12"/><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>'
    },
    health: {
      color: "#77d8b4",
      paths: '<rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fill-opacity=".16"/><path d="M10 7v10M7 10h10" stroke-width="2.6"/>'
    },
    entertainment: {
      color: "#b488fd",
      paths: '<rect x="3" y="6" width="18" height="14" rx="2.5" fill="currentColor" fill-opacity=".12"/><path d="M3 10h18M7 6l2 4M14 6l2 4M3 6h18v14H3z"/><path d="m10 13 5 3-5 3v-6Z" stroke-linejoin="round"/>'
    }
  };
  function spec(category) {
    const key = String(category || "Other").toLowerCase().trim();
    return designs[key] || designs.other;
  }
  function svg(category) {
    return '<svg class="mf-category-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      spec(category).paths + '</svg>';
  }
  function iconElement(category) {
    const icon = document.createElement("span");
    icon.className = "mf-category-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.style.setProperty("--mf-category-color", spec(category).color);
    icon.innerHTML = svg(category); // fixed built-in SVG templates only
    return icon;
  }
  function decorateChip(button, category) {
    if (!button) return;
    const icon = button.querySelector(":scope > span");
    if (!icon) return;
    icon.className = "mf-category-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.style.setProperty("--mf-category-color", spec(category).color);
    icon.innerHTML = svg(category);
  }
  function enhanceStatic() {
    document.querySelectorAll(".income-filter-chip, .spending-filter-chip").forEach(button => {
      decorateChip(button, button.dataset.category);
    });
    document.querySelectorAll('.income-choice input[name="incomeCategory"], .spending-choice input[name="spendingCategory"]').forEach(input => {
      const label = input.nextElementSibling;
      if (!label || label.tagName !== "SPAN") return;
      const category = input.value;
      // Remove old OS-dependent emoji text while preserving the radio input.
      label.textContent = category;
      label.prepend(iconElement(category));
    });
  }
  window.MoneyFlowCategoryIcons = Object.freeze({ svg, iconElement, decorateChip });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceStatic, { once: true });
  } else {
    enhanceStatic();
  }
})();
