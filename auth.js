/* ==========================================
   MONEYFLOW
   LOGIN & REGISTRATION FUNCTIONALITY
   Premium Emerald Edition
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {

  "use strict";

  let mode = "login";
  let lastFocusedElement = null;

  const $ = (id) => document.getElementById(id);

  /* ========================================
     ELEMENTS
     ======================================== */

  const els = {

    configWarning: $("configWarning"),

    introHeading: $("introHeading"),
    introSubheading: $("introSubheading"),

    loginTabBtn: $("loginTabBtn"),
    registerTabBtn: $("registerTabBtn"),

    form: $("authForm"),
    error: $("authError"),

    fullNameField: $("fullNameField"),
    fullName: $("authFullName"),

    email: $("authEmail"),

    password: $("authPassword"),

    togglePasswordBtn: $("togglePasswordBtn"),
    eyeIcon: $("eyeIcon"),

    confirmPasswordField: $("confirmPasswordField"),
    confirmPassword: $("authConfirmPassword"),

    toggleConfirmPasswordBtn:
      $("toggleConfirmPasswordBtn"),

    terms: $("authTerms"),

    submitBtn: $("authSubmitBtn"),
    submitLabel: $("authSubmitLabel"),

    switchText: $("authSwitchText"),

    termsInfoBtn: $("termsInfoBtn"),
    privacyInfoBtn: $("privacyInfoBtn"),

    legalOverlay: $("authLegalOverlay"),
    legalTitle: $("authLegalTitle"),
    legalContent: $("authLegalContent"),
    legalClose: $("authLegalClose")

  };

  /* ========================================
     INITIALIZATION
     ======================================== */

  function init() {

    if (
      typeof MoneyFlow === "undefined" ||
      !MoneyFlow.API_BASE_URL
    ) {
      showError(
        "MoneyFlow could not initialize. Please reload."
      );

      els.submitBtn.disabled = true;
      return;
    }

    if (
      MoneyFlow.API_BASE_URL.includes(
        "your-backend"
      )
    ) {
      els.configWarning.classList.add("show");
    }

    /* Login tab */

    els.loginTabBtn.addEventListener(
      "click",
      () => setMode("login")
    );

    /* Register tab */

    els.registerTabBtn.addEventListener(
      "click",
      () => setMode("register")
    );

    /* Password visibility */

    els.togglePasswordBtn.addEventListener(
      "click",
      () => {
        togglePassword(
          els.password,
          els.togglePasswordBtn
        );
      }
    );

    /* Confirm password visibility */

    els.toggleConfirmPasswordBtn.addEventListener(
      "click",
      () => {
        togglePassword(
          els.confirmPassword,
          els.toggleConfirmPasswordBtn
        );
      }
    );

    /* Submit */

    els.form.addEventListener(
      "submit",
      handleSubmit
    );

    /* Terms and privacy information */

    els.termsInfoBtn.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        openLegal("terms");
      }
    );

    els.privacyInfoBtn.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        openLegal("privacy");
      }
    );

    /* Close popup */

    els.legalClose.addEventListener(
      "click",
      closeLegal
    );

    els.legalOverlay.addEventListener(
      "click",
      (event) => {

        if (
          event.target === els.legalOverlay
        ) {
          closeLegal();
        }

      }
    );

    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Escape" &&
          !els.legalOverlay.hidden
        ) {
          closeLegal();
        }

      }
    );

    /* Start in Login mode */

    setMode("login");

  }


  /* ========================================
     LOGIN / REGISTER SWITCHING
     ======================================== */

  function setMode(nextMode) {

    mode = nextMode;

    hideError();

    const isLogin = mode === "login";

    /* Tab appearance */

    els.loginTabBtn.classList.toggle(
      "active",
      isLogin
    );

    els.registerTabBtn.classList.toggle(
      "active",
      !isLogin
    );

    els.loginTabBtn.setAttribute(
      "aria-pressed",
      String(isLogin)
    );

    els.registerTabBtn.setAttribute(
      "aria-pressed",
      String(!isLogin)
    );

    /* Page heading */

    if (isLogin) {

      els.introHeading.textContent =
        MoneyFlow.isReturningUser()
          ? "Welcome back"
          : "Welcome to MoneyFlow";

      els.introSubheading.textContent =
        "Sign in to take control of your finances.";

    } else {

      els.introHeading.textContent =
        "Create Account";

      els.introSubheading.textContent =
        "Sign up to get started with MoneyFlow.";

    }

    /* Show registration fields */

    els.fullNameField.hidden = isLogin;

    els.confirmPasswordField.hidden = isLogin;

    /* Validation requirements */

    els.fullName.required = !isLogin;

    els.confirmPassword.required = !isLogin;

    els.terms.required = !isLogin;

    /* Password autocomplete */

    els.password.setAttribute(
      "autocomplete",
      isLogin
        ? "current-password"
        : "new-password"
    );

    /* Submit button */

    els.submitLabel.textContent =
      isLogin
        ? "Log In"
        : "Create Account";

    /* Reset password visibility */

    els.password.type = "password";

    els.confirmPassword.type = "password";

    updateEyeButton(
      els.togglePasswordBtn,
      false,
      "password"
    );

    updateEyeButton(
      els.toggleConfirmPasswordBtn,
      false,
      "confirm password"
    );

    /* Bottom switch */

    els.switchText.textContent = "";

    const message = document.createTextNode(
      isLogin
        ? "Don't have an account? "
        : "Already have an account? "
    );

    const switchButton =
      document.createElement("button");

    switchButton.type = "button";

    switchButton.id = "switchToRegisterBtn";

    switchButton.textContent =
      isLogin
        ? "Create one"
        : "Log in";

    switchButton.addEventListener(
      "click",
      () => {

        setMode(
          isLogin
            ? "register"
            : "login"
        );

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

      }
    );

    els.switchText.appendChild(message);

    els.switchText.appendChild(switchButton);

  }


  /* ========================================
     SHOW / HIDE PASSWORD
     ======================================== */

  function togglePassword(input, button) {

    const isVisible =
      input.type === "password";

    input.type =
      isVisible
        ? "text"
        : "password";

    const label =
      input === els.confirmPassword
        ? "confirm password"
        : "password";

    updateEyeButton(
      button,
      isVisible,
      label
    );

  }


  function updateEyeButton(
    button,
    isVisible,
    label
  ) {

    button.setAttribute(
      "aria-label",
      isVisible
        ? `Hide ${label}`
        : `Show ${label}`
    );

    button.setAttribute(
      "aria-pressed",
      String(isVisible)
    );

    const svg = button.querySelector("svg");

    if (!svg) return;

    svg.innerHTML = isVisible

      ? `
        <path
          d="M3 3l18 18"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <path
          d="M10.6 10.6A2 2 0 0 0 12
             14c.5 0 1-.2 1.4-.6"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <path
          d="M6.4 6.8C3.6 8.6 2 12 2 12s3.5
             6 10 6c2 0 3.7-.6 5.2-1.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M9.8 5.6c.7-.2 1.4-.2 2.2-.2
             6.5 0 10 6.6 10 6.6s-.8
             1.5-2.3 3"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      `

      : `
        <path
          d="M2 12s3.5-6 10-6 10 6
             10 6-3.5 6-10 6-10-6-10-6Z"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="3"
          stroke="currentColor"
          stroke-width="1.8"
        />
      `;

  }


  /* ========================================
     REGISTRATION VALIDATION
     ======================================== */

  function validateRegistration(
    name,
    password,
    confirmPassword
  ) {

    if (!name) {

      showError(
        "Please enter your full name."
      );

      return false;
    }

    if (password.length < 8) {

      showError(
        "Password must contain at least 8 characters."
      );

      return false;
    }

    if (!/[A-Z]/.test(password)) {

      showError(
        "Password must contain an uppercase letter."
      );

      return false;
    }

    if (!/[a-z]/.test(password)) {

      showError(
        "Password must contain a lowercase letter."
      );

      return false;
    }

    if (!/[0-9]/.test(password)) {

      showError(
        "Password must contain a number."
      );

      return false;
    }

    if (password !== confirmPassword) {

      showError(
        "Passwords do not match."
      );

      return false;
    }

    if (!els.terms.checked) {

      showError(
        "Please review and accept the Terms and Privacy information."
      );

      return false;
    }

    return true;

  }


  /* ========================================
     FORM SUBMISSION
     ======================================== */

  async function handleSubmit(event) {

    event.preventDefault();

    if (els.submitBtn.disabled) {
      return;
    }

    hideError();

    const fullName =
      els.fullName.value.trim();

    const email =
      els.email.value.trim();

    const password =
      els.password.value;

    const confirmPassword =
      els.confirmPassword.value;

    /* Check required fields */

    if (!email || !password) {

      showError(
        "Please enter your email and password."
      );

      return;
    }

    /* Validate email */

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {

      showError(
        "Please enter a valid email address."
      );

      return;
    }

    /* Password length */

    if (password.length < 8) {

      showError(
        "Password must contain at least 8 characters."
      );

      return;
    }

    /* Registration-only checks */

    if (mode === "register") {

      const valid = validateRegistration(
        fullName,
        password,
        confirmPassword
      );

      if (!valid) {
        return;
      }

    }

    setLoading(true);

    try {

      /* Keep existing backend endpoints */

      const endpoint =
        mode === "login"
          ? "/auth/login"
          : "/auth/signup";

      const payload =
        mode === "login"

          ? {
              email,
              password
            }

          : {
              email,
              password,
              name: fullName
            };

      const response = await fetch(
        `${MoneyFlow.API_BASE_URL}${endpoint}`,
        {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)

        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      /* Server error */

      if (!response.ok) {

        showError(
          data.error ||
          "Something went wrong. Please try again."
        );

        return;
      }

      /* Session token */

      if (!data.token) {

        showError(
          "No login session was returned. Please try again."
        );

        return;
      }

      /* Preserve existing registration tracking */

      const isFirstEverAuth =
        !MoneyFlow.isReturningUser();

      /* Save authentication token */

      localStorage.setItem(
        "moneyflow_auth_token",
        data.token
      );

      MoneyFlow.markAsReturningUser();

      if (
        mode === "register" &&
        isFirstEverAuth
      ) {

        MoneyFlow.markJustRegistered();

      }


      /* ========================================
         SAVE ACCOUNT INFORMATION RELIABLY
         ======================================== */

      const authenticatedEmail =
        email.trim().toLowerCase();

      // Preserve an existing profile only
      // when it belongs to this same email.
      let previousUser = {};

      try {
        const stored = JSON.parse(
          localStorage.getItem(
            "moneyflow_auth_user"
          ) || "null"
        );

        if (
          stored &&
          typeof stored === "object" &&
          !Array.isArray(stored) &&
          typeof stored.email === "string" &&
          stored.email.trim().toLowerCase() ===
            authenticatedEmail
        ) {
          previousUser = stored;
        }

      } catch (error) {
        console.warn(
          "Could not read previous account profile.",
          error
        );
      }

      // Use the server's account details when available.
      const serverUser =
        data.user &&
        typeof data.user === "object" &&
        !Array.isArray(data.user)
          ? data.user
          : {};

      const possibleNames = [
        serverUser.name,
        serverUser.fullName,
        serverUser.full_name,
        serverUser.displayName,
        data.name,
        data.fullName,
        data.full_name,
        mode === "register" ? fullName : "",
        previousUser.name,
        previousUser.fullName
      ];

      const accountName = possibleNames.find(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0
      );

      const accountUser = {
        ...previousUser,
        ...serverUser,
        email: authenticatedEmail
      };

      if (accountName) {
        accountUser.name = accountName.trim();
      }

      localStorage.setItem(
        "moneyflow_auth_user",
        JSON.stringify(accountUser)
      );


      /* Open dashboard */

      window.location.replace(
        "home.html"
      );

    } catch (error) {

      console.error(
        "MoneyFlow authentication error:",
        error
      );

      showError(
        "Couldn't reach the server. Check your connection and try again."
      );

    } finally {

      setLoading(false);

    }

  }


  /* ========================================
     BUTTON LOADING STATE
     ======================================== */

  function setLoading(isLoading) {

    els.submitBtn.disabled = isLoading;

    els.submitBtn.classList.toggle(
      "loading",
      isLoading
    );

    if (isLoading) {

      els.submitLabel.textContent =
        mode === "login"
          ? "Signing In..."
          : "Creating Account...";

    } else {

      els.submitLabel.textContent =
        mode === "login"
          ? "Log In"
          : "Create Account";

    }

  }


  /* ========================================
     ERROR MESSAGES
     ======================================== */

  function showError(message) {

    els.error.textContent = message;

    els.error.classList.add("show");

    els.error.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  }


  function hideError() {

    els.error.textContent = "";

    els.error.classList.remove("show");

  }


  /* ========================================
     TERMS / PRIVACY POPUP
     ======================================== */

  function openLegal(type) {

    lastFocusedElement =
      document.activeElement;

    const isTerms = type === "terms";

    els.legalTitle.textContent =
      isTerms
        ? "Terms Information"
        : "Privacy Information";

    /* These are informational summaries,
       not a published legal policy. */

    if (isTerms) {

      els.legalContent.innerHTML = `
        <p>
          MoneyFlow is a personal finance
          tracking application designed to
          help you manage your finances.
        </p>

        <p>
          You are responsible for keeping
          your account credentials secure
          and entering accurate financial
          information.
        </p>

        <p>
          MoneyFlow provides budgeting and
          tracking tools, not professional
          financial advice.
        </p>

        <p>
          This is a preliminary information
          summary. Formal Terms of Service
          must be published before a
          production launch.
        </p>
      `;

    } else {

      els.legalContent.innerHTML = `
        <p>
          MoneyFlow uses your account details
          to authenticate your access to
          the application.
        </p>

        <p>
          Some financial records and preferences
          may be stored locally on your device.
          Clearing application storage may
          remove locally stored information.
        </p>

        <p>
          Protect your account password and
          avoid sharing sensitive financial
          information with other people.
        </p>

        <p>
          This is a preliminary information
          summary, not a published legal
          Privacy Policy.
        </p>
      `;

    }

    els.legalOverlay.hidden = false;

    document.body.style.overflow = "hidden";

    els.legalClose.focus();

  }


  function closeLegal() {

    els.legalOverlay.hidden = true;

    document.body.style.overflow = "";

    if (
      lastFocusedElement &&
      typeof lastFocusedElement.focus === "function"
    ) {

      lastFocusedElement.focus();

    }

  }


  /* ========================================
     START APPLICATION
     ======================================== */

  init();

});