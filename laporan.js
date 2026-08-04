// LAPORAN - GABUNGAN DARI KAS, TOKO, BELANJA, PACKING
// Modul ini hanya MEMBACA data dari modul lain, tidak menulis apa pun.

// SET BULAN DEFAULT = BULAN BERJALAN
let inputBulan = document.getElementById("bulanLaporan");
if(inputBulan){
    let sekarang = new Date();
    inputBulan.value =
        sekarang.getFullYear() + "-" + String(sekarang.getMonth() + 1).padStart(2, "0");
}

muatLaporan();


function muatLaporan(){
    tampilLabaRugi();
    tampilPenjualanToko();
    tampilRekapStok();
}


// AMBIL {tahun, bulan} DARI INPUT month (format "YYYY-MM")
function ambilPeriodeTerpilih(){
    let nilai = document.getElementById("bulanLaporan").value;
    if(!nilai) return null;
    let [tahun, bulan] = nilai.split("-").map(Number);
    return { tahun: tahun, bulan: bulan }; // bulan 1-12
}

function tanggalMasukPeriode(tanggalStr, periode){
    if(!tanggalStr || !periode) return false;
    let d = new Date(tanggalStr);
    return (d.getFullYear() === periode.tahun) && (d.getMonth() + 1 === periode.bulan);
}


// ================== LABA / RUGI (DARI KAS USAHA) ==================

function ambilKategoriBelanja(sumberId){
    let belanja = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];
    let rec = belanja.find(b => b.id === sumberId);
    return rec ? (rec.kategori || "snack") : "lainnya";
}

function tampilLabaRugi(){

    let area = document.getElementById("laporanLabaRugi");
    if(!area) return;

    let periode = ambilPeriodeTerpilih();
    let kas = JSON.parse(localStorage.getItem("kasAizzay")) || [];

    // Cuma Kas Usaha, dan bukan transfer internal (transfer bukan laba/rugi riil)
    let dataPeriode = kas.filter(t =>
        t.kas === "usaha" &&
        t.sumber !== "transfer" &&
        tanggalMasukPeriode(t.tanggal, periode)
    );

    let totalMasuk = 0;
    let totalKeluar = 0;

    let rincianMasuk = {}; // { toko: x, manual: x }
    let rincianKeluar = { snack: 0, plastik: 0, lainlain: 0, "packing-upah": 0, manual: 0, lainnya: 0 };

    dataPeriode.forEach(t=>{

        let nominal = Number(t.nominal || 0);

        if(t.jenis === "masuk"){

            totalMasuk += nominal;

            let sumber = t.sumber || "manual";
            rincianMasuk[sumber] = (rincianMasuk[sumber] || 0) + nominal;

        } else {

            totalKeluar += nominal;

            if(t.sumber === "belanja"){
                let kategori = ambilKategoriBelanja(t.sumberId);
                rincianKeluar[kategori] = (rincianKeluar[kategori] || 0) + nominal;
            } else if(t.sumber === "packing-upah"){
                rincianKeluar["packing-upah"] += nominal;
            } else if(t.sumber === "manual" || !t.sumber){
                rincianKeluar.manual += nominal;
            } else {
                rincianKeluar.lainnya += nominal;
            }

        }

    });

    let labaRugi = totalMasuk - totalKeluar;

    let htmlRincianKeluar = `
        <div class="baris-rincian"><span>🍿 Belanja Snack Bal-an</span><span>Rp ${rincianKeluar.snack.toLocaleString("id-ID")}</span></div>
        <div class="baris-rincian"><span>🛍️ Belanja Plastik Packing</span><span>Rp ${rincianKeluar.plastik.toLocaleString("id-ID")}</span></div>
        <div class="baris-rincian"><span>🔧 Belanja Lain-lain</span><span>Rp ${rincianKeluar.lainlain.toLocaleString("id-ID")}</span></div>
        <div class="baris-rincian"><span>👷 Upah Packing</span><span>Rp ${rincianKeluar["packing-upah"].toLocaleString("id-ID")}</span></div>
        <div class="baris-rincian"><span>✍️ Pengeluaran Manual</span><span>Rp ${rincianKeluar.manual.toLocaleString("id-ID")}</span></div>
        ${rincianKeluar.lainnya > 0 ? `<div class="baris-rincian"><span>Lainnya</span><span>Rp ${rincianKeluar.lainnya.toLocaleString("id-ID")}</span></div>` : ""}
    `;

    let htmlRincianMasuk = Object.keys(rincianMasuk).map(sumber=>{
        let label = sumber === "toko" ? "🏪 Setoran Toko" : sumber === "manual" ? "✍️ Pemasukan Manual" : sumber;
        return `<div class="baris-rincian"><span>${label}</span><span>Rp ${rincianMasuk[sumber].toLocaleString("id-ID")}</span></div>`;
    }).join("");

    area.innerHTML = `
        <div class="ringkasan-besar"><span>Total Pemasukan</span><span class="nominal-masuk">+ Rp ${totalMasuk.toLocaleString("id-ID")}</span></div>
        <div class="sub-rincian">${htmlRincianMasuk || "<p style='color:#999;'>Belum ada pemasukan bulan ini.</p>"}</div>

        <div class="ringkasan-besar"><span>Total Pengeluaran</span><span class="nominal-keluar">- Rp ${totalKeluar.toLocaleString("id-ID")}</span></div>
        <div class="sub-rincian">${htmlRincianKeluar}</div>

        <div class="ringkasan-besar">
            <span><b>${labaRugi >= 0 ? "LABA" : "RUGI"}</b></span>
            <span class="${labaRugi >= 0 ? "laba" : "rugi"}">Rp ${Math.abs(labaRugi).toLocaleString("id-ID")}</span>
        </div>
    `;

}


// ================== PENJUALAN PER TOKO ==================

function tampilPenjualanToko(){

    let area = document.getElementById("laporanToko");
    if(!area) return;

    let periode = ambilPeriodeTerpilih();
    let titipan = JSON.parse(localStorage.getItem("titipanAizzay")) || [];

    let selesaiPeriode = titipan.filter(t =>
        t.status === "selesai" && tanggalMasukPeriode(t.tanggalSettle, periode)
    );

    if(selesaiPeriode.length === 0){
        area.innerHTML = "<p style='color:#888;'>Belum ada penjualan (settle) bulan ini.</p>";
        return;
    }

    let rekapToko = {}; // { namaToko: { totalRp, totalTerjual, bagus, rusakBks, mlempem, tengik, jumlahSettle } }

    selesaiPeriode.forEach(t=>{

        let nama = t.toko || "(Tanpa nama)";

        if(!rekapToko[nama]){
            rekapToko[nama] = { totalRp: 0, totalTerjual: 0, bagus: 0, rusakBks: 0, mlempem: 0, tengik: 0, jumlahSettle: 0 };
        }

        rekapToko[nama].totalRp += Number(t.totalUangSettle || 0);
        rekapToko[nama].jumlahSettle += 1;

        (t.itemsSettle || []).forEach(it=>{
            rekapToko[nama].totalTerjual += Number(it.jumlahTerjual || 0);
            rekapToko[nama].bagus += Number(it.returBagus || 0);
            rekapToko[nama].rusakBks += Number(it.returRusakBks || 0);
            rekapToko[nama].mlempem += Number(it.returMlempem || 0);
            rekapToko[nama].tengik += Number(it.returTengik || 0);
        });

    });

    let namaTokoUrut = Object.keys(rekapToko).sort((a, b)=> rekapToko[b].totalRp - rekapToko[a].totalRp);

    area.innerHTML = namaTokoUrut.map(nama=>{

        let r = rekapToko[nama];

        let rincianRetur = [];
        if(r.bagus > 0) rincianRetur.push("Bagus " + r.bagus);
        if(r.rusakBks > 0) rincianRetur.push("Rusak Bks " + r.rusakBks);
        if(r.mlempem > 0) rincianRetur.push("Mlempem " + r.mlempem);
        if(r.tengik > 0) rincianRetur.push("Tengik " + r.tengik);

        return `
        <div class="baris-toko">
            <div class="nama-toko">${nama}</div>
            <div>Terjual: ${r.totalTerjual} bks — Rp ${r.totalRp.toLocaleString("id-ID")} (${r.jumlahSettle}x settle)</div>
            ${rincianRetur.length > 0 ? `<div class="rincian-retur">🔴 Retur: ${rincianRetur.join(", ")}</div>` : ""}
        </div>
        `;

    }).join("");

}


// ================== REKAP STOK (SNAPSHOT SAAT INI, BUKAN PER PERIODE) ==================

function ambilItemsBelanja(record){
    if(record.items) return record.items;
    if(record.kode){
        return [{ kode: record.kode, jumlahBal: record.jumlahBal }];
    }
    return [];
}

function ambilItemsPacking(record){
    if(record.items) return record.items;
    if(record.kode){
        return [{
            kode: record.kode,
            balDipakai: record.balDipakai,
            hasilBungkus: record.hasilBungkus
        }];
    }
    return [];
}

function tampilRekapStok(){

    let area = document.getElementById("laporanStok");
    if(!area) return;

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];
    let belanja = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];
    let packing = JSON.parse(localStorage.getItem("packingAizzay")) || [];
    let titipan = JSON.parse(localStorage.getItem("titipanAizzay")) || [];

    let aktif = produkList.filter(p => p.status !== "nonaktif");

    if(aktif.length === 0){
        area.innerHTML = "<p style='color:#888;'>Belum ada produk.</p>";
        return;
    }

    let baris = aktif.map(p=>{

        let kode = p.kode;

        // Stok Bal di gudang = total dibeli - total sudah diambil packing (ambil maupun selesai)
        let totalBeliBal = 0;
        belanja.forEach(b=>{
            ambilItemsBelanja(b).forEach(it=>{
                if(it.kode === kode) totalBeliBal += Number(it.jumlahBal || 0);
            });
        });
        let totalDiambilPacking = 0;
        packing.forEach(pk=>{
            ambilItemsPacking(pk).forEach(it=>{
                if(it.kode === kode) totalDiambilPacking += Number(it.balDipakai || 0);
            });
        });
        let stokBal = totalBeliBal - totalDiambilPacking;

        // Stok Bungkus di gudang (siap kirim) = total hasil packing selesai - total sudah dikirim ke semua toko (semua status)
        let totalHasilPacking = 0;
        packing.filter(pk => pk.status === "selesai").forEach(pk=>{
            ambilItemsPacking(pk).forEach(it=>{
                if(it.kode === kode) totalHasilPacking += Number(it.hasilBungkus || 0);
            });
        });

        let totalDikirimSemua = 0;
        titipan.forEach(t=>{
            (t.items || []).forEach(it=>{
                if(it.kode === kode) totalDikirimSemua += Number(it.jumlahKirim || 0);
            });
        });

        let stokBungkusGudang = totalHasilPacking - totalDikirimSemua;

        // Stok yang masih di toko (titipan yang belum di-settle)
        let stokDiToko = 0;
        titipan.filter(t => t.status !== "selesai").forEach(t=>{
            (t.items || []).forEach(it=>{
                if(it.kode === kode) stokDiToko += Number(it.jumlahKirim || 0);
            });
        });

        return { kode, nama: p.nama, stokBal, stokBungkusGudang, stokDiToko };

    });

    area.innerHTML = `
        <table class="tabel-stok">
        <tr>
            <th>Produk</th>
            <th>Bal</th>
            <th>Bks Gudang</th>
            <th>Bks di Toko</th>
        </tr>
        ${baris.map(b => `
        <tr>
            <td>${b.kode} - ${b.nama}</td>
            <td>${b.stokBal}</td>
            <td>${b.stokBungkusGudang}</td>
            <td>${b.stokDiToko}</td>
        </tr>
        `).join("")}
        </table>
    `;

}


// AGAR BISA DIPANGGIL DARI HTML
window.muatLaporan = muatLaporan;
