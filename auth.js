/* =====================================================================
   MONEYFLOW — AUTH PAGE LOGIC
   Handles login.html only. Talks directly to your backend's
   /auth/signup and /auth/login endpoints — no changes made to those
   endpoints or to anything else on the backend in this phase.
   ===================================================================== */

// Backend URL comes from core.js (MoneyFlow.API_BASE_URL) — this
// file no longer keeps its own copy, so there's only one place to
// ever update it.

document.addEventListener("DOMContentLoaded", () => {

  let mode = "login"; // "login" | "register"

  const els = {
    configWarning: document.getElementById("configWarning"),
    introHeading: document.getElementById("introHeading"),
    introSubheading: document.getElementById("introSubheading"),
    loginTabBtn: document.getElementById("loginTabBtn"),
    registerTabBtn: document.getElementById("registerTabBtn"),
    form: document.getElementById("authForm"),
    error: document.getElementById("authError"),
    fullNameField: document.getElementById("fullNameField"),
    fullName: document.getElementById("authFullName"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    togglePasswordBtn: document.getElementById("togglePasswordBtn"),
    eyeIcon: document.getElementById("eyeIcon"),
    confirmPasswordField: document.getElementById("confirmPasswordField"),
    confirmPassword: document.getElementById("authConfirmPassword"),
    submitBtn: document.getElementById("authSubmitBtn"),
    submitLabel: document.getElementById("authSubmitLabel"),
    switchText: document.getElementById("authSwitchText"),
    switchToRegisterBtn: document.getElementById("switchToRegisterBtn"),
  };

  init();

  function init() {
    if (MoneyFlow.API_BASE_URL.includes("your-backend")) {
      els.configWarning.classList.add("show");
    }

    els.loginTabBtn.addEventListener("click", () => setMode("login"));
    els.registerTabBtn.addEventListener("click", () => setMode("register"));
    els.switchToRegisterBtn.addEventListener("click", () => {
      setMode(mode === "login" ? "register" : "login");
    });

    els.togglePasswordBtn.addEventListener("click", togglePasswordVisibility);
    els.form.addEventListener("submit", handleSubmit);

    setMode("login");
  }

  /* ---------------- Mode switching (Login / Register) ---------------- */

  function setMode(nextMode) {
    mode = nextMode;
    hideError();

    const isLogin = mode === "login";

    els.loginTabBtn.classList.toggle("active", isLogin);
    els.registerTabBtn.classList.toggle("active", !isLogin);

    els.introHeading.textContent = isLogin
      ? (MoneyFlow.isReturningUser() ? "Welcome back" : "Welcome")
      : "Create your account";
    els.introSubheading.textContent = isLogin
      ? (MoneyFlow.isReturningUser() ? "Sign in to keep track of your money." : "Sign in or create an account to get started.")
      : "Takes less than a minute to get started.";

    els.submitLabel.textContent = isLogin ? "Log In" : "Create Account";
    els.password.setAttribute("autocomplete", isLogin ? "current-password" : "new-password");

    els.fullNameField.hidden = isLogin;
    els.fullName.required = !isLogin;
    if (isLogin) els.fullName.value = "";

    els.confirmPasswordField.hidden = isLogin;
    els.confirmPassword.required = !isLogin;
    if (isLogin) els.confirmPassword.value = "";

    els.switchText.innerHTML = "";
    const text = document.createTextNode(
      isLogin ? "Don't have an account? " : "Already have an account? "
    );
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "switchToRegisterBtn";
    btn.textContent = isLogin ? "Create one" : "Log in";
    btn.addEventListener("click", () => setMode(isLogin ? "register" : "login"));
    els.switchText.appendChild(text);
    els.switchText.appendChild(btn);
  }

  /* ---------------- Password visibility ---------------- */

  function togglePasswordVisibility() {
    const isHidden = els.password.type === "password";
    const nextType = isHidden ? "text" : "password";

    els.password.type = nextType;
    els.confirmPassword.type = nextType;
    els.togglePasswordBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");

    // Simple eye / eye-off swap, no extra icon set needed.
    els.eyeIcon.innerHTML = isHidden
      ? '<path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6.5 6.7C4 8.3 2 12 2 12C2 12 5.5 18.5 12 18.5C14 18.5 15.7 17.9 17.1 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.9 5.6C10.6 5.5 11.3 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 21.2 13.5 19.7 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<path d="M2 12C2 12 5.5 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 18.5 18.5 12 18.5C5.5 18.5 2 12 2 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>';
  }

  /* ---------------- Form submit ---------------- */

  async function handleSubmit(event) {
    event.preventDefault();
    if (els.submitBtn.disabled) return; // already mid-request — ignore extra taps/Enter presses
    hideError();

    const fullName = els.fullName.value.trim();
    const email = els.email.value.trim();
    const password = els.password.value;
    const confirmPassword = els.confirmPassword.value;

    if (!email || !password) {
      showError("Please fill in both fields.");
      return;
    }

    if (password.length < 8) {
      showError("Password must be at least 8 characters.");
      return;
    }

    if (mode === "register") {
      if (!fullName) {
        showError("Please enter your name.");
        return;
      }
      if (confirmPassword !== password) {
        showError("Passwords don't match.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        mode === "login" ? { email, password } : { email, password, name: fullName };

      const res = await fetch(`${MoneyFlow.API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      if (!data.token) {
        showError("Signed in, but no session was returned. Please try again.");
        setLoading(false);
        return;
      }

      const isFirstEverAuth = !MoneyFlow.isReturningUser();

      localStorage.setItem("moneyflow_auth_token", data.token);
      MoneyFlow.markAsReturningUser();
      if (mode === "register" && isFirstEverAuth) {
        MoneyFlow.markJustRegistered();
      }
      if (data.user) {
        localStorage.setItem("moneyflow_auth_user", JSON.stringify(data.user));
      }

      window.location.replace("index.html");

    } catch (error) {
      console.error("MoneyFlow: Auth request failed.", error);
      showError("Couldn't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  /* ---------------- UI helpers ---------------- */

  function setLoading(isLoading) {
    els.submitBtn.disabled = isLoading;
    els.submitBtn.classList.toggle("loading", isLoading);

    if (isLoading) {
      els.submitLabel.textContent = mode === "login" ? "Signing In..." : "Creating Account...";
    } else {
      els.submitLabel.textContent = mode === "login" ? "Log In" : "Create Account";
    }
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.classList.add("show");
  }

  function hideError() {
    els.error.textContent = "";
    els.error.classList.remove("show");
  }

});
