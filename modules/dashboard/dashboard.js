// DASHBOARD - RINGKASAN DARI DATA MODUL LAIN
// Modul ini HANYA MEMBACA data dari localStorage, tidak menulis apa pun.
// Rumus stok mengikuti persis logika di modules/laporan/laporan.js biar konsisten.

function muatDashboard(){

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];
    let belanja = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];
    let packing = JSON.parse(localStorage.getItem("packingAizzay")) || [];
    let titipan = JSON.parse(localStorage.getItem("titipanAizzay")) || [];
    let kas = JSON.parse(localStorage.getItem("kasAizzay")) || [];

    let aktif = produkList.filter(p => p.status !== "nonaktif");

    function ambilItemsBelanja(record){
        if(record.items) return record.items;
        if(record.kode) return [{ kode: record.kode, jumlahBal: record.jumlahBal }];
        return [];
    }

    let totalStokBal = 0;
    let totalStokGudang = 0;
    let totalStokToko = 0;

    aktif.forEach(p=>{

        let kode = p.kode;

        // STOK BAL DI GUDANG = TOTAL BELI - TOTAL DIAMBIL PACKING (AMBIL MAUPUN SELESAI)
        let totalBeliBal = 0;
        belanja.forEach(b=>{
            ambilItemsBelanja(b).forEach(it=>{
                if(it.kode === kode) totalBeliBal += Number(it.jumlahBal || 0);
            });
        });
        let totalDiambilPacking = packing
            .filter(pk => pk.kode === kode)
            .reduce((s, pk)=> s + Number(pk.balDipakai || 0), 0);
        totalStokBal += totalBeliBal - totalDiambilPacking;

        // STOK BUNGKUS DI GUDANG = HASIL PACKING SELESAI - TOTAL DIKIRIM KE SEMUA TOKO
        let totalHasilPacking = packing
            .filter(pk => pk.kode === kode && pk.status === "selesai")
            .reduce((s, pk)=> s + Number(pk.hasilBungkus || 0), 0);

        let totalDikirimSemua = 0;
        titipan.forEach(t=>{
            (t.items || []).forEach(it=>{
                if(it.kode === kode) totalDikirimSemua += Number(it.jumlahKirim || 0);
            });
        });

        totalStokGudang += totalHasilPacking - totalDikirimSemua;

        // STOK MASIH DI TOKO = TITIPAN YANG BELUM DI-SETTLE
        titipan.filter(t => t.status !== "selesai").forEach(t=>{
            (t.items || []).forEach(it=>{
                if(it.kode === kode) totalStokToko += Number(it.jumlahKirim || 0);
            });
        });

    });

    // PACKING: SEDANG PROSES (STATUS "AMBIL") + SELESAI BULAN BERJALAN
    let sedangProses = packing.filter(pk => pk.status === "ambil").length;

    let sekarang = new Date();
    let selesaiBulanIni = packing.filter(pk=>{
        if(pk.status !== "selesai" || !pk.tanggalSelesai) return false;
        let d = new Date(pk.tanggalSelesai);
        return d.getFullYear() === sekarang.getFullYear() && d.getMonth() === sekarang.getMonth();
    }).length;

    // SALDO KAS USAHA SAJA
    let saldoUsaha = kas
        .filter(t => t.kas === "usaha")
        .reduce((total, t)=>{
            let nominal = Number(t.nominal || 0);
            return total + (t.jenis === "masuk" ? nominal : -nominal);
        }, 0);

    // TAMPILKAN KE 5 KARTU
    let elStokJadi = document.getElementById("stokJadi");
    if(elStokJadi) elStokJadi.textContent = totalStokGudang + " bungkus";

    let elStokBal = document.getElementById("stokBal");
    if(elStokBal) elStokBal.textContent = totalStokBal + " bal";

    let elPacking = document.getElementById("packing");
    if(elPacking) elPacking.textContent = sedangProses + " proses, " + selesaiBulanIni + " selesai bln ini";

    let elDiToko = document.getElementById("diToko");
    if(elDiToko) elDiToko.textContent = totalStokToko + " bungkus";

    let elKas = document.getElementById("kas");
    if(elKas) elKas.textContent = "Rp " + saldoUsaha.toLocaleString("id-ID");

}

// AGAR BISA DIPANGGIL DARI HTML / SCRIPT LAIN
window.muatDashboard = muatDashboard;
