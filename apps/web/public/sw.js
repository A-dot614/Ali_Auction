/* Slice 9 PWA service worker (D8). Caches only the app shell, static build assets,
   and public catalogue pages for a short placeholder TTL. Never caches /graphql,
   any credentialed/cookie response, or any private route. */

const CACHE = "aliauction-shell-v1";
const SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/icons/icon-placeholder.svg"];
// NOT FOR PRODUCTION placeholder TTL (5 minutes); pending policy review.
const PUBLIC_TTL_MS = 5 * 60 * 1000;
const PRIVATE_PREFIXES = ["/graphql", "/auth", "/account", "/buyer", "/seller", "/admin"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function isPrivate(pathname) {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isStatic(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/") || pathname === "/manifest.webmanifest";
}

function isPublicPage(pathname) {
  return pathname === "/" || pathname === "/search" || pathname.startsWith("/categories/") || pathname.startsWith("/listings/");
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && !response.headers.has("set-cookie")) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match(request)) || (await cache.match("/offline.html")) || Response.error();
  }
}

async function cachedWithTtl(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    const stored = Number(cached.headers.get("x-sw-cached-at") || "0");
    if (Date.now() - stored < PUBLIC_TTL_MS) return cached;
  }
  const response = await fetch(request);
  if (response.ok && !response.headers.has("set-cookie")) {
    const headers = new Headers(response.headers);
    headers.set("x-sw-cached-at", String(Date.now()));
    await cache.put(request, new Response(response.body, { status: response.status, headers }));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cookie-bearing or credentialed requests are never cached or intercepted for offline data.
  const credentialed = request.headers.has("cookie") || request.credentials === "include";
  if (isPrivate(url.pathname) || credentialed) return;

  if (isStatic(url.pathname)) {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(request).then((hit) => hit || fetch(request))));
    return;
  }
  if (isPublicPage(url.pathname)) {
    event.respondWith(cachedWithTtl(request).catch(() => caches.open(CACHE).then((cache) => cache.match(request)).then((hit) => hit || caches.open(CACHE).then((c) => c.match("/offline.html")))));
    return;
  }
  if (request.mode === "navigate") event.respondWith(networkFirst(request));
});
