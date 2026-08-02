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

// ID KULAKAN YANG SEDANG DIEDIT (null kalau sedang input data baru)
let sedangEditId = null;


// TAMPIL DULUAN DARI LOCAL STORAGE (offline-first)
tampilBelanja();

// ISI DATALIST PRODUK DARI MASTER PRODUK (localStorage bersama modul Produk)
isiDaftarProdukDropdown();

// MUAT DRAFT FORM YANG BELUM SEMPAT DISIMPAN (kalau ada), atau mulai form kosong
muatDraft();

// AUTO-SIMPAN DRAFT TIAP KALI ADA PERUBAHAN DI FORM (biar gak hilang kalau pindah menu)
document
    .querySelector(".form-produk")
    .addEventListener("input", simpanDraft);
document
    .querySelector(".form-produk")
    .addEventListener("change", simpanDraft);

// COBA PROSES ANTRIAN HAPUS YANG MUNGKIN TERTUNDA DARI SESI SEBELUMNYA
prosesAntrianHapus();


// AMBIL ISI FORM SAAT INI JADI SATU OBJEK
function ambilStateForm(){

    let items = [];

    document.querySelectorAll(".baris-item").forEach(baris=>{
        items.push({
            kode: baris.querySelector(".kodeItem").value,
            nama: baris.querySelector(".namaItem").value,
            jumlahBal: baris.querySelector(".jumlahItem").value,
            hargaPerBal: baris.querySelector(".hargaItem").value
        });
    });

    return {
        tanggal: document.getElementById("tanggalBelanja").value,
        supplier: document.getElementById("supplierBelanja").value,
        statusBayar: document.getElementById("statusBayar").value,
        jumlahDibayar: document.getElementById("jumlahDibayar").value,
        kategori: document.getElementById("kategoriBelanja").value,
        catatan: document.getElementById("catatanBelanja").value,
        items: items
    };

}


// SIMPAN DRAFT FORM KE LOCAL STORAGE
function simpanDraft(){
    localStorage.setItem(
        "belanjaDraftAizzay",
        JSON.stringify(ambilStateForm())
    );
}


// HAPUS DRAFT (dipanggil setelah kulakan benar-benar tersimpan)
function hapusDraft(){
    localStorage.removeItem("belanjaDraftAizzay");
}


// MUAT DRAFT KE FORM, KALAU ADA. KALAU TIDAK, MULAI DENGAN 1 BARIS KOSONG
function muatDraft(){

    let draft = JSON.parse(
        localStorage.getItem("belanjaDraftAizzay") || "null"
    );

    document.getElementById("daftarItemInput").innerHTML = "";

    if(!draft){
        tampilPetunjukKategori();
        tambahBarisItem();
        return;
    }

    document.getElementById("tanggalBelanja").value = draft.tanggal || "";
    document.getElementById("supplierBelanja").value = draft.supplier || "";
    document.getElementById("statusBayar").value = draft.statusBayar || "lunas";
    document.getElementById("jumlahDibayar").value = draft.jumlahDibayar || "";
    document.getElementById("kategoriBelanja").value = draft.kategori || "snack";
    document.getElementById("catatanBelanja").value = draft.catatan || "";

    tampilPetunjukKategori();

    toggleJumlahDibayar();

    if(draft.items && draft.items.length > 0){

        draft.items.forEach(it=>{

            tambahBarisItem();

            let barisTerakhir = document
                .getElementById("daftarItemInput")
                .lastElementChild;

            barisTerakhir.querySelector(".kodeItem").value = it.kode || "";
            barisTerakhir.querySelector(".namaItem").value = it.nama || "";
            barisTerakhir.querySelector(".jumlahItem").value = it.jumlahBal || "";
            barisTerakhir.querySelector(".hargaItem").value = it.hargaPerBal || "";

        });

    } else {
        tambahBarisItem();
    }

}


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
// LABEL TAMPILAN UNTUK KATEGORI BELANJA
function labelKategori(kategori){
    if(kategori === "snack") return "🍿 Snack";
    if(kategori === "plastik") return "🛍️ Plastik";
    if(kategori === "lainlain") return "🔧 Lain-lain";
    return kategori;
}


// TAMPIL PETUNJUK SESUAI KATEGORI BELANJA YANG DIPILIH
function tampilPetunjukKategori(){

    let kategori = document.getElementById("kategoriBelanja").value;
    let petunjuk = document.getElementById("petunjukKategori");

    if(kategori === "snack"){
        petunjuk.textContent = "Isi Kode (dari Master Produk), Nama, Bal, Harga/Bal seperti biasa.";
    } else {
        petunjuk.textContent = "Kode boleh dikosongkan. Isi Nama (misal: Plastik 1kg / Bensin), Jumlah, dan Harga satuan.";
    }

}


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

    simpanDraft();

}


// HAPUS SATU BARIS INPUT PRODUK
function hapusBarisItem(idBaris){

    let el = document.getElementById(idBaris);

    if(el) el.remove();

    simpanDraft();

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


// TAMPIL RIWAYAT KULAKAN (dikelompokkan per bulan, bulan berjalan terbuka)
function tampilBelanja(data = belanja){

    let area = document.getElementById("daftarBelanja");

    if(!area) return;

    let judul = document.getElementById("judulRiwayatBelanja");
    if(judul){
        judul.textContent = "Riwayat Kulakan (" + belanja.length + " data)";
    }

    area.innerHTML = "";

    let urut = [...data].sort((a, b) => {
        return new Date(b.tanggal) - new Date(a.tanggal);
    });

    // Kelompokkan per bulan (key: "YYYY-MM", urutan tetap terjaga karena urut sudah terurut tanggal terbaru)
    let kelompok = {};

    urut.forEach((b)=>{

        let tgl = b.tanggal ? new Date(b.tanggal) : null;

        let key = tgl
            ? tgl.getFullYear() + "-" + String(tgl.getMonth() + 1).padStart(2, "0")
            : "tanpa-tanggal";

        let label = tgl
            ? tgl.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
            : "Tanpa Tanggal";

        if(!kelompok[key]){
            kelompok[key] = { label: label, items: [] };
        }

        kelompok[key].items.push(b);

    });

    let sekarang = new Date();
    let keyBulanIni = sekarang.getFullYear() + "-" + String(sekarang.getMonth() + 1).padStart(2, "0");

    Object.keys(kelompok).forEach((key)=>{

        let grup = kelompok[key];

        let htmlKartu = grup.items.map((b)=>{

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

            return `

            <div class="card">

                <h3>${b.tanggal || ""}</h3>

                ${b.kategori ? `<span class="label-kategori label-${b.kategori}">${labelKategori(b.kategori)}</span>` : ""}

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

        }).join("");

        let terbuka = (key === keyBulanIni) ? "open" : "";

        area.innerHTML += `

        <details class="bulan-group" ${terbuka}>
            <summary>${grup.label} <span class="jumlah-bulan">(${grup.items.length})</span></summary>
            <div class="bulan-isi">
                ${htmlKartu}
            </div>
        </details>

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


// CATAT/PERBARUI/HAPUS ENTRI KAS OTOMATIS YANG TERKAIT SATU KULAKAN
// (dipanggil ulang tiap ada perubahan jumlahDibayar - entri lama yang terkait
// sumberId yang sama otomatis diganti, bukan ditambah dobel)
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


// SIMPAN KULAKAN (dengan banyak item produk sekaligus)
function simpanKulakan(){

    let tanggal = document.getElementById("tanggalBelanja").value;
    let supplier = document.getElementById("supplierBelanja").value;
    let statusBayar = document.getElementById("statusBayar").value;
    let kategori = document.getElementById("kategoriBelanja").value;

    let barisItem = document.querySelectorAll(".baris-item");

    let items = [];

    barisItem.forEach(baris=>{

        let kode = baris.querySelector(".kodeItem").value.toUpperCase();
        let nama = baris.querySelector(".namaItem").value;
        let jumlahBal = Number(baris.querySelector(".jumlahItem").value);
        let hargaPerBal = Number(baris.querySelector(".hargaItem").value);

        // Untuk kategori Snack: kode wajib. Untuk Plastik/Lain-lain: kode boleh kosong, cukup Nama+Jumlah+Harga
        let syaratTerpenuhi = kategori === "snack"
            ? (kode && jumlahBal && hargaPerBal)
            : (nama && jumlahBal && hargaPerBal);

        if(syaratTerpenuhi){
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
        alert(
            kategori === "snack"
                ? "Tanggal, Supplier, dan minimal 1 produk (kode, jumlah bal, harga) wajib diisi"
                : "Tanggal, Supplier, dan minimal 1 barang (nama, jumlah, harga) wajib diisi"
        );
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

        id: sedangEditId || (Date.now() + "_" + Math.random().toString(36).slice(2)),

        tanggal: tanggal,

        supplier: supplier,

        kategori: kategori,

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

    catatKasOtomatis(
        "belanja",
        data.id,
        "usaha",
        "keluar",
        data.jumlahDibayar,
        "Kulakan " + data.supplier + " (" + data.tanggal + ")"
    );

    tampilBelanja();

    alert(
        "Kulakan berhasil dicatat (" + items.length + " produk).\n" +
        "Total kulakan tersimpan sekarang: " + belanja.length
    );

    // RESET FORM
    hapusDraft();
    sedangEditId = null;
    document.getElementById("tanggalBelanja").value = "";
    document.getElementById("supplierBelanja").value = "";
    document.getElementById("catatanBelanja").value = "";
    document.getElementById("statusBayar").value = "lunas";
    toggleJumlahDibayar();
    document.getElementById("daftarItemInput").innerHTML = "";
    tambahBarisItem();

    sinkronKeFirebase();

}


// EDIT KULAKAN
function editBelanja(index){

    let b = belanja[index];

    sedangEditId = b.id;

    document.getElementById("tanggalBelanja").value = b.tanggal || "";
    document.getElementById("supplierBelanja").value = b.supplier || "";
    document.getElementById("statusBayar").value = b.statusBayar || "lunas";
    document.getElementById("jumlahDibayar").value = b.jumlahDibayar || "";
    document.getElementById("kategoriBelanja").value = b.kategori || "snack";
    document.getElementById("catatanBelanja").value = b.catatan || "";

    toggleJumlahDibayar();
    tampilPetunjukKategori();

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

    // Hapus juga entri Kas otomatis yang terkait kulakan ini
    catatKasOtomatis("belanja", b.id, "usaha", "keluar", 0, "");

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

    catatKasOtomatis(
        "belanja",
        belanja[index].id,
        "usaha",
        "keluar",
        belanja[index].jumlahDibayar,
        "Pelunasan kulakan " + belanja[index].supplier + " (" + belanja[index].tanggal + ")"
    );

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

    let rekap = {}; // { kode: { nama, totalBal, totalUang } }
    let grandTotal = 0;

    belanja.forEach(b=>{

        if(!b.tanggal) return;

        let tgl = new Date(b.tanggal);

        if(tgl.getMonth() !== bulanIni || tgl.getFullYear() !== tahunIni) return;

        let items = ambilItems(b);

        items.forEach(it=>{

            if(!it.kode) return;

            let subtotal = Number(
                it.subtotal || (it.jumlahBal * it.hargaPerBal) || 0
            );

            if(!rekap[it.kode]){
                rekap[it.kode] = { nama: it.nama, totalBal: 0, totalUang: 0 };
            }

            rekap[it.kode].totalBal += Number(it.jumlahBal || 0);
            rekap[it.kode].totalUang += subtotal;

            grandTotal += subtotal;

        });

    });

    let namaBulan = sekarang.toLocaleDateString("id-ID", { month:"long", year:"numeric" });

    let baris = Object.keys(rekap).map(kode => `
        <tr>
            <td>${kode}</td>
            <td>${rekap[kode].nama}</td>
            <td>${rekap[kode].totalBal} bal</td>
            <td>Rp ${rekap[kode].totalUang.toLocaleString()}</td>
        </tr>
    `).join("");

    if(!baris){
        baris = `<tr><td colspan="4">Belum ada data kulakan bulan ini</td></tr>`;
    }

    box.innerHTML = `
        <b>Rekap Kulakan - ${namaBulan}</b>
        <table>
        <tr><th>Kode</th><th>Nama</th><th>Total Bal</th><th>Total Belanja</th></tr>
        ${baris}
        <tr>
            <td colspan="3"><b>TOTAL SEMUA</b></td>
            <td><b>Rp ${grandTotal.toLocaleString()}</b></td>
        </tr>
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
window.tampilPetunjukKategori = tampilPetunjukKategori;


// MULAI MEMBACA FIREBASE, LALU COBA KIRIM SISA DATA YANG BELUM TERSINKRON
ambilBelanjaFirebase().then(sinkronKeFirebase);
