import { db } from "../firebase.js";

import {
collection,
getDocs,
doc,
setDoc,
deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// DATA KULAKAN (tiap record = 1 sesi belanja, bisa berisi banyak produk)
let belanja = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];

// ANTRIAN ID YANG PERLU DIHAPUS DARI FIREBASE (untuk yang dihapus saat offline)
let antrianHapus = JSON.parse(localStorage.getItem("belanjaHapusAizzay")) || [];

let counterBaris = 0;


// TAMPIL DULUAN DARI LOCAL STORAGE (offline-first)
tampilBelanja();

// ISI DATALIST PRODUK DARI MASTER PRODUK (localStorage bersama modul Produk)
isiDaftarProdukDropdown();

// MULAI FORM DENGAN 1 BARIS ITEM KOSONG
tambahBarisItem();

// COBA PROSES ANTRIAN HAPUS YANG MUNGKIN TERTUNDA DARI SESI SEBELUMNYA
prosesAntrianHapus();


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem(
        "belanjaAizzay",
        JSON.stringify(belanja)
    );
}


// AMBIL ITEMS DARI RECORD, KOMPATIBEL DENGAN DATA LAMA (SEBELUM ADA MULTI-ITEM)
function ambilItems(record){

    if(record.items){
        return record.items;
    }

    // Data lama (sebelum dirombak): satu record = satu produk langsung
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


// ISI DAFTAR SARAN KODE PRODUK DARI MASTER PRODUK
function isiDaftarProdukDropdown(){

    let daftar = document.getElementById("daftarProdukBelanja");

    if(!daftar) return;

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];

    daftar.innerHTML = "";

    produkList.forEach(p=>{
        daftar.innerHTML += `<option value="${p.kode}">${p.nama}</option>`;
    });

}


// TAMBAH BARIS INPUT PRODUK BARU DI FORM
function tambahBarisItem(){

    counterBaris++;

    let idBaris = "baris" + counterBaris;

    let html = `
    <div class="baris-item" id="${idBaris}">
        <input list="daftarProdukBelanja" class="kodeItem" placeholder="Kode" onchange="isiNamaOtomatisBaris(this)">
        <input class="namaItem" placeholder="Nama Produk">
        <input class="jumlahItem" type="number" step="0.1" placeholder="Bal">
        <input class="hargaItem" type="number" placeholder="Harga/Bal">
        <button onclick="hapusBarisItem('${idBaris}')">🗑️</button>
    </div>
    `;

    document
        .getElementById("daftarItemInput")
        .insertAdjacentHTML("beforeend", html);

}


// HAPUS SATU BARIS INPUT PRODUK
function hapusBarisItem(idBaris){

    let el = document.getElementById(idBaris);

    if(el) el.remove();

}


// OTOMATIS ISI NAMA PRODUK KALAU KODE COCOK DENGAN MASTER PRODUK (per baris)
function isiNamaOtomatisBaris(inputKode){

    let kode = inputKode.value.toUpperCase();

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];

    let ditemukan = produkList.find(p => p.kode === kode);

    let baris = inputKode.closest(".baris-item");

    if(ditemukan && baris){
        baris.querySelector(".namaItem").value = ditemukan.nama;
    }

}


// TAMPIL/SEMBUNYIKAN KOLOM JUMLAH DIBAYAR SESUAI STATUS BAYAR
function toggleJumlahDibayar(){

    let status = document.getElementById("statusBayar").value;
    let kolom = document.getElementById("jumlahDibayar");

    kolom.style.display = (status === "cicilan") ? "block" : "none";

}


// AMBIL DATA FIREBASE (sinkron di belakang layar)
async function ambilBelanjaFirebase(){

    try {

        const snapshot = await getDocs(
            collection(db,"belanja")
        );

        snapshot.forEach((dok)=>{

            const dataFirebase = dok.data();

            // Lewati kalau record ini sedang menunggu dihapus
            if(antrianHapus.includes(dataFirebase.id)) return;

            const indexLokal = belanja.findIndex(
                b => b.id === dataFirebase.id
            );

            if(indexLokal >= 0){
                if(belanja[indexLokal].sinkron !== false){
                    belanja[indexLokal] = {...dataFirebase, sinkron:true};
                }
            } else {
                belanja.push({...dataFirebase, sinkron:true});
            }

        });

        simpanStorage();
        tampilBelanja();

    } catch (err) {

        console.log("Gagal sinkron Firebase belanja (mungkin offline):", err.message);

    }

}


// KIRIM DATA LOKAL YANG BELUM TERSINKRON KE FIREBASE
async function sinkronKeFirebase(){

    let adaPerubahan = false;

    for(const b of belanja){

        if(b.sinkron === false){

            try {

                await setDoc(doc(db,"belanja",b.id), b);

                b.sinkron = true;
                adaPerubahan = true;

            } catch (err) {

                console.log("Gagal sinkron belanja " + b.id + ":", err.message);

            }

        }

    }

    if(adaPerubahan){
        simpanStorage();
    }

}

// COBA SINKRON OTOMATIS SETIAP KALI KONEKSI INTERNET KEMBALI
window.addEventListener("online", sinkronKeFirebase);


// TAMPIL RIWAYAT KULAKAN
function tampilBelanja(data = belanja){

    let area = document.getElementById("daftarBelanja");

    if(!area) return;

    area.innerHTML = "";

    let urut = [...data].reverse();

    urut.forEach((b)=>{

        let indexAsli = belanja.indexOf(b);

        let items = ambilItems(b);

        let kelasBayar = b.statusBayar === "lunas"
            ? "bayar-lunas"
            : b.statusBayar === "cicilan"
                ? "bayar-cicilan"
                : "bayar-hutang";

        let htmlItems = items.map(it => `
            <div class="item-produk">
            ${it.kode || ""} - ${it.nama || ""} :
            ${it.jumlahBal || 0} bal &times;
            Rp ${Number(it.hargaPerBal || 0).toLocaleString()}
            = Rp ${Number(it.subtotal || (it.jumlahBal*it.hargaPerBal) || 0).toLocaleString()}
            </div>
        `).join("");

        area.innerHTML += `

        <div class="card">

            <h3>${b.tanggal || ""}</h3>

            <b>${b.supplier || ""}</b>

            ${htmlItems}

            <p>
            Total : Rp ${Number(b.total || 0).toLocaleString()}
            </p>

            <p>
            Status :
            <span class="${kelasBayar}">
            ${b.statusBayar || ""}
            </span>
            </p>

            ${b.sisaHutang > 0
                ? `<p>Sisa Hutang : Rp ${Number(b.sisaHutang).toLocaleString()}</p>`
                : ""
            }

            <span class="sinkron-badge">
            ${b.sinkron === false ? "🟡" : "🟢"}
            </span>

            <button class="btn-icon" onclick="editBelanja(${indexAsli})">
            ✏️
            </button>

            ${b.statusBayar !== "lunas"
                ? `<button class="btn-icon" onclick="lunasBelanja(${indexAsli})">✅</button>`
                : ""
            }

            <button class="btn-icon" onclick="hapusBelanja(${indexAsli})">
            🗑️
            </button>

        </div>

        `;

    });

}


// CARI KULAKAN (berdasar supplier atau salah satu produk di dalamnya)
function cariBelanja(){

    let kata = document
        .getElementById("cariBelanja")
        .value
        .toLowerCase();

    let hasil = belanja.filter(b => {

        if((b.supplier || "").toLowerCase().includes(kata)) return true;

        let items = ambilItems(b);

        return items.some(it =>
            (it.nama || "").toLowerCase().includes(kata) ||
            (it.kode || "").toLowerCase().includes(kata)
        );

    });

    tampilBelanja(hasil);

}


// SIMPAN KULAKAN (dengan banyak item produk sekaligus)
function simpanKulakan(){

    let tanggal = document.getElementById("tanggalBelanja").value;
    let supplier = document.getElementById("supplierBelanja").value;
    let statusBayar = document.getElementById("statusBayar").value;

    let barisItem = document.querySelectorAll(".baris-item");

    let items = [];

    barisItem.forEach(baris=>{

        let kode = baris.querySelector(".kodeItem").value.toUpperCase();
        let nama = baris.querySelector(".namaItem").value;
        let jumlahBal = Number(baris.querySelector(".jumlahItem").value);
        let hargaPerBal = Number(baris.querySelector(".hargaItem").value);

        if(kode && jumlahBal && hargaPerBal){
            items.push({
                kode: kode,
                nama: nama,
                jumlahBal: jumlahBal,
                hargaPerBal: hargaPerBal,
                subtotal: jumlahBal * hargaPerBal
            });
        }

    });

    if(!tanggal || !supplier || items.length === 0){
        alert("Tanggal, Supplier, dan minimal 1 produk (kode, jumlah bal, harga) wajib diisi");
        return;
    }

    let total = items.reduce((jumlah, it) => jumlah + it.subtotal, 0);

    let jumlahDibayar = 0;
    let sisaHutang = 0;

    if(statusBayar === "lunas"){
        jumlahDibayar = total;
        sisaHutang = 0;
    } else if(statusBayar === "hutang"){
        jumlahDibayar = 0;
        sisaHutang = total;
    } else if(statusBayar === "cicilan"){
        jumlahDibayar = Number(
            document.getElementById("jumlahDibayar").value
        ) || 0;
        sisaHutang = total - jumlahDibayar;
    }

    let data = {

        id: Date.now() + "_" + Math.random().toString(36).slice(2),

        tanggal: tanggal,

        supplier: supplier,

        items: items,

        total: total,

        statusBayar: statusBayar,

        jumlahDibayar: jumlahDibayar,

        sisaHutang: sisaHutang,

        catatan: document.getElementById("catatanBelanja").value,

        sinkron: false

    };

    belanja.push(data);

    simpanStorage();

    tampilBelanja();

    alert("Kulakan berhasil dicatat (" + items.length + " produk)");

    // RESET FORM
    document.getElementById("tanggalBelanja").value = "";
    document.getElementById("supplierBelanja").value = "";
    document.getElementById("catatanBelanja").value = "";
    document.getElementById("daftarItemInput").innerHTML = "";
    tambahBarisItem();

    sinkronKeFirebase();

}


// EDIT KULAKAN
function editBelanja(index){

    let b = belanja[index];

    document.getElementById("tanggalBelanja").value = b.tanggal || "";
    document.getElementById("supplierBelanja").value = b.supplier || "";
    document.getElementById("statusBayar").value = b.statusBayar || "lunas";
    document.getElementById("jumlahDibayar").value = b.jumlahDibayar || "";
    document.getElementById("catatanBelanja").value = b.catatan || "";

    toggleJumlahDibayar();

    // Muat ulang baris-baris item sesuai data
    document.getElementById("daftarItemInput").innerHTML = "";

    let items = ambilItems(b);

    items.forEach(it=>{

        tambahBarisItem();

        let barisTerakhir = document
            .getElementById("daftarItemInput")
            .lastElementChild;

        barisTerakhir.querySelector(".kodeItem").value = it.kode || "";
        barisTerakhir.querySelector(".namaItem").value = it.nama || "";
        barisTerakhir.querySelector(".jumlahItem").value = it.jumlahBal || "";
        barisTerakhir.querySelector(".hargaItem").value = it.hargaPerBal || "";

    });

    if(items.length === 0){
        tambahBarisItem();
    }

    belanja.splice(index,1);

    simpanStorage();

    tampilBelanja();

    alert("Silakan ubah data lalu tekan Simpan Kulakan");

}


// HAPUS SATU KULAKAN (lokal + Firebase)
function hapusBelanja(index){

    let b = belanja[index];

    let konfirmasi = confirm(
        "Yakin hapus kulakan tanggal " + b.tanggal + " (" + b.supplier + ")?"
    );

    if(!konfirmasi) return;

    // Hapus dari lokal dulu, biar langsung hilang dari layar
    belanja.splice(index, 1);
    simpanStorage();
    tampilBelanja();

    // Masukkan ke antrian hapus Firebase, biar tidak ketarik lagi saat sinkron
    antrianHapus.push(b.id);
    simpanAntrianHapus();

    prosesAntrianHapus();

}


// SIMPAN ANTRIAN HAPUS KE LOCAL STORAGE
function simpanAntrianHapus(){
    localStorage.setItem(
        "belanjaHapusAizzay",
        JSON.stringify(antrianHapus)
    );
}


// PROSES ANTRIAN HAPUS: BENAR-BENAR HAPUS DARI FIREBASE
async function prosesAntrianHapus(){

    let sisaAntrian = [];

    for(const id of antrianHapus){

        try {

            await deleteDoc(doc(db,"belanja",id));

        } catch (err) {

            console.log("Gagal hapus belanja " + id + " di Firebase (mungkin offline):", err.message);
            sisaAntrian.push(id); // coba lagi nanti

        }

    }

    antrianHapus = sisaAntrian;
    simpanAntrianHapus();

}

// COBA PROSES ANTRIAN HAPUS SETIAP KALI KONEKSI INTERNET KEMBALI
window.addEventListener("online", prosesAntrianHapus);


// TANDAI LUNAS
function lunasBelanja(index){

    belanja[index].statusBayar = "lunas";
    belanja[index].jumlahDibayar = belanja[index].total;
    belanja[index].sisaHutang = 0;
    belanja[index].sinkron = false;

    simpanStorage();

    tampilBelanja();

    alert("Kulakan ditandai lunas");

    sinkronKeFirebase();

}


// TAMPIL/SEMBUNYIKAN REKAP PER PRODUK (BULAN BERJALAN)
function toggleRekap(){

    let box = document.getElementById("rekapBelanja");

    if(box.style.display === "block"){
        box.style.display = "none";
        return;
    }

    let sekarang = new Date();
    let bulanIni = sekarang.getMonth();
    let tahunIni = sekarang.getFullYear();

    let rekap = {}; // { kode: { nama, totalBal } }

    belanja.forEach(b=>{

        if(!b.tanggal) return;

        let tgl = new Date(b.tanggal);

        if(tgl.getMonth() !== bulanIni || tgl.getFullYear() !== tahunIni) return;

        let items = ambilItems(b);

        items.forEach(it=>{

            if(!it.kode) return;

            if(!rekap[it.kode]){
                rekap[it.kode] = { nama: it.nama, totalBal: 0 };
            }

            rekap[it.kode].totalBal += Number(it.jumlahBal || 0);

        });

    });

    let namaBulan = sekarang.toLocaleDateString("id-ID", { month:"long", year:"numeric" });

    let baris = Object.keys(rekap).map(kode => `
        <tr>
            <td>${kode}</td>
            <td>${rekap[kode].nama}</td>
            <td>${rekap[kode].totalBal} bal</td>
        </tr>
    `).join("");

    if(!baris){
        baris = `<tr><td colspan="3">Belum ada data kulakan bulan ini</td></tr>`;
    }

    box.innerHTML = `
        <b>Rekap Kulakan - ${namaBulan}</b>
        <table>
        <tr><th>Kode</th><th>Nama</th><th>Total Bal</th></tr>
        ${baris}
        </table>
    `;

    box.style.display = "block";

}


// AGAR BISA DIPANGGIL DARI HTML
window.simpanKulakan = simpanKulakan;
window.editBelanja = editBelanja;
window.lunasBelanja = lunasBelanja;
window.hapusBelanja = hapusBelanja;
window.cariBelanja = cariBelanja;
window.tambahBarisItem = tambahBarisItem;
window.hapusBarisItem = hapusBarisItem;
window.isiNamaOtomatisBaris = isiNamaOtomatisBaris;
window.toggleJumlahDibayar = toggleJumlahDibayar;
window.toggleRekap = toggleRekap;


// MULAI MEMBACA FIREBASE, LALU COBA KIRIM SISA DATA YANG BELUM TERSINKRON
ambilBelanjaFirebase().then(sinkronKeFirebase);
