
/* ============================================
   MONEYFLOW — SERVICE WORKER
   AMOLED + EMERALD | MORE PAGE UPDATE

   CacheStorage holds only app files.
   Financial records in localStorage/IndexedDB
   are never deleted by this worker.
   ============================================ */


const CACHE_VERSION = "v18-receipts-and-readable-exports-20261015";


const CACHE_NAME =
  `moneyflow-${CACHE_VERSION}`;

/* ============================================
   APP FILES TO CACHE
   ============================================ */

const APP_SHELL = [
  "./index.html",
  "./home.html",

  // AUTHENTICATION
  "./login.html",
  "./welcome.html",

  // MAIN FINANCE PAGES
  "./income.html",
  "./spending.html",
  "./debts.html",
  "./payments.html",
  "./more.html",

  // EXISTING PAGES
  "./analytics.html",
  "./transactions.html",
  "./settings.html",

  // SHARED STYLES
  "./style.css",
  "./home.css",

  // AUTH STYLES
  "./auth.css",
  "./welcome.css",

  // FINANCE STYLES
  "./income.css",
  "./spending.css",
  "./debts.css",
  "./payments.css",
  "./more.css",

  // EXISTING STYLES
  "./analytics.css",
  "./transactions.css",
  "./settings.css",

  // SHARED SCRIPTS
  "./core.js",
  "./dashboard.js",

  // AUTH SCRIPTS
  "./auth.js",
  "./welcome.js",

  // BRANDED DAY AND MONTH SELECTORS
  "./date-picker.js",
  "./date-picker.css",
  "./month-picker.js",
  "./month-picker.css",

  // CONSISTENT CATEGORY ICON LIBRARY
  "./category-icons.js",
  "./category-icons.css",

  // FINANCE SCRIPTS
  "./income.js",
  "./spending.js",
  "./debts.js",
  "./payments.js",
  "./more.js",

  // EXISTING SCRIPTS
  "./analytics.js",
  "./transactions.js",
  "./settings.js",

  // NEW MORE FEATURE PAGES
  "./refer.html",
  "./refer.css",
  "./refer.js",

  "./help.html",
  "./help.css",

  "./budget.html",
  "./budget.css",
  "./budget.js",


  // CALENDAR PAGE
  "./calendar.html",
  "./calendar.css",
  "./calendar.js",

  // INSURANCE PAGE
  "./insurance.html",
  "./insurance.css",
  "./insurance.js",

  // NOTIFICATIONS CENTRE
  "./notifications.html",
  "./notifications.css",
  "./notifications.js",

  // LOCAL RECEIPTS AND FINANCIAL EXPORTS
  "./receipt.html",
  "./receipt.css",
  "./receipt.js",
  "./receipt-actions.css",
  "./moneyflow-export-utils.js",
  "./export.html",
  "./export.css",
  "./export.js",
  "./report.html",
  "./report.css",
  "./report.js",

  // PWA ASSETS
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png"
];

/* ============================================
   INSTALL
   ============================================ */

self.addEventListener("install", (event) => {

  event.waitUntil(
    caches.open(CACHE_NAME).then(
      (cache) => cache.addAll(APP_SHELL)
    )
  );

  // Wait for the update confirmation
  // provided by core.js.
  // Do not reload pages automatically
  // while a form may be open.

});

/* ============================================
   ACTIVATE
   ============================================ */

self.addEventListener("activate", (event) => {

  event.waitUntil(
    (async () => {

      const names = await caches.keys();

      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("moneyflow-") &&
              name !== CACHE_NAME
          )
          .map(
            (name) => caches.delete(name)
          )
      );

      await self.clients.claim();

    })()
  );

});

/* ============================================
   FETCH REQUESTS
   ============================================ */

self.addEventListener("fetch", (event) => {

  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Do not intercept external services,
  // including authentication servers.

  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache API or authentication calls.

  if (
    /^\/(api|auth)(\/|$)/i.test(url.pathname)
  ) {
    return;
  }

  // Let the browser fetch the actual
  // service worker script.
  // The root is served by index.html, which already renders the
  // existing welcome experience. No service-worker redirects needed.
  if (url.pathname.endsWith("/sw.js")) {
    return;
  }

  const path = url.pathname.toLowerCase();

  const isDocument =
    request.mode === "navigate" ||
    path.endsWith(".html") ||
    (
      request.headers.get("accept") || ""
    ).includes("text/html");

  const isCode =
    /\.(?:js|css|json)$/i.test(path);

  const isImage =
    /\.(?:png|jpe?g|webp|svg|ico)$/i.test(path);

  if (isDocument || isCode) {

    // Use fresh deployed files online.
    // Use cached copies offline.

    event.respondWith(
      networkFirst(request, isDocument)
    );

  } else if (isImage) {

    // Images rarely change.
    // Prefer cached images.

    event.respondWith(
      cacheFirst(request)
    );

  }

});

/* ============================================
   NETWORK FIRST
   HTML, CSS, JAVASCRIPT, JSON
   ============================================ */

async function networkFirst(
  request,
  isDocument
) {

  try {

    // Revalidate HTTP cache to help
    // detect new Netlify deployments.

    const response = await fetch(
      request,
      { cache: "no-cache" }
    );

    if (
      response.ok &&
      response.type === "basic"
    ) {

      const cache = await caches.open(
        CACHE_NAME
      );

      await cache.put(
        request,
        response.clone()
      );

    }

    return response;

  } catch (error) {

    // Network unavailable:
    // try the saved file.

    const cached = await caches.match(
      request,
      { ignoreSearch: true }
    );

    if (cached) {
      return cached;
    }

    // Offline page fallback.

    if (
      isDocument &&
      request.mode === "navigate"
    ) {

      const scopeRoot = new URL("./", self.registration.scope).pathname;
      const wanted = new URL(request.url).pathname === scopeRoot
        ? "./index.html"   // Fresh offline website launch: welcome
        : "./home.html";  // Offline document fallback: dashboard
      const fallback = await caches.match(wanted);
      if (fallback) return fallback;

    }

    return Response.error();

  }

}

/* ============================================
   CACHE FIRST
   STATIC IMAGE ASSETS
   ============================================ */

async function cacheFirst(request) {

  const cached = await caches.match(
    request,
    { ignoreSearch: true }
  );

  if (cached) {
    return cached;
  }

  try {

    const response = await fetch(
      request
    );

    if (
      response.ok &&
      response.type === "basic"
    ) {

      const cache = await caches.open(
        CACHE_NAME
      );

      await cache.put(
        request,
        response.clone()
      );

    }

    return response;

  } catch (error) {

    return Response.error();

  }

}

/* ============================================
   ACTIVATE UPDATE WHEN REQUESTED
   ============================================ */

self.addEventListener("message", (event) => {

  if (
    event.data === "SKIP_WAITING" ||
    event.data?.type === "SKIP_WAITING"
  ) {

    self.skipWaiting();

  }

});
