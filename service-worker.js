// AIZZAY Snack Distributor
// Service Worker Versi 0.23

const CACHE_NAME = "aizzay-v23";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./modules/firebase.js",
  "./modules/produk/produk.html",
  "./modules/produk/produk.js",
  "./modules/packing/packing.html",
  "./modules/packing/packing.js",
  "./modules/kas/kas.html",
  "./modules/kas/kas.js",
  "./modules/belanja/belanja.html",
  "./modules/belanja/belanja.js",
  "./modules/toko/toko.html",
  "./modules/toko/toko.js",
  "./modules/pengaturan/pengaturan.html",
  "./modules/pengaturan/pengaturan.js"
];


// Saat aplikasi pertama dipasang / ada versi baru
self.addEventListener("install", function(event){

  self.skipWaiting(); // langsung aktifkan versi baru, tidak nunggu semua tab ditutup

  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(function(cache){

      // Cache satu per satu (bukan addAll) supaya kalau ada 1 file gagal
      // (misal path salah), file lainnya tetap berhasil ke-cache
      return Promise.all(
        FILES_TO_CACHE.map(function(file){
          return cache.add(file).catch(function(err){
            console.log("Gagal precache: " + file, err.message);
          });
        })
      );

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


// Mengambil file dari cache jika tersedia, kalau tidak: ambil dari jaringan
// lalu simpan otomatis ke cache supaya tersedia lagi saat offline nanti
self.addEventListener("fetch", function(event){

  // Cuma urus request GET yang searah sama domain sendiri
  // (request ke Firebase/Firestore dibiarkan lewat apa adanya)
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(

    caches.match(event.request, { ignoreSearch: true })
    .then(function(cachedResponse){

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(function(networkResponse){

          return caches.open(CACHE_NAME).then(function(cache){
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });

        })
        .catch(function(){
          // Offline dan file belum sempat kesimpan di cache
          return new Response(
            "Sedang offline dan halaman ini belum pernah dibuka online sebelumnya.",
            { status: 503, headers: { "Content-Type": "text/plain" } }
          );
        });

    })

  );

});
