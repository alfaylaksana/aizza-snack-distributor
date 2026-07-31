import { db } from "../firebase.js";

import {
collection,
getDocs,
doc,
setDoc,
deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// DATA TITIPAN (tiap record = 1 sesi kirim ke toko, bisa disettle belakangan)
let titipan = JSON.parse(localStorage.getItem("titipanAizzay")) || [];

// ANTRIAN ID YANG PERLU DIHAPUS DARI FIREBASE
let antrianHapus = JSON.parse(localStorage.getItem("titipanHapusAizzay")) || [];

let counterBaris = 0;

// ID TITIPAN YANG SEDANG DI-SETTLE (null kalau tidak sedang settle)
let sedangSettleId = null;


// TAMPIL DULUAN DARI LOCAL STORAGE (offline-first)
tampilTitipan();

// ISI DATALIST PRODUK & TOKO DARI DATA YANG SUDAH ADA
isiDaftarProdukDropdown();
isiDaftarTokoDropdown();

// MUAT DRAFT FORM KIRIM YANG BELUM SEMPAT DISIMPAN (kalau ada)
muatDraft();

// KALAU ADA DRAFT SETTLE TERTUNDA, BUKA OTOMATIS
cobaBukaSettleDariDraft();

// AUTO-SIMPAN DRAFT TIAP KALI ADA PERUBAHAN DI FORM KIRIM
document
    .querySelector(".form-produk")
    .addEventListener("input", simpanDraft);
document
    .querySelector(".form-produk")
    .addEventListener("change", simpanDraft);

// COBA PROSES ANTRIAN HAPUS YANG MUNGKIN TERTUNDA
prosesAntrianHapus();


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem(
        "titipanAizzay",
        JSON.stringify(titipan)
    );
}


// ISI DAFTAR SARAN KODE PRODUK DARI MASTER PRODUK
function isiDaftarProdukDropdown(){

    let daftar = document.getElementById("daftarProdukToko");

    if(!daftar) return;

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];

    daftar.innerHTML = "";

    produkList.forEach(p=>{
        daftar.innerHTML += `<option value="${p.kode}">${p.nama}</option>`;
    });

}


// ISI DAFTAR SARAN NAMA TOKO DARI TITIPAN YANG SUDAH PERNAH ADA
function isiDaftarTokoDropdown(){

    let daftar = document.getElementById("daftarToko");

    if(!daftar) return;

    let namaToko = [...new Set(titipan.map(t => t.toko).filter(Boolean))];

    daftar.innerHTML = "";

    namaToko.forEach(nama=>{
        daftar.innerHTML += `<option value="${nama}">`;
    });

}


// AMBIL ISI FORM KIRIM SAAT INI JADI SATU OBJEK (untuk draft)
function ambilStateForm(){

    let items = [];

    document.querySelectorAll("#daftarItemKirim .baris-item").forEach(baris=>{
        items.push({
            kode: baris.querySelector(".kodeItem").value,
            nama: baris.querySelector(".namaItem").value,
            jumlahKirim: baris.querySelector(".jumlahItem").value,
            hargaToko: baris.querySelector(".hargaItem").value
        });
    });

    return {
        tanggalKirim: document.getElementById("tanggalKirim").value,
        toko: document.getElementById("tokoInput").value,
        catatan: document.getElementById("catatanKirim").value,
        items: items
    };

}


// SIMPAN DRAFT FORM KIRIM KE LOCAL STORAGE
function simpanDraft(){
    localStorage.setItem(
        "titipanDraftAizzay",
        JSON.stringify(ambilStateForm())
    );
}


// HAPUS DRAFT (dipanggil setelah titipan tersimpan)
function hapusDraft(){
    localStorage.removeItem("titipanDraftAizzay");
}


// MUAT DRAFT KE FORM KIRIM, KALAU ADA
function muatDraft(){

    let draft = JSON.parse(
        localStorage.getItem("titipanDraftAizzay") || "null"
    );

    document.getElementById("daftarItemKirim").innerHTML = "";

    if(!draft){
        tambahBarisKirim();
        return;
    }

    document.getElementById("tanggalKirim").value = draft.tanggalKirim || "";
    document.getElementById("tokoInput").value = draft.toko || "";
    document.getElementById("catatanKirim").value = draft.catatan || "";

    if(draft.items && draft.items.length > 0){

        draft.items.forEach(it=>{

            tambahBarisKirim();

            let barisTerakhir = document
                .getElementById("daftarItemKirim")
                .lastElementChild;

            barisTerakhir.querySelector(".kodeItem").value = it.kode || "";
            barisTerakhir.querySelector(".namaItem").value = it.nama || "";
            barisTerakhir.querySelector(".jumlahItem").value = it.jumlahKirim || "";
            barisTerakhir.querySelector(".hargaItem").value = it.hargaToko || "";

        });

    } else {
        tambahBarisKirim();
    }

}


// TAMBAH BARIS INPUT PRODUK DI FORM KIRIM
function tambahBarisKirim(){

    counterBaris++;

    let idBaris = "barisKirim" + counterBaris;

    let html = `
    <div class="baris-item" id="${idBaris}">
        <input list="daftarProdukToko" class="kodeItem" placeholder="Kode" onchange="isiOtomatisBarisKirim(this)">
        <input class="namaItem" placeholder="Nama Produk">
        <input class="jumlahItem" type="number" step="1" placeholder="Jumlah">
        <input class="hargaItem" type="number" placeholder="Harga Toko">
        <button onclick="hapusBarisKirim('${idBaris}')">🗑️</button>
    </div>
    `;

    document
        .getElementById("daftarItemKirim")
        .insertAdjacentHTML("beforeend", html);

    simpanDraft();

}


// HAPUS SATU BARIS INPUT DI FORM KIRIM
function hapusBarisKirim(idBaris){

    let el = document.getElementById(idBaris);

    if(el) el.remove();

    simpanDraft();

}


// OTOMATIS ISI NAMA & HARGA TOKO DARI MASTER PRODUK
function isiOtomatisBarisKirim(inputKode){

    let kode = inputKode.value.toUpperCase();

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];

    let ditemukan = produkList.find(p => p.kode === kode);

    let baris = inputKode.closest(".baris-item");

    if(ditemukan && baris){
        baris.querySelector(".namaItem").value = ditemukan.nama;
        baris.querySelector(".hargaItem").value = ditemukan.hargaToko || "";
    }

}


// AMBIL DATA FIREBASE (sinkron di belakang layar)
async function ambilTitipanFirebase(){

    try {

        const snapshot = await getDocs(
            collection(db,"titipan")
        );

        snapshot.forEach((dok)=>{

            const dataFirebase = dok.data();

            if(antrianHapus.includes(dataFirebase.id)) return;

            const indexLokal = titipan.findIndex(
                t => t.id === dataFirebase.id
            );

            if(indexLokal >= 0){
                if(titipan[indexLokal].sinkron !== false){
                    titipan[indexLokal] = {...dataFirebase, sinkron:true};
                }
            } else {
                titipan.push({...dataFirebase, sinkron:true});
            }

        });

        simpanStorage();
        tampilTitipan();
        isiDaftarTokoDropdown();

    } catch (err) {

        console.log("Gagal sinkron Firebase titipan (mungkin offline):", err.message);

    }

}


// KIRIM DATA LOKAL YANG BELUM TERSINKRON KE FIREBASE
async function sinkronKeFirebase(){

    let adaPerubahan = false;

    for(const t of titipan){

        if(t.sinkron === false){

            try {

                await setDoc(doc(db,"titipan",t.id), t);

                t.sinkron = true;
                adaPerubahan = true;

            } catch (err) {

                console.log("Gagal sinkron titipan " + t.id + ":", err.message);

            }

        }

    }

    if(adaPerubahan){
        simpanStorage();
    }

}

window.addEventListener("online", sinkronKeFirebase);


// TAMPIL RIWAYAT TITIPAN
function tampilTitipan(data = titipan){

    let area = document.getElementById("daftarTitipan");

    if(!area) return;

    let judul = document.getElementById("judulRiwayatToko");
    if(judul){
        judul.textContent = "Riwayat Titipan (" + titipan.length + " data)";
    }

    area.innerHTML = "";

    let urut = [...data].sort((a, b) => {
        return new Date(b.tanggalKirim) - new Date(a.tanggalKirim);
    });

    urut.forEach((t)=>{

        let indexAsli = titipan.indexOf(t);

        if(t.status === "selesai"){

            let kelasBayar = t.statusBayar === "lunas"
                ? "bayar-lunas"
                : t.statusBayar === "cicilan"
                    ? "bayar-cicilan"
                    : "bayar-hutang";

            let htmlItems = (t.itemsSettle || []).map(it => `
                <div class="item-produk">
                ${it.kode || ""} - ${it.nama || ""} :
                kirim ${it.jumlahKirim || 0}, retur ${it.jumlahRetur || 0},
                laku ${it.jumlahTerjual || 0} &times;
                Rp ${Number(it.hargaToko || 0).toLocaleString()}
                = Rp ${Number(it.subtotal || 0).toLocaleString()}
                </div>
            `).join("");

            area.innerHTML += `

            <div class="card">

                <h3>${t.tanggalKirim || ""} &rarr; ${t.tanggalSettle || ""}</h3>

                <b>${t.toko || ""}</b>

                <p><span class="status-selesai">selesai</span></p>

                ${htmlItems}

                <p>
                Total : Rp ${Number(t.totalUangSettle || 0).toLocaleString()}
                </p>

                <p>
                Bayar :
                <span class="${kelasBayar}">${t.statusBayar || ""}</span>
                </p>

                ${t.sisaHutang > 0
                    ? `<p>Sisa Hutang : Rp ${Number(t.sisaHutang).toLocaleString()}</p>`
                    : ""
                }

                <span class="sinkron-badge">
                ${t.sinkron === false ? "🟡" : "🟢"}
                </span>

                <button class="btn-icon" onclick="bukaSettle(${indexAsli})">
                ✏️
                </button>

                ${t.statusBayar !== "lunas"
                    ? `<button class="btn-icon" onclick="lunasTitipan(${indexAsli})">✅</button>`
                    : ""
                }

                <button class="btn-icon" onclick="hapusTitipan(${indexAsli})">
                🗑️
                </button>

            </div>

            `;

        } else {

            let htmlItems = (t.items || []).map(it => `
                <div class="item-produk">
                ${it.kode || ""} - ${it.nama || ""} :
                ${it.jumlahKirim || 0} dikirim
                </div>
            `).join("");

            area.innerHTML += `

            <div class="card">

                <h3>${t.tanggalKirim || ""}</h3>

                <b>${t.toko || ""}</b>

                <p><span class="status-berjalan">masih di toko</span></p>

                ${htmlItems}

                <span class="sinkron-badge">
                ${t.sinkron === false ? "🟡" : "🟢"}
                </span>

                <button class="btn-icon" onclick="bukaSettle(${indexAsli})">
                ✅ Settle
                </button>

                <button class="btn-icon" onclick="hapusTitipan(${indexAsli})">
                🗑️
                </button>

            </div>

            `;

        }

    });

}


// CARI TITIPAN
function cariToko(){

    let kata = document
        .getElementById("cariToko")
        .value
        .toLowerCase();

    let hasil = titipan.filter(t => {

        if((t.toko || "").toLowerCase().includes(kata)) return true;

        let items = t.items || t.itemsSettle || [];

        return items.some(it =>
            (it.nama || "").toLowerCase().includes(kata) ||
            (it.kode || "").toLowerCase().includes(kata)
        );

    });

    tampilTitipan(hasil);

}


// SIMPAN KIRIM TITIPAN BARU
function simpanKirim(){

    let tanggalKirim = document.getElementById("tanggalKirim").value;
    let toko = document.getElementById("tokoInput").value;

    let barisItem = document.querySelectorAll("#daftarItemKirim .baris-item");

    let items = [];

    barisItem.forEach(baris=>{

        let kode = baris.querySelector(".kodeItem").value.toUpperCase();
        let nama = baris.querySelector(".namaItem").value;
        let jumlahKirim = Number(baris.querySelector(".jumlahItem").value);
        let hargaToko = Number(baris.querySelector(".hargaItem").value);

        if(kode && jumlahKirim){
            items.push({
                kode: kode,
                nama: nama,
                jumlahKirim: jumlahKirim,
                hargaToko: hargaToko
            });
        }

    });

    if(!tanggalKirim || !toko || items.length === 0){
        alert("Tanggal, Nama Toko, dan minimal 1 produk (kode & jumlah) wajib diisi");
        return;
    }

    let data = {

        id: Date.now() + "_" + Math.random().toString(36).slice(2),

        tanggalKirim: tanggalKirim,

        toko: toko,

        items: items,

        status: "berjalan",

        tanggalSettle: null,
        itemsSettle: null,
        totalUangSettle: 0,
        statusBayar: null,
        jumlahDibayar: 0,
        sisaHutang: 0,

        catatan: document.getElementById("catatanKirim").value,

        sinkron: false

    };

    titipan.push(data);

    simpanStorage();

    tampilTitipan();

    isiDaftarTokoDropdown();

    alert(
        "Titipan berhasil dikirim (" + items.length + " produk).\n" +
        "Total titipan tersimpan sekarang: " + titipan.length
    );

    // RESET FORM
    hapusDraft();
    document.getElementById("tanggalKirim").value = "";
    document.getElementById("tokoInput").value = "";
    document.getElementById("catatanKirim").value = "";
    document.getElementById("daftarItemKirim").innerHTML = "";
    tambahBarisKirim();

    sinkronKeFirebase();

}


// BUKA FORM SETTLE UNTUK SATU TITIPAN
function bukaSettle(index){

    let t = titipan[index];

    sedangSettleId = t.id;

    document.getElementById("infoSettle").textContent =
        t.toko + " - dikirim " + t.tanggalKirim;

    // Kalau ada draft settle tertunda untuk titipan ini, pakai itu
    let draft = JSON.parse(localStorage.getItem("tokoSettleDraftAizzay") || "null");
    let draftCocok = draft && draft.id === t.id ? draft : null;

    // Kalau titipan ini sudah pernah disettle sebelumnya (mode edit settle),
    // pakai data itemsSettle. Kalau belum, pakai items asli (jumlah retur mulai dari 0)
    let sumberItems = t.itemsSettle || (t.items || []).map(it => ({
        kode: it.kode,
        nama: it.nama,
        jumlahKirim: it.jumlahKirim,
        hargaToko: it.hargaToko,
        jumlahRetur: 0
    }));

    let area = document.getElementById("daftarItemSettle");
    area.innerHTML = "";

    sumberItems.forEach(it=>{

        let nilaiRetur = it.jumlahRetur || 0;

        if(draftCocok && draftCocok.returPerKode && draftCocok.returPerKode[it.kode] !== undefined){
            nilaiRetur = draftCocok.returPerKode[it.kode];
        }

        area.innerHTML += `
        <div class="baris-settle" data-kode="${it.kode}" data-kirim="${it.jumlahKirim}" data-harga="${it.hargaToko}">
            <span>${it.kode} - ${it.nama} (kirim ${it.jumlahKirim})</span>
            <input class="returItem" type="number" placeholder="Retur" value="${nilaiRetur}" oninput="hitungPreviewSettle(); simpanDraftSettle();">
        </div>
        `;
    });

    document.getElementById("statusBayarSettle").value =
        (draftCocok && draftCocok.statusBayar) || t.statusBayar || "lunas";
    document.getElementById("jumlahDibayarSettle").value =
        (draftCocok && draftCocok.jumlahDibayar) || t.jumlahDibayar || "";

    toggleJumlahDibayarSettle();

    document.getElementById("formSettle").style.display = "block";

    hitungPreviewSettle();

    document.getElementById("formSettle").scrollIntoView({behavior:"smooth"});

}


// AMBIL ISI FORM SETTLE SAAT INI JADI SATU OBJEK (untuk draft)
function ambilStateSettle(){

    let returPerKode = {};

    document.querySelectorAll("#daftarItemSettle .baris-settle").forEach(baris=>{
        returPerKode[baris.dataset.kode] = baris.querySelector(".returItem").value;
    });

    return {
        id: sedangSettleId,
        returPerKode: returPerKode,
        statusBayar: document.getElementById("statusBayarSettle").value,
        jumlahDibayar: document.getElementById("jumlahDibayarSettle").value
    };

}


// SIMPAN DRAFT SETTLE KE LOCAL STORAGE
function simpanDraftSettle(){

    if(!sedangSettleId) return;

    localStorage.setItem(
        "tokoSettleDraftAizzay",
        JSON.stringify(ambilStateSettle())
    );

}


// HAPUS DRAFT SETTLE (dipanggil setelah simpan atau batal)
function hapusDraftSettle(){
    localStorage.removeItem("tokoSettleDraftAizzay");
}


// KALAU ADA DRAFT SETTLE TERTUNDA DARI SESI SEBELUMNYA, BUKA OTOMATIS
function cobaBukaSettleDariDraft(){

    let draft = JSON.parse(localStorage.getItem("tokoSettleDraftAizzay") || "null");

    if(!draft || !draft.id) return;

    let index = titipan.findIndex(t => t.id === draft.id);

    if(index >= 0){
        bukaSettle(index);
    } else {
        // Titipannya sudah tidak ada (mungkin terhapus) -> draft juga dibuang
        hapusDraftSettle();
    }

}


// TAMPIL/SEMBUNYIKAN JUMLAH DIBAYAR DI FORM SETTLE
function toggleJumlahDibayarSettle(){

    let status = document.getElementById("statusBayarSettle").value;
    let kolom = document.getElementById("jumlahDibayarSettle");

    kolom.style.display = (status === "cicilan") ? "block" : "none";

    simpanDraftSettle();

}


// HITUNG PREVIEW TOTAL UANG SETTLE SAAT RETUR DIISI
function hitungPreviewSettle(){

    let total = 0;

    document.querySelectorAll("#daftarItemSettle .baris-settle").forEach(baris=>{

        let kirim = Number(baris.dataset.kirim);
        let harga = Number(baris.dataset.harga);
        let retur = Number(baris.querySelector(".returItem").value) || 0;

        let terjual = Math.max(kirim - retur, 0);

        total += terjual * harga;

    });

    document.getElementById("totalSettlePreview").textContent =
        "Perkiraan total: Rp " + total.toLocaleString();

}


// BATALKAN SETTLE (tutup form tanpa simpan)
function batalSettle(){

    sedangSettleId = null;
    hapusDraftSettle();
    document.getElementById("formSettle").style.display = "none";

}


// SIMPAN HASIL SETTLE
function simpanSettle(){

    let index = titipan.findIndex(t => t.id === sedangSettleId);

    if(index < 0){
        alert("Titipan tidak ditemukan");
        return;
    }

    let t = titipan[index];

    let itemsSettle = [];
    let total = 0;

    document.querySelectorAll("#daftarItemSettle .baris-settle").forEach(baris=>{

        let kode = baris.dataset.kode;
        let kirim = Number(baris.dataset.kirim);
        let hargaToko = Number(baris.dataset.harga);
        let retur = Number(baris.querySelector(".returItem").value) || 0;
        let terjual = Math.max(kirim - retur, 0);
        let subtotal = terjual * hargaToko;

        let namaAsli = (t.items.find(it => it.kode === kode) || {}).nama || "";

        itemsSettle.push({
            kode: kode,
            nama: namaAsli,
            jumlahKirim: kirim,
            jumlahRetur: retur,
            jumlahTerjual: terjual,
            hargaToko: hargaToko,
            subtotal: subtotal
        });

        total += subtotal;

    });

    let statusBayar = document.getElementById("statusBayarSettle").value;

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
            document.getElementById("jumlahDibayarSettle").value
        ) || 0;
        sisaHutang = total - jumlahDibayar;
    }

    t.status = "selesai";
    t.tanggalSettle = new Date().toISOString().slice(0,10);
    t.itemsSettle = itemsSettle;
    t.totalUangSettle = total;
    t.statusBayar = statusBayar;
    t.jumlahDibayar = jumlahDibayar;
    t.sisaHutang = sisaHutang;
    t.sinkron = false;

    simpanStorage();

    tampilTitipan();

    alert("Settle tersimpan. Total: Rp " + total.toLocaleString());

    batalSettle();

    sinkronKeFirebase();

}


// TANDAI LUNAS (untuk titipan yang sudah selesai tapi masih hutang/cicilan)
function lunasTitipan(index){

    titipan[index].statusBayar = "lunas";
    titipan[index].jumlahDibayar = titipan[index].totalUangSettle;
    titipan[index].sisaHutang = 0;
    titipan[index].sinkron = false;

    simpanStorage();

    tampilTitipan();

    alert("Titipan ditandai lunas");

    sinkronKeFirebase();

}


// HAPUS SATU TITIPAN (lokal + Firebase)
function hapusTitipan(index){

    let t = titipan[index];

    let konfirmasi = confirm(
        "Yakin hapus titipan " + t.toko + " tanggal " + t.tanggalKirim + "?"
    );

    if(!konfirmasi) return;

    titipan.splice(index, 1);
    simpanStorage();
    tampilTitipan();

    antrianHapus.push(t.id);
    simpanAntrianHapus();

    prosesAntrianHapus();

}


function simpanAntrianHapus(){
    localStorage.setItem(
        "titipanHapusAizzay",
        JSON.stringify(antrianHapus)
    );
}


async function prosesAntrianHapus(){

    let sisaAntrian = [];

    for(const id of antrianHapus){

        try {

            await deleteDoc(doc(db,"titipan",id));

        } catch (err) {

            console.log("Gagal hapus titipan " + id + " di Firebase (mungkin offline):", err.message);
            sisaAntrian.push(id);

        }

    }

    antrianHapus = sisaAntrian;
    simpanAntrianHapus();

}

window.addEventListener("online", prosesAntrianHapus);


// AGAR BISA DIPANGGIL DARI HTML
window.simpanKirim = simpanKirim;
window.tambahBarisKirim = tambahBarisKirim;
window.hapusBarisKirim = hapusBarisKirim;
window.isiOtomatisBarisKirim = isiOtomatisBarisKirim;
window.bukaSettle = bukaSettle;
window.batalSettle = batalSettle;
window.simpanSettle = simpanSettle;
window.toggleJumlahDibayarSettle = toggleJumlahDibayarSettle;
window.hitungPreviewSettle = hitungPreviewSettle;
window.simpanDraftSettle = simpanDraftSettle;
window.lunasTitipan = lunasTitipan;
window.hapusTitipan = hapusTitipan;
window.cariToko = cariToko;


// MULAI MEMBACA FIREBASE, LALU COBA KIRIM SISA DATA YANG BELUM TERSINKRON
ambilTitipanFirebase().then(sinkronKeFirebase);
