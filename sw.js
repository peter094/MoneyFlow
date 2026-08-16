/* =====================================================================
   MONEYFLOW — SERVICE WORKER

   HOW TO RELEASE AN UPDATE:
   Bump CACHE_VERSION below (e.g. "v1" -> "v2") whenever you publish
   changed files. That's the entire update mechanism — activate()
   automatically deletes every old "moneyflow-*" cache that doesn't
   match the new version, so nobody stays stuck on stale files.
   Don't rename anything else in this file when you do that.
   ===================================================================== */

const CACHE_VERSION = "v2";
const CACHE_NAME = `moneyflow-${CACHE_VERSION}`;

// Paths are relative to this file's own location. That's what makes
// this work whether MoneyFlow is served from a domain root or a
// GitHub Pages subpath like /MoneyFlow/ — no hardcoded username or
// repo name needed anywhere in this file.
const APP_SHELL = [
  "./",
  "./index.html",
  "./transactions.html",
  "./analytics.html",
  "./settings.html",
  "./style.css",
  "./core.js",
  "./dashboard.js",
  "./transactions.js",
  "./analytics.js",
  "./settings.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

/* ---------------- Install: precache the app shell ---------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll fails entirely if even one file 404s — that's
      // intentional here, it surfaces a bad deploy immediately
      // instead of silently caching a broken app shell.
      await cache.addAll(APP_SHELL);
    })()
  );
});

/* ---------------- Activate: drop old-version caches ---------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("moneyflow-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/* ---------------- Fetch: network-first for pages, cache-first for assets ---------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests — POST/etc. (none in this app, but
  // future-proof) should just go straight to the network untouched.
  if (request.method !== "GET") return;

  const isHTML =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  event.respondWith(isHTML ? networkFirst(request) : cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Offline, or the network request failed — fall back to
    // whatever's cached, and if this exact page was never cached,
    // fall back to the app shell itself rather than a browser
    // "no internet" error page.
    const cached = await caches.match(request);
    return cached || caches.match("./index.html");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Nothing cached and no network — let it fail naturally
    // (e.g. a font loaded from an external CDN while offline).
    return cached;
  }
}

/* ---------------- Update handshake ---------------- */
// core.js shows a "Refresh to update" banner when a new version has
// finished installing. When the person taps it, this message tells
// the waiting worker to take over immediately.

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
