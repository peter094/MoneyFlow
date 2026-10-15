
(() => {
  "use strict";

  const splash = document.getElementById("splash");
  const onboarding = document.getElementById("onboarding");
  const slides = [...document.querySelectorAll(".slide")];
  const dots = [...document.querySelectorAll(".dot")];
  const nextBtn = document.getElementById("nextBtn");
  const skipBtn = document.getElementById("skipBtn");
  const slideArea = document.getElementById("slides");

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let currentSlide = 0;
  let touchStartX = null;

  function showSlide(index) {
    currentSlide = Math.max(
      0,
      Math.min(index, slides.length - 1)
    );

    slides.forEach((slide, i) => {
      const active = i === currentSlide;
      slide.classList.toggle("active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentSlide);
      if (i === currentSlide) {
        dot.setAttribute("aria-current", "step");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    const lastSlide = currentSlide === slides.length - 1;

    const arrow = `
  <svg class="mf-arrow mf-arrow-right"
       viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14m-6-6 6 6-6 6"/>
  </svg>
`;

nextBtn.innerHTML = (lastSlide
  ? "Get Started"
  : "Continue") + arrow;

    skipBtn.hidden = lastSlide;
  }

  
let isLeaving = false;

function finishOnboarding() {
  if (isLeaving) return;
  isLeaving = true;

  try {
    localStorage.setItem(
      "moneyflow_onboarding_complete",
      "true"
    );
  } catch (error) {
    console.warn("Could not save onboarding state", error);
  }

  const duration = reducedMotion ? 0 : 420;

  onboarding.classList.add("leaving");

  window.setTimeout(() => {
    window.location.replace("login.html");
  }, duration);
}


  nextBtn.addEventListener("click", () => {
    if (currentSlide < slides.length - 1) {
      showSlide(currentSlide + 1);
    } else {
      finishOnboarding();
    }
  });

  skipBtn.addEventListener("click", finishOnboarding);

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.slide));
    });
  });

  slideArea.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  slideArea.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;

    const touchEndX = event.changedTouches[0].screenX;
    const distance = touchEndX - touchStartX;

    touchStartX = null;

    if (Math.abs(distance) < 45) return;

    if (distance < 0) {
      showSlide(currentSlide + 1);
    } else {
      showSlide(currentSlide - 1);
    }
  }, { passive: true });

  slideArea.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(currentSlide + 1);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(currentSlide - 1);
    }
  });

  function startOnboarding() {
    onboarding.hidden = false;
    showSlide(0);
    splash.classList.add("exit");

    window.setTimeout(() => {
      splash.hidden = true;
    }, reducedMotion ? 0 : 550);
  }

  // The existing splash plays at every fresh welcome-page visit.
  // The three onboarding slides are only for genuinely new visitors.
  // Existing sign-ins go to Home; returning logged-out users go to Login.
  let destination = null;
  try {
    const authenticated = !!localStorage.getItem("moneyflow_auth_token");
    const hasIntroduced = localStorage.getItem("moneyflow_onboarding_complete") === "true" ||
      !!localStorage.getItem("moneyflow_returning_user");
    if (authenticated) destination = "home.html";
    else if (hasIntroduced) destination = "login.html";
  } catch (error) {
    // Storage may be blocked. Show the first-run experience instead.
  }

  window.setTimeout(() => {
    if (!destination) {
      startOnboarding();
      return;
    }
    splash.classList.add("exit");
    window.setTimeout(() => window.location.replace(destination), reducedMotion ? 0 : 350);
  }, reducedMotion ? 400 : 1650);
})();
