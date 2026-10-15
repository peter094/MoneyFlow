
/* ============================================
   MONEYFLOW — REFER FRIENDS
   AMOLED + EMERALD EDITION

   Works with:
   - refer.html
   - refer.css

   Does not modify financial records.

   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ==========================================
     CONFIGURATION
     ========================================== */

  /*
    LEAVE THIS EMPTY FOR NOW.

    MoneyFlow will automatically share the
    website where it is deployed.

    Later, when MoneyFlow is published on
    Google Play, replace the empty string
    with the official Play Store URL.

    Example:
    const SHARE_URL_OVERRIDE =
      "https://play.google.com/store/apps/details?id=YOUR_APP_ID";
  */

  const SHARE_URL_OVERRIDE = "";

  /* ==========================================
     ELEMENTS
     ========================================== */

  const $ = (id) =>
    document.getElementById(id);

  const whatsappButton =
    $("referWhatsAppBtn");

  const emailButton =
    $("referEmailBtn");

  const copyButton =
    $("referCopyLinkBtn");

  const linkInput =
    $("referLinkInput");

  const feedback =
    $("referShareFeedback");

  /* ==========================================
     INITIALIZE PAGE
     ========================================== */

  document.documentElement.classList.add(
    "dark"
  );

  const themeMeta = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (themeMeta) {
    themeMeta.setAttribute(
      "content",
      "#09090f"
    );
  }

  updateWebsiteLink();

  /* ==========================================
     GET REAL MONEYFLOW WEBSITE
     ========================================== */

  function getShareUrl() {

    // Official app link override, used later.

    const override =
      SHARE_URL_OVERRIDE.trim();

    if (override) {
      try {
        const parsed = new URL(override);

        if (parsed.protocol === "https:") {
          return parsed.href;
        }

      } catch (error) {
        console.warn(
          "Invalid MoneyFlow sharing URL.",
          error
        );
      }
    }

    /*
      Use the currently deployed website.

      For Netlify:
      https://your-site.netlify.app/welcome.html

      Never share a local SPCK preview,
      file:// address or localhost.
    */

    const hostname =
      window.location.hostname.toLowerCase();

    const isPreview =
      window.location.protocol !== "https:" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.includes("spck");

    if (isPreview) {
      return "";
    }

    try {
      return new URL(
        "welcome.html",
        window.location.href
      ).href;

    } catch (error) {
      console.error(
        "Unable to build website URL:",
        error
      );

      return "";
    }
  }

  /* ==========================================
     SHOW WEBSITE LINK
     ========================================== */

  function updateWebsiteLink() {

    if (!linkInput) return;

    const url = getShareUrl();

    linkInput.value = url;

    if (!url) {
      linkInput.placeholder =
        "Open MoneyFlow on Netlify to share";
    }
  }

  /* ==========================================
     FEEDBACK MESSAGES
     ========================================== */

  function showFeedback(
    message,
    isError = false
  ) {

    if (!feedback) return;

    feedback.textContent = message;

    feedback.classList.toggle(
      "error",
      isError
    );
  }

  /* ==========================================
     CHECK LINK BEFORE SHARING
     ========================================== */

  function getValidShareUrl() {

    const url = getShareUrl();

    if (!url) {

      showFeedback(
        "Open your deployed MoneyFlow " +
        "website on Netlify to share " +
        "its link.",
        true
      );

      return null;
    }

    return url;
  }

  /* ==========================================
     INVITATION MESSAGE
     ========================================== */

  function invitationMessage(url) {

    return [
      "Hey! 👋",
      "",
      "I'd like to invite you to MoneyFlow.",
      "",
      "MoneyFlow helps you track your " +
      "income, spending, bills and debts " +
      "in one place.",
      "",
      "Take control of your money today!",
      "",
      "Try MoneyFlow here:",
      url
    ].join("\n");
  }

  /* ==========================================
     SHARE VIA WHATSAPP
     ========================================== */

  function shareOnWhatsApp() {

    const url = getValidShareUrl();

    if (!url) return;

    const message =
      invitationMessage(url);

    const whatsappUrl =
      "https://wa.me/?text=" +
      encodeURIComponent(message);

    /*
      Open WhatsApp's sharing interface.
      The user chooses who receives
      the invitation.
    */

    window.location.href = whatsappUrl;
  }

  whatsappButton?.addEventListener(
    "click",
    shareOnWhatsApp
  );

  /* ==========================================
     SHARE VIA EMAIL
     ========================================== */

  function shareByEmail() {

    const url = getValidShareUrl();

    if (!url) return;

    const subject =
      "You're invited to MoneyFlow!";

    const body =
      invitationMessage(url);

    const emailUrl =
      "mailto:?" +
      "subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body);

    /*
      Open the user's email application
      with the invitation filled in.

      No recipient is selected automatically.
    */

    window.location.href = emailUrl;
  }

  emailButton?.addEventListener(
    "click",
    shareByEmail
  );

  /* ==========================================
     COPY WEBSITE LINK
     ========================================== */

  async function copyWebsiteLink() {

    const url = getValidShareUrl();

    if (!url) return;

    let copied = false;

    // Modern browser clipboard.

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText
        === "function"
    ) {

      try {
        await navigator.clipboard.writeText(
          url
        );

        copied = true;

      } catch (error) {
        console.warn(
          "Clipboard API unavailable:",
          error
        );
      }
    }

    // Fallback for some Android browsers.

    if (!copied && linkInput) {

      try {
        linkInput.focus();
        linkInput.select();

        linkInput.setSelectionRange(
          0,
          linkInput.value.length
        );

        copied =
          document.execCommand("copy");

      } catch (error) {
        console.warn(
          "Fallback copy unavailable:",
          error
        );
      }
    }

    if (copied) {

      showFeedback(
        "MoneyFlow link copied successfully!"
      );

      if (copyButton) {

        copyButton.textContent = "Copied!";

        copyButton.classList.add(
          "copied"
        );

        setTimeout(() => {

          copyButton.textContent = "Copy";

          copyButton.classList.remove(
            "copied"
          );

        }, 2000);
      }

    } else {

      if (linkInput) {
        linkInput.focus();
        linkInput.select();
      }

      showFeedback(
        "Automatic copying is unavailable. " +
        "Please select and copy the link.",
        true
      );
    }
  }

  copyButton?.addEventListener(
    "click",
    copyWebsiteLink
  );

  /* ==========================================
     MAKE WEBSITE LINK SELECTABLE
     ========================================== */

  linkInput?.addEventListener(
    "click",
    () => {
      linkInput.select();
    }
  );

  /* ==========================================
     REFRESH PAGE WHEN RETURNING
     ========================================== */

  window.addEventListener(
    "pageshow",
    () => {
      updateWebsiteLink();
    }
  );

});
