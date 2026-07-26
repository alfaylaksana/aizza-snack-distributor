// AIZZA SNACK DISTRIBUTOR
// Versi 0.1

console.log("AIZZA Snack Distributor aktif");


// Data sementara dashboard
let dataAizza = {
    stokJadi: 0,
    stokBal: 0,
    packing: 0,
    diToko: 0,
    kas: 0
};


// Tampilkan data dashboard
function tampilkanDashboard(){

    document.getElementById("stokJadi").innerHTML =
        dataAizza.stokJadi + " bungkus";

    document.getElementById("stokBal").innerHTML =
        dataAizza.stokBal + " bal";

    document.getElementById("packing").innerHTML =
        dataAizza.packing + " proses";

    document.getElementById("diToko").innerHTML =
        dataAizza.diToko + " bungkus";

    document.getElementById("kas").innerHTML =
        "Rp " + dataAizza.kas.toLocaleString("id-ID");
}


// Jalankan saat halaman dibuka
tampilkanDashboard();


// Tombol menu sementara


// Aktifkan PWA Service Worker

if ("serviceWorker" in navigator){

  navigator.serviceWorker.register("service-worker.js")
  .then(function(){

    console.log("AIZZA PWA siap digunakan");

  });

}
