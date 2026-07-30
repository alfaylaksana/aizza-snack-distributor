// AIZZAY Snack Distributor
// Service Worker Versi 0.1

const CACHE_NAME = "aizzay-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];


// Saat aplikasi pertama dipasang
self.addEventListener("install", function(event){

  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(function(cache){

      return cache.addAll(FILES_TO_CACHE);

    })
  );

});


// Mengambil file dari cache jika tersedia
self.addEventListener("fetch", function(event){

  event.respondWith(

    caches.match(event.request)
    .then(function(response){

      return response || fetch(event.request);

    })

  );

});
