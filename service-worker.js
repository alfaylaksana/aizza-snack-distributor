// AIZZAY Snack Distributor
// Service Worker Versi 0.3

const CACHE_NAME = "aizzay-v3";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];


// Saat aplikasi pertama dipasang / ada versi baru
self.addEventListener("install", function(event){

  self.skipWaiting(); // langsung aktifkan versi baru, tidak nunggu semua tab ditutup

  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(function(cache){

      return cache.addAll(FILES_TO_CACHE);

    })
  );

});


// Hapus cache versi lama begitu versi baru aktif
self.addEventListener("activate", function(event){

  event.waitUntil(

    caches.keys().then(function(daftarCache){

      return Promise.all(

        daftarCache
          .filter(function(nama){ return nama !== CACHE_NAME; })
          .map(function(nama){ return caches.delete(nama); })

      );

    }).then(function(){

      return self.clients.claim(); // ambil alih tab yang sudah terbuka juga

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
