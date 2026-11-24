/* PyPad — service worker
   1. Rend input() possible : le worker Python fait une requête synchrone vers __pypad_input__,
      que l'on garde en attente jusqu'à ce que la page envoie la réponse de l'élève.
   2. Met l'app et Python en cache pour fonctionner hors ligne après le premier lancement. */

const VERSION = "pypad-v2";
const SHELL = [
  "./",
  "./index.html",
  "./worker.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

const waiting = new Map(); // id → fonction de réponse
const early = new Map();   // réponses arrivées avant la requête

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const m = event.data;
  if (!m || m.type !== "input-reply") return;
  const reply = waiting.get(m.id);
  if (reply) {
    waiting.delete(m.id);
    reply(m);
  } else {
    early.set(m.id, m);
  }
});

function inputResponse(m) {
  return new Response(JSON.stringify({ value: m.value == null ? "" : String(m.value), cancel: !!m.cancel }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.endsWith("/__pypad_input__")) {
    const id = url.searchParams.get("id");
    event.respondWith(new Promise((resolve) => {
      const done = (m) => resolve(inputResponse(m));
      if (early.has(id)) {
        const m = early.get(id);
        early.delete(id);
        done(m);
      } else {
        waiting.set(id, done);
      }
    }));
    return;
  }

  if (event.request.method !== "GET") return;

  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/pyodide/")) {
    event.respondWith(cacheFirst(event.request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
  }
});
