import { db } from "../firebase.js";

import {
collection,
getDocs,
doc,
setDoc,
deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// DATA KAS (tiap record = 1 transaksi: pemasukan/pengeluaran/transfer)
let kas = JSON.parse(localStorage.getItem("kasAizzay")) || [];

// ANTRIAN ID YANG PERLU DIHAPUS DARI FIREBASE (untuk yang dihapus saat offline)
let antrianHapus = JSON.parse(localStorage.getItem("kasHapusAizzay")) || [];


// SET TANGGAL DEFAULT HARI INI
let inputTanggal = document.getElementById("tanggalKas");
if(inputTanggal){
    inputTanggal.value = new Date().toISOString().slice(0, 10);
}

// TAMPIL DULUAN DARI LOCAL STORAGE (offline-first)
tampilSaldo();
tampilKas();


// UBAH FORMAT TANGGAL DARI YYYY-MM-DD (input HTML) JADI DD-MM-YYYY (tampilan)
function formatTanggalID(tgl){
    if(!tgl) return "";
    let bagian = tgl.split("-");
    if(bagian.length !== 3) return tgl;
    return bagian[2] + "-" + bagian[1] + "-" + bagian[0];
}


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem(
        "kasAizzay",
        JSON.stringify(kas)
    );
}

// SIMPAN ANTRIAN HAPUS KE LOCAL STORAGE
function simpanAntrianHapus(){
    localStorage.setItem(
        "kasHapusAizzay",
        JSON.stringify(antrianHapus)
    );
}


// LABEL NAMA KAS UNTUK TAMPILAN
function labelKas(kasKey){
    return kasKey === "usaha" ? "Usaha" : "Pribadi";
}


// HITUNG SALDO SATU KAS
function hitungSaldo(kasKey){

    return kas
        .filter(t => t.kas === kasKey)
        .reduce((total, t)=>{
            let nominal = Number(t.nominal || 0);
            return total + (t.jenis === "masuk" ? nominal : -nominal);
        }, 0);

}


// TAMPILKAN SALDO KAS USAHA & PRIBADI
function tampilSaldo(){

    document.getElementById("saldoUsaha").textContent =
        "Rp " + hitungSaldo("usaha").toLocaleString("id-ID");

    document.getElementById("saldoPribadi").textContent =
        "Rp " + hitungSaldo("pribadi").toLocaleString("id-ID");

}


// SIMPAN TRANSAKSI MANUAL (PEMASUKAN / PENGELUARAN)
function simpanTransaksiKas(){

    let tanggal = document.getElementById("tanggalKas").value;
    let kasTujuan = document.getElementById("kasTujuan").value;
    let jenis = document.getElementById("jenisKas").value;
    let nominal = Number(document.getElementById("nominalKas").value);
    let catatan = document.getElementById("catatanKas").value.trim();

    if(!tanggal){
        alert("Tanggal belum diisi");
        return;
    }

    if(!nominal || nominal <= 0){
        alert("Nominal belum diisi / harus lebih dari 0");
        return;
    }

    kas.push({
        id: Date.now() + "_" + Math.random().toString(36).slice(2),
        tanggal: tanggal,
        kas: kasTujuan,
        jenis: jenis,
        nominal: nominal,
        catatan: catatan,
        sumber: "manual",
        sinkron: false
    });

    simpanStorage();
    tampilSaldo();
    tampilKas();

    document.getElementById("nominalKas").value = "";
    document.getElementById("catatanKas").value = "";

    sinkronKeFirebase();

}


// TRANSFER ANTAR KAS (BIKIN 2 RECORD BERPASANGAN: KELUAR DARI ASAL, MASUK KE TUJUAN)
function transferKas(){

    let dari = document.getElementById("transferDari").value;
    let ke = document.getElementById("transferKe").value;
    let nominal = Number(document.getElementById("nominalTransfer").value);
    let catatan = document.getElementById("catatanTransfer").value.trim();

    if(dari === ke){
        alert("Kas asal dan kas tujuan tidak boleh sama");
        return;
    }

    if(!nominal || nominal <= 0){
        alert("Nominal belum diisi / harus lebih dari 0");
        return;
    }

    let tanggal = new Date().toISOString().slice(0, 10);
    let transferId = Date.now() + "_" + Math.random().toString(36).slice(2);

    let catatanKeluar = "Transfer ke Kas " + labelKas(ke) + (catatan ? " - " + catatan : "");
    let catatanMasuk = "Transfer dari Kas " + labelKas(dari) + (catatan ? " - " + catatan : "");

    kas.push({
        id: transferId + "_keluar",
        tanggal: tanggal,
        kas: dari,
        jenis: "keluar",
        nominal: nominal,
        catatan: catatanKeluar,
        sumber: "transfer",
        transferId: transferId,
        sinkron: false
    });

    kas.push({
        id: transferId + "_masuk",
        tanggal: tanggal,
        kas: ke,
        jenis: "masuk",
        nominal: nominal,
        catatan: catatanMasuk,
        sumber: "transfer",
        transferId: transferId,
        sinkron: false
    });

    simpanStorage();
    tampilSaldo();
    tampilKas();

    document.getElementById("nominalTransfer").value = "";
    document.getElementById("catatanTransfer").value = "";

    alert("Transfer berhasil dicatat");

    sinkronKeFirebase();

}


// HAPUS SATU TRANSAKSI (KALAU BAGIAN DARI TRANSFER, HAPUS PASANGANNYA JUGA)
function hapusTransaksiKas(id){

    let t = kas.find(x => x.id === id);
    if(!t) return;

    let pasangan = t.transferId
        ? kas.filter(x => x.transferId === t.transferId)
        : [t];

    let pesanKonfirmasi = t.transferId
        ? "Ini bagian dari transfer antar kas. Hapus kedua sisi transfer ini?"
        : "Yakin hapus transaksi ini (" + (t.catatan || t.jenis) + ", Rp " + Number(t.nominal).toLocaleString("id-ID") + ")?";

    let konfirmasi = confirm(pesanKonfirmasi);
    if(!konfirmasi) return;

    let idYangDihapus = pasangan.map(x => x.id);

    kas = kas.filter(x => !idYangDihapus.includes(x.id));
    simpanStorage();
    tampilSaldo();
    tampilKas();

    idYangDihapus.forEach(idHapus => antrianHapus.push(idHapus));
    simpanAntrianHapus();

    prosesAntrianHapus();

}


// TAMPIL RIWAYAT TRANSAKSI (DIKELOMPOKKAN PER BULAN, BULAN BERJALAN TERBUKA)
function tampilKas(){

    let area = document.getElementById("daftarKas");
    if(!area) return;

    let filter = document.getElementById("filterKas").value;

    let data = filter === "semua"
        ? kas
        : kas.filter(t => t.kas === filter);

    area.innerHTML = "";

    if(data.length === 0){
        area.innerHTML = "<p style='font-size:12px;color:#888;'>Belum ada transaksi.</p>";
        return;
    }

    let urut = [...data].sort((a, b)=>{
        return new Date(b.tanggal) - new Date(a.tanggal);
    });

    let kelompok = {};

    urut.forEach((t)=>{

        let tgl = t.tanggal ? new Date(t.tanggal) : null;

        let key = tgl
            ? tgl.getFullYear() + "-" + String(tgl.getMonth() + 1).padStart(2, "0")
            : "tanpa-tanggal";

        let label = tgl
            ? tgl.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
            : "Tanpa Tanggal";

        if(!kelompok[key]){
            kelompok[key] = { label: label, items: [] };
        }

        kelompok[key].items.push(t);

    });

    let sekarang = new Date();
    let keyBulanIni = sekarang.getFullYear() + "-" + String(sekarang.getMonth() + 1).padStart(2, "0");

    Object.keys(kelompok).forEach((key)=>{

        let grup = kelompok[key];

        let htmlBaris = grup.items.map((t)=>{

            let kelasNominal = t.jenis === "masuk" ? "nominal-masuk" : "nominal-keluar";
            let tandaNominal = t.jenis === "masuk" ? "+ " : "- ";

            return `
            <div class="baris-transaksi">
                <div class="baris-kiri">
                    ${formatTanggalID(t.tanggal)}
                    <span class="label-kas">${labelKas(t.kas)}</span>
                    <div class="baris-catatan">${t.catatan || ""}</div>
                </div>
                <div>
                    <span class="${kelasNominal}">
                        ${tandaNominal}Rp ${Number(t.nominal || 0).toLocaleString("id-ID")}
                    </span>
                    <button class="btn-icon" onclick="hapusTransaksiKas('${t.id}')">🗑️</button>
                </div>
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
async function ambilKasFirebase(){

    try {

        const snapshot = await getDocs(
            collection(db, "kas")
        );

        snapshot.forEach((docSnap)=>{

            const dataFirebase = docSnap.data();

            // Jangan tarik ulang dokumen yang masih dalam antrian hapus
            // (mencegah entri lama "hidup lagi" akibat balapan proses hapus vs ambil data)
            if(antrianHapus.includes(dataFirebase.id)){
                return;
            }

            const indexLokal = kas.findIndex(
                t => t.id === dataFirebase.id
            );

            if(indexLokal >= 0){
                if(kas[indexLokal].sinkron !== false){
                    kas[indexLokal] = {...dataFirebase, sinkron: true};
                }
            } else {
                kas.push({...dataFirebase, sinkron: true});
            }

        });

        simpanStorage();
        tampilSaldo();
        tampilKas();

    } catch (err) {

        console.log("Gagal sinkron Firebase (mungkin offline):", err.message);

    }

}


// KIRIM DATA LOKAL YANG BELUM TERSINKRON KE FIREBASE
async function sinkronKeFirebase(){

    let adaPerubahan = false;

    for(const t of kas){

        if(t.sinkron === false){

            try {

                await setDoc(doc(db, "kas", t.id), t);

                t.sinkron = true;
                adaPerubahan = true;

            } catch (err) {

                console.log("Gagal sinkron kas " + t.id + ":", err.message);

            }

        }

    }

    if(adaPerubahan){
        simpanStorage();
    }

}

// COBA SINKRON OTOMATIS SETIAP KALI KONEKSI INTERNET KEMBALI
window.addEventListener("online", sinkronKeFirebase);


// PROSES ANTRIAN HAPUS: BENAR-BENAR HAPUS DARI FIREBASE
async function prosesAntrianHapus(){

    let sisaAntrian = [];

    for(const id of antrianHapus){

        try {

            await deleteDoc(doc(db, "kas", id));

        } catch (err) {

            console.log("Gagal hapus kas " + id + " di Firebase (mungkin offline):", err.message);
            sisaAntrian.push(id);

        }

    }

    antrianHapus = sisaAntrian;
    simpanAntrianHapus();

}

// COBA PROSES ANTRIAN HAPUS SETIAP KALI KONEKSI INTERNET KEMBALI
window.addEventListener("online", prosesAntrianHapus);


// AGAR BISA DIPANGGIL DARI HTML
window.simpanTransaksiKas = simpanTransaksiKas;
window.transferKas = transferKas;
window.hapusTransaksiKas = hapusTransaksiKas;
window.tampilKas = tampilKas;


// PROSES ANTRIAN HAPUS DULU, BARU AMBIL DATA FIREBASE (HINDARI BALAPAN/RACE CONDITION)
// SETELAH ITU SINKRON YANG BELUM TERKIRIM
prosesAntrianHapus().then(ambilKasFirebase).then(sinkronKeFirebase);
