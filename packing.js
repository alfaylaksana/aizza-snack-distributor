import { db } from "../firebase.js";

import {
collection,
getDocs,
doc,
setDoc,
deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// DATA PACKING (tiap record = 1 kali proses packing 1 produk)
let packing = JSON.parse(localStorage.getItem("packingAizzay")) || [];

// ANTRIAN ID YANG PERLU DIHAPUS DARI FIREBASE
let antrianHapus = JSON.parse(localStorage.getItem("packingHapusAizzay")) || [];


// SET TANGGAL DEFAULT HARI INI
let inputTanggal = document.getElementById("tanggalPacking");
if(inputTanggal){
    inputTanggal.value = new Date().toISOString().slice(0, 10);
}

// ISI TARIF UPAH DARI LOCAL STORAGE
let inputTarif = document.getElementById("tarifUpahPacking");
if(inputTarif){
    inputTarif.value = localStorage.getItem("packingTarifUpah") || "";
}

// TAMPIL DULUAN DARI LOCAL STORAGE (offline-first)
isiDropdownProduk();
tampilStokBal();
tampilPacking();

prosesAntrianHapus();


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem(
        "packingAizzay",
        JSON.stringify(packing)
    );
}

function simpanAntrianHapus(){
    localStorage.setItem(
        "packingHapusAizzay",
        JSON.stringify(antrianHapus)
    );
}


// AMBIL ITEMS DARI RECORD BELANJA (KOMPATIBEL DENGAN DATA LAMA)
function ambilItemsBelanja(record){

    if(record.items){
        return record.items;
    }

    if(record.kode){
        return [{
            kode: record.kode,
            nama: record.nama,
            jumlahBal: record.jumlahBal,
            hargaPerBal: record.hargaPerBal,
            subtotal: record.total
        }];
    }

    return [];

}


// TOTAL BAL YANG PERNAH DIBELI (DARI RIWAYAT BELANJA) UNTUK SATU KODE PRODUK
function hitungTotalBeli(kode){

    let belanja = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];
    let total = 0;

    belanja.forEach(b=>{
        ambilItemsBelanja(b).forEach(it=>{
            if(it.kode === kode){
                total += Number(it.jumlahBal || 0);
            }
        });
    });

    return total;

}


// TOTAL BAL YANG SUDAH DIPAKAI PACKING UNTUK SATU KODE PRODUK
function hitungTotalDipacking(kode){

    return packing
        .filter(p => p.kode === kode)
        .reduce((total, p)=> total + Number(p.balDipakai || 0), 0);

}


// STOK BAL TERSISA (BELUM DI-PACKING) = TOTAL BELI - TOTAL DIPAKAI
function hitungStokBal(kode){
    return hitungTotalBeli(kode) - hitungTotalDipacking(kode);
}


function ambilProdukByKode(kode){
    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];
    return produkList.find(p => p.kode === kode);
}


// ISI DROPDOWN PRODUK DARI MASTER PRODUK (YANG AKTIF SAJA)
function isiDropdownProduk(){

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];
    let select = document.getElementById("produkPacking");

    if(!select) return;

    select.innerHTML = '<option value="">-- pilih produk --</option>';

    produkList
        .filter(p => p.status !== "nonaktif")
        .forEach(p=>{
            let opt = document.createElement("option");
            opt.value = p.kode;
            opt.textContent = p.kode + " - " + p.nama;
            select.appendChild(opt);
        });

}


// TAMPIL INFO RASIO & STOK BAL SAAT PRODUK DIPILIH
function tampilInfoProduk(){

    let kode = document.getElementById("produkPacking").value;
    let info = document.getElementById("infoProduk");

    if(!kode){
        info.textContent = "";
        hitungPreviewHasil();
        return;
    }

    let p = ambilProdukByKode(kode);
    let stokBal = hitungStokBal(kode);
    let rasio = p && p.rasioPacking ? p.rasioPacking : 0;

    info.innerHTML =
        "Rasio: " + (rasio || "belum diisi di Produk") + " bks/bal &nbsp;|&nbsp; " +
        "Stok Bal Tersisa: " + stokBal + " bal";

    hitungPreviewHasil();

}


// HITUNG PREVIEW HASIL BUNGKUS SEBELUM DISIMPAN
function hitungPreviewHasil(){

    let kode = document.getElementById("produkPacking").value;
    let bal = Number(document.getElementById("balPacking").value) || 0;
    let preview = document.getElementById("previewHasil");

    if(!kode || !bal){
        preview.textContent = "";
        return;
    }

    let p = ambilProdukByKode(kode);
    let rasio = p && p.rasioPacking ? Number(p.rasioPacking) : 0;

    if(!rasio){
        preview.textContent = "⚠️ Rasio Packing produk ini belum diisi di menu Produk";
        return;
    }

    let hasil = bal * rasio;

    let tarif = Number(localStorage.getItem("packingTarifUpah")) || 0;
    let upah = hasil * tarif;

    preview.textContent =
        "Hasil: " + hasil + " bungkus (" + bal + " bal × " + rasio + ")" +
        (tarif > 0 ? " — Upah: Rp " + upah.toLocaleString("id-ID") : "");

}


// SIMPAN TARIF UPAH KE LOCAL STORAGE
function simpanTarifUpah(){
    let tarif = Number(document.getElementById("tarifUpahPacking").value) || 0;
    localStorage.setItem("packingTarifUpah", tarif);
    hitungPreviewHasil();
}


// CATAT/PERBARUI/HAPUS ENTRI KAS OTOMATIS YANG TERKAIT SATU PACKING
function catatKasOtomatis(sumberModul, sumberId, kasKey, jenis, nominal, catatan){

    let kas = JSON.parse(localStorage.getItem("kasAizzay")) || [];
    let antrianHapusKas = JSON.parse(localStorage.getItem("kasHapusAizzay")) || [];

    let lama = kas.filter(t => t.sumber === sumberModul && t.sumberId === sumberId);

    if(lama.length > 0){
        kas = kas.filter(t => !(t.sumber === sumberModul && t.sumberId === sumberId));
        lama.forEach(t => antrianHapusKas.push(t.id));
    }

    if(nominal > 0){
        kas.push({
            id: Date.now() + "_" + Math.random().toString(36).slice(2),
            tanggal: new Date().toISOString().slice(0, 10),
            kas: kasKey,
            jenis: jenis,
            nominal: nominal,
            catatan: catatan,
            sumber: sumberModul,
            sumberId: sumberId,
            sinkron: false
        });
    }

    localStorage.setItem("kasAizzay", JSON.stringify(kas));
    localStorage.setItem("kasHapusAizzay", JSON.stringify(antrianHapusKas));

}


// SIMPAN CATATAN PACKING (HASIL BUNGKUS DIHITUNG OTOMATIS DARI RASIO)
function simpanPacking(){

    let tanggal = document.getElementById("tanggalPacking").value;
    let kode = document.getElementById("produkPacking").value;
    let bal = Number(document.getElementById("balPacking").value);
    let catatan = document.getElementById("catatanPacking").value.trim();

    if(!tanggal || !kode){
        alert("Tanggal dan Produk wajib diisi");
        return;
    }

    if(!bal || bal <= 0){
        alert("Jumlah bal harus lebih dari 0");
        return;
    }

    let p = ambilProdukByKode(kode);
    let rasio = p && p.rasioPacking ? Number(p.rasioPacking) : 0;

    if(!rasio){
        alert("Rasio Packing produk ini belum diisi. Isi dulu di menu Produk (Master Produk).");
        return;
    }

    let stokBal = hitungStokBal(kode);

    if(bal > stokBal){
        let lanjut = confirm(
            "Stok Bal " + kode + " cuma tersisa " + stokBal + ", tapi mau dipakai " + bal +
            ".\n\nLanjutkan tetap? (mungkin ada kulakan yang belum dicatat)"
        );
        if(!lanjut) return;
    }

    let hasilBungkus = bal * rasio;
    let tarifUpah = Number(localStorage.getItem("packingTarifUpah")) || 0;
    let upah = hasilBungkus * tarifUpah;

    let idPacking = Date.now() + "_" + Math.random().toString(36).slice(2);

    packing.push({
        id: idPacking,
        tanggal: tanggal,
        kode: kode,
        nama: p ? p.nama : "",
        balDipakai: bal,
        rasioSaatItu: rasio,
        hasilBungkus: hasilBungkus,
        tarifUpahSaatItu: tarifUpah,
        upah: upah,
        catatan: catatan,
        sinkron: false
    });

    simpanStorage();

    catatKasOtomatis(
        "packing",
        idPacking,
        "usaha",
        "keluar",
        upah,
        "Upah packing " + (p ? p.nama : kode) + " (" + hasilBungkus + " bks, " + tanggal + ")"
    );

    tampilStokBal();
    tampilPacking();
    tampilInfoProduk();

    document.getElementById("balPacking").value = "";
    document.getElementById("catatanPacking").value = "";
    document.getElementById("previewHasil").textContent = "";

    alert("Packing tersimpan: " + hasilBungkus + " bungkus" + (upah > 0 ? " (upah Rp " + upah.toLocaleString("id-ID") + ")" : ""));

    sinkronKeFirebase();

}


// HAPUS SATU CATATAN PACKING
function hapusPacking(id){

    let p = packing.find(x => x.id === id);
    if(!p) return;

    let konfirmasi = confirm(
        "Yakin hapus catatan packing " + p.nama + " (" + p.balDipakai + " bal, " + p.tanggal + ")?"
    );

    if(!konfirmasi) return;

    packing = packing.filter(x => x.id !== id);
    simpanStorage();
    tampilStokBal();
    tampilPacking();

    // Hapus juga entri Kas otomatis (upah) yang terkait packing ini
    catatKasOtomatis("packing", id, "usaha", "keluar", 0, "");

    antrianHapus.push(id);
    simpanAntrianHapus();

    prosesAntrianHapus();

}


// TAMPIL STOK BAL PER PRODUK (BELUM DI-PACKING)
function tampilStokBal(){

    let area = document.getElementById("daftarStokBal");
    if(!area) return;

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];
    let aktif = produkList.filter(p => p.status !== "nonaktif");

    if(aktif.length === 0){
        area.innerHTML = "<p style='font-size:12px;color:#888;'>Belum ada produk.</p>";
        return;
    }

    area.innerHTML = aktif.map(p=>{

        let stok = hitungStokBal(p.kode);
        let kelas = stok < 0 ? "stok-minus" : (stok === 0 ? "stok-habis" : "");

        return `
        <div class="baris-stok ${kelas}">
            <span>${p.kode} - ${p.nama}</span>
            <b>${stok} bal</b>
        </div>
        `;

    }).join("");

}


// TAMPIL RIWAYAT PACKING (DIKELOMPOKKAN PER BULAN, BULAN BERJALAN TERBUKA)
function tampilPacking(){

    let area = document.getElementById("daftarPacking");
    if(!area) return;

    area.innerHTML = "";

    if(packing.length === 0){
        area.innerHTML = "<p style='font-size:12px;color:#888;'>Belum ada riwayat packing.</p>";
        return;
    }

    let urut = [...packing].sort((a, b)=>{
        return new Date(b.tanggal) - new Date(a.tanggal);
    });

    let kelompok = {};

    urut.forEach((p)=>{

        let tgl = p.tanggal ? new Date(p.tanggal) : null;

        let key = tgl
            ? tgl.getFullYear() + "-" + String(tgl.getMonth() + 1).padStart(2, "0")
            : "tanpa-tanggal";

        let label = tgl
            ? tgl.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
            : "Tanpa Tanggal";

        if(!kelompok[key]){
            kelompok[key] = { label: label, items: [] };
        }

        kelompok[key].items.push(p);

    });

    let sekarang = new Date();
    let keyBulanIni = sekarang.getFullYear() + "-" + String(sekarang.getMonth() + 1).padStart(2, "0");

    Object.keys(kelompok).forEach((key)=>{

        let grup = kelompok[key];

        let htmlBaris = grup.items.map((p)=>{

            return `
            <div class="baris-transaksi">
                <div>
                    ${p.tanggal || ""} - <b>${p.nama || p.kode}</b>
                    <div class="baris-catatan">
                        ${p.balDipakai} bal × ${p.rasioSaatItu} = <span class="hasil-bungkus">${p.hasilBungkus} bks</span>
                        ${p.upah ? " — Upah Rp " + Number(p.upah).toLocaleString("id-ID") : ""}
                        ${p.catatan ? " — " + p.catatan : ""}
                    </div>
                </div>
                <button class="btn-icon" onclick="hapusPacking('${p.id}')">🗑️</button>
            </div>
            `;

        }).join("");

        let terbuka = (key === keyBulanIni) ? "open" : "";

        area.innerHTML += `
        <details class="bulan-group" ${terbuka}>
            <summary>${grup.label} <span class="jumlah-bulan">(${grup.items.length})</span></summary>
            <div class="bulan-isi">${htmlBaris}</div>
        </details>
        `;

    });

}


// AMBIL DATA FIREBASE (sinkron di belakang layar, tidak menghalangi tampilan offline)
async function ambilPackingFirebase(){

    try {

        const snapshot = await getDocs(
            collection(db, "packing")
        );

        snapshot.forEach((docSnap)=>{

            const dataFirebase = docSnap.data();

            const indexLokal = packing.findIndex(
                p => p.id === dataFirebase.id
            );

            if(indexLokal >= 0){
                if(packing[indexLokal].sinkron !== false){
                    packing[indexLokal] = {...dataFirebase, sinkron: true};
                }
            } else {
                packing.push({...dataFirebase, sinkron: true});
            }

        });

        simpanStorage();
        tampilStokBal();
        tampilPacking();

    } catch (err) {

        console.log("Gagal sinkron Firebase (mungkin offline):", err.message);

    }

}


// KIRIM DATA LOKAL YANG BELUM TERSINKRON KE FIREBASE
async function sinkronKeFirebase(){

    let adaPerubahan = false;

    for(const p of packing){

        if(p.sinkron === false){

            try {

                await setDoc(doc(db, "packing", p.id), p);

                p.sinkron = true;
                adaPerubahan = true;

            } catch (err) {

                console.log("Gagal sinkron packing " + p.id + ":", err.message);

            }

        }

    }

    if(adaPerubahan){
        simpanStorage();
    }

}

window.addEventListener("online", sinkronKeFirebase);


// PROSES ANTRIAN HAPUS: BENAR-BENAR HAPUS DARI FIREBASE
async function prosesAntrianHapus(){

    let sisaAntrian = [];

    for(const id of antrianHapus){

        try {

            await deleteDoc(doc(db, "packing", id));

        } catch (err) {

            console.log("Gagal hapus packing " + id + " di Firebase (mungkin offline):", err.message);
            sisaAntrian.push(id);

        }

    }

    antrianHapus = sisaAntrian;
    simpanAntrianHapus();

}

window.addEventListener("online", prosesAntrianHapus);


// AGAR BISA DIPANGGIL DARI HTML
window.tampilInfoProduk = tampilInfoProduk;
window.hitungPreviewHasil = hitungPreviewHasil;
window.simpanTarifUpah = simpanTarifUpah;
window.simpanPacking = simpanPacking;
window.hapusPacking = hapusPacking;


// AMBIL DATA FIREBASE SAAT MODUL DIBUKA, LALU SINKRON YANG BELUM TERKIRIM
ambilPackingFirebase().then(sinkronKeFirebase);
