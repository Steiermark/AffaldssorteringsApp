const CACHE_NAME = "sorteringshjaelp-v65";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/sorting-mark.svg",
  "./assets/pictograms/cardboard.png",
  "./assets/pictograms/batteries.png",
  "./assets/pictograms/hazardous.png",
  "./assets/pictograms/glass.png",
  "./assets/pictograms/metal.png",
  "./assets/pictograms/plastic.png",
  "./assets/pictograms/unknown.svg",
  "./data/fractions.js",
  "./data/fractions.json",
  "./data/national-sites.js",
  "./data/national-sites.json",
  "./data/site-layouts.js",
  "./data/site-layouts.json",
  "./data/site-layout-coverage.json",
  "./data/site-maps/esbjerg/oversigtskort-bramming.png",
  "./data/site-maps/esbjerg/oversigtskort-maade.png",
  "./data/site-maps/esbjerg/oversigtskort-ribe.png",
  "./data/site-maps/esbjerg/oversigtskort-tarp.png",
  "./data/municipal/0530.json",
  "./data/utility/0530-affaldspartner.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      try {
        const response = await fetch("./data/fractions.json");
        const fractions = await response.json();
        const pictograms = fractions
          .map((fraction) => fraction.pictogram)
          .filter(Boolean);
        await cache.addAll(pictograms);
      } catch (error) {
        // The app shell still works if the generated catalog cannot be cached.
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
  );
});
