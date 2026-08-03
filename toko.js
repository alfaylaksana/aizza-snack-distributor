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

// ID TITIPAN (KIRIM) YANG SEDANG DIEDIT (null kalau input baru)
let sedangEditKirimId = null;


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
    let areaArsip = document.getElementById("arsipPengambilan");
    let tombolArsip = document.getElementById("tombolArsip");

    if(!area) return;

    let berjalan = titipan.filter(t => t.status !== "selesai");
    let selesai = titipan.filter(t => t.status === "selesai");

    let judul = document.getElementById("judulRiwayatToko");
    if(judul){
        judul.textContent = "Titipan Berjalan (" + berjalan.length + " toko)";
    }
    if(tombolArsip){
        let statusBuka = areaArsip && areaArsip.style.display === "block" ? "▲" : "📁";
        tombolArsip.textContent = statusBuka + " Arsip Nota Pengambilan (" + selesai.length + ")";
    }

    area.innerHTML = "";
    if(areaArsip) areaArsip.innerHTML = "";

    let urut = [...data].sort((a, b) => {
        return new Date(b.tanggalKirim) - new Date(a.tanggalKirim);
    });

    urut.forEach((t)=>{

        let indexAsli = titipan.indexOf(t);

        if(t.status === "selesai"){

            let tujuan = areaArsip;
            if(!tujuan) return; // belum ada elemen arsip, lewati

            let kelasBayar = t.statusBayar === "lunas"
                ? "bayar-lunas"
                : t.statusBayar === "cicilan"
                    ? "bayar-cicilan"
                    : "bayar-hutang";

            let htmlItems = `
                <table class="tabel-mini">
                <tr>
                    <th>Jml</th>
                    <th>Nama</th>
                    <th class="kanan">Harga</th>
                    <th class="kanan">Retur</th>
                    <th class="kanan">Jumlah</th>
                </tr>
                ${(t.itemsSettle || []).map(it => `
                <tr>
                    <td>${it.jumlahKirim || 0}</td>
                    <td>${it.nama || ""}</td>
                    <td class="kanan">${Number(it.hargaToko || 0).toLocaleString("id-ID")}</td>
                    <td class="kanan">${it.jumlahRetur || 0}</td>
                    <td class="kanan">${Number(it.subtotal || 0).toLocaleString("id-ID")}</td>
                </tr>
                `).join("")}
                <tr class="baris-total">
                    <td colspan="4"><b>TOTAL</b></td>
                    <td class="kanan"><b>${Number(t.totalUangSettle || 0).toLocaleString("id-ID")}</b></td>
                </tr>
                </table>
                ${(()=>{
                    let items = t.itemsSettle || [];
                    let bagus = items.reduce((s, it)=> s + Number(it.returBagus || 0), 0);
                    let rusakBks = items.reduce((s, it)=> s + Number(it.returRusakBks || 0), 0);
                    let mlempem = items.reduce((s, it)=> s + Number(it.returMlempem || 0), 0);
                    let tengik = items.reduce((s, it)=> s + Number(it.returTengik || 0), 0);
                    let rincian = [];
                    if(bagus > 0) rincian.push("Bagus " + bagus);
                    if(rusakBks > 0) rincian.push("Rusak Bks " + rusakBks);
                    if(mlempem > 0) rincian.push("Mlempem " + mlempem);
                    if(tengik > 0) rincian.push("Tengik " + tengik);
                    return rincian.length > 0
                        ? `<p class="rincian-retur">🔴 Rincian Retur: ${rincian.join(", ")}</p>`
                        : "";
                })()}
            `;

            tujuan.innerHTML += `

            <div class="card">

                <h3>${t.tanggalKirim || ""} &rarr; ${t.tanggalSettle || ""}</h3>

                <b>${t.toko || ""}</b>

                <p><span class="status-selesai">selesai</span></p>

                ${htmlItems}

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

                <button class="btn-icon" onclick="cetakNota(${indexAsli})">
                🧾
                </button>

                <button class="btn-icon" onclick="kirimWA(${indexAsli})">
                📲
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

            let htmlItems = `
                <table class="tabel-mini">
                <tr>
                    <th>Jml</th>
                    <th>Nama</th>
                    <th class="kanan">Harga</th>
                    <th class="kanan">Jumlah</th>
                </tr>
                ${(t.items || []).map(it => {
                    let subtotal = Number(it.jumlahKirim || 0) * Number(it.hargaToko || 0);
                    return `
                    <tr>
                        <td>${it.jumlahKirim || 0}</td>
                        <td>${it.nama || ""}</td>
                        <td class="kanan">${Number(it.hargaToko || 0).toLocaleString("id-ID")}</td>
                        <td class="kanan">${subtotal.toLocaleString("id-ID")}</td>
                    </tr>
                    `;
                }).join("")}
                <tr class="baris-total">
                    <td colspan="3"><b>TOTAL</b></td>
                    <td class="kanan"><b>${bangunNotaTitipan(t).total.toLocaleString("id-ID")}</b></td>
                </tr>
                </table>
            `;

            area.innerHTML += `

            <div class="card">

                <h3>${t.tanggalKirim || ""}</h3>

                <b>${t.toko || ""}</b>

                ${htmlItems}

                <span class="sinkron-badge">
                ${t.sinkron === false ? "🟡" : "🟢"}
                </span>

                <button class="btn-icon" onclick="bukaSettle(${indexAsli})">
                ✅ Settle
                </button>

                <button class="btn-icon" onclick="editTitipan(${indexAsli})">
                ✏️
                </button>

                <button class="btn-icon" onclick="cetakNota(${indexAsli})">
                🧾
                </button>

                <button class="btn-icon" onclick="kirimWA(${indexAsli})">
                📲
                </button>

                <button class="btn-icon" onclick="hapusTitipan(${indexAsli})">
                🗑️
                </button>

            </div>

            `;

        }

    });

}


// BUKA/TUTUP ARSIP NOTA PENGAMBILAN
function toggleArsip(){

    let areaArsip = document.getElementById("arsipPengambilan");

    if(!areaArsip) return;

    areaArsip.style.display = (areaArsip.style.display === "block") ? "none" : "block";

    tampilTitipan(); // refresh teks tombol (▲/📁)

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

    // Kalau ada hasil pencarian di arsip (status selesai), buka otomatis biar kelihatan
    if(kata && hasil.some(t => t.status === "selesai")){
        let areaArsip = document.getElementById("arsipPengambilan");
        if(areaArsip) areaArsip.style.display = "block";
    }

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

    // CEK DUPLIKAT: toko + tanggal yang sama sudah ada (kecuali yang sedang diedit)
    let sudahAda = titipan.find(t =>
        t.toko.trim().toLowerCase() === toko.trim().toLowerCase() &&
        t.tanggalKirim === tanggalKirim &&
        t.id !== sedangEditKirimId
    );

    if(sudahAda){
        let lanjut = confirm(
            "Sudah ada titipan untuk \"" + toko + "\" tanggal " + tanggalKirim + ".\n" +
            "Yakin mau simpan sebagai titipan BARU (bukan gabung ke yang sudah ada)?"
        );
        if(!lanjut) return;
    }

    let data = {

        id: sedangEditKirimId || (Date.now() + "_" + Math.random().toString(36).slice(2)),

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
    sedangEditKirimId = null;
    document.getElementById("tanggalKirim").value = "";
    document.getElementById("tokoInput").value = "";
    document.getElementById("catatanKirim").value = "";
    document.getElementById("daftarItemKirim").innerHTML = "";
    tambahBarisKirim();

    sinkronKeFirebase();

}


// EDIT TITIPAN (khusus yang masih berjalan / belum disettle)
function editTitipan(index){

    let t = titipan[index];

    sedangEditKirimId = t.id;

    document.getElementById("tanggalKirim").value = t.tanggalKirim || "";
    document.getElementById("tokoInput").value = t.toko || "";
    document.getElementById("catatanKirim").value = t.catatan || "";

    document.getElementById("daftarItemKirim").innerHTML = "";

    let items = t.items || [];

    items.forEach(it=>{

        tambahBarisKirim();

        let barisTerakhir = document
            .getElementById("daftarItemKirim")
            .lastElementChild;

        barisTerakhir.querySelector(".kodeItem").value = it.kode || "";
        barisTerakhir.querySelector(".namaItem").value = it.nama || "";
        barisTerakhir.querySelector(".jumlahItem").value = it.jumlahKirim || "";
        barisTerakhir.querySelector(".hargaItem").value = it.hargaToko || "";

    });

    if(items.length === 0){
        tambahBarisKirim();
    }

    simpanDraft();

    titipan.splice(index, 1);

    simpanStorage();

    tampilTitipan();

    alert("Silakan ubah data lalu tekan Simpan Kirim Titipan");

    document.querySelector(".form-produk").scrollIntoView({behavior:"smooth"});

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
    // pakai data itemsSettle. Kalau belum, pakai items asli (retur mulai dari 0)
    let sumberItems = t.itemsSettle || (t.items || []).map(it => ({
        kode: it.kode,
        nama: it.nama,
        jumlahKirim: it.jumlahKirim,
        hargaToko: it.hargaToko,
        returBagus: 0,
        returRusakBks: 0,
        returMlempem: 0,
        returTengik: 0
    }));

    let area = document.getElementById("daftarItemSettle");
    area.innerHTML = "";

    sumberItems.forEach(it=>{

        let bagus = it.returBagus || 0;
        let rusakBks = it.returRusakBks || 0;
        let mlempem = it.returMlempem || 0;
        let tengik = it.returTengik || 0;

        if(draftCocok && draftCocok.returPerKode && draftCocok.returPerKode[it.kode]){
            let d = draftCocok.returPerKode[it.kode];
            bagus = d.bagus !== undefined ? d.bagus : bagus;
            rusakBks = d.rusakBks !== undefined ? d.rusakBks : rusakBks;
            mlempem = d.mlempem !== undefined ? d.mlempem : mlempem;
            tengik = d.tengik !== undefined ? d.tengik : tengik;
        }

        area.innerHTML += `
        <div class="baris-settle" data-kode="${it.kode}" data-kirim="${it.jumlahKirim}" data-harga="${it.hargaToko}">
            <span class="nama-item-settle">${it.kode} - ${it.nama} (kirim ${it.jumlahKirim})</span>
            <div class="retur-grid">
                <div>
                    <label>Bagus</label>
                    <input class="returBagus" type="number" min="0" value="${bagus}" oninput="hitungPreviewSettle(); simpanDraftSettle();">
                </div>
                <div>
                    <label>Rusak Bks</label>
                    <input class="returRusakBks" type="number" min="0" value="${rusakBks}" oninput="hitungPreviewSettle(); simpanDraftSettle();">
                </div>
                <div>
                    <label>Mlempem</label>
                    <input class="returMlempem" type="number" min="0" value="${mlempem}" oninput="hitungPreviewSettle(); simpanDraftSettle();">
                </div>
                <div>
                    <label>Tengik</label>
                    <input class="returTengik" type="number" min="0" value="${tengik}" oninput="hitungPreviewSettle(); simpanDraftSettle();">
                </div>
            </div>
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
        returPerKode[baris.dataset.kode] = {
            bagus: baris.querySelector(".returBagus").value,
            rusakBks: baris.querySelector(".returRusakBks").value,
            mlempem: baris.querySelector(".returMlempem").value,
            tengik: baris.querySelector(".returTengik").value
        };
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

        let retur =
            (Number(baris.querySelector(".returBagus").value) || 0) +
            (Number(baris.querySelector(".returRusakBks").value) || 0) +
            (Number(baris.querySelector(".returMlempem").value) || 0) +
            (Number(baris.querySelector(".returTengik").value) || 0);

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
// CATAT/PERBARUI/HAPUS ENTRI KAS OTOMATIS YANG TERKAIT SATU TITIPAN
// (entri lama yang terkait sumberId yang sama otomatis diganti, bukan ditambah dobel)
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

        let returBagus = Number(baris.querySelector(".returBagus").value) || 0;
        let returRusakBks = Number(baris.querySelector(".returRusakBks").value) || 0;
        let returMlempem = Number(baris.querySelector(".returMlempem").value) || 0;
        let returTengik = Number(baris.querySelector(".returTengik").value) || 0;

        let retur = returBagus + returRusakBks + returMlempem + returTengik;
        let terjual = Math.max(kirim - retur, 0);
        let subtotal = terjual * hargaToko;

        let namaAsli = (t.items.find(it => it.kode === kode) || {}).nama || "";

        itemsSettle.push({
            kode: kode,
            nama: namaAsli,
            jumlahKirim: kirim,
            returBagus: returBagus,
            returRusakBks: returRusakBks,
            returMlempem: returMlempem,
            returTengik: returTengik,
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

    catatKasOtomatis(
        "toko",
        t.id,
        "usaha",
        "masuk",
        t.jumlahDibayar,
        "Setoran toko " + (t.toko || "") + " (" + t.tanggalSettle + ")"
    );

    tampilTitipan();

    alert("Settle tersimpan. Total: Rp " + total.toLocaleString());

    batalSettle();

    sinkronKeFirebase();

}


// BANGUN TEKS NOTA (dipakai bareng oleh cetakNota & kirimWA)
// BANGUN DATA NOTA TITIPAN (barang yang dikirim/dititip)
function bangunNotaTitipan(t){

    let items = t.items || [];

    let total = items.reduce((jumlah, it) =>
        jumlah + (Number(it.jumlahKirim || 0) * Number(it.hargaToko || 0)), 0
    );

    return { items, total };

}


// BANGUN DATA NOTA SELESAI (hasil settle: retur/laku/uang)
function bangunNotaSelesai(t){

    let items = t.itemsSettle || [];

    let total = t.totalUangSettle || 0;

    return { items, total };

}


// CETAK NOTA (tampilan rapi, siap di-Print/Simpan sebagai PDF dari browser)
// Otomatis pilih Nota Titipan atau Nota Selesai sesuai status titipan
function cetakNota(index){

    let t = titipan[index];

    let html;

    if(t.status === "selesai"){

        let { items, total } = bangunNotaSelesai(t);

        let baris = items.map(it => `
            <tr>
                <td>${it.jumlahKirim || 0}</td>
                <td>${it.nama || ""}</td>
                <td class="kanan">${Number(it.hargaToko || 0).toLocaleString("id-ID")}</td>
                <td class="kanan">${it.jumlahRetur || 0}</td>
                <td class="kanan">${Number(it.subtotal || 0).toLocaleString("id-ID")}</td>
            </tr>
        `).join("");

        html = `
        <html>
        <head>
        <title>Nota Pengambilan - ${t.toko}</title>
        <meta charset="UTF-8">
        <style>
            body{ font-family: Arial, sans-serif; padding:16px; color:#333; }
            h1{ color:#c96b24; margin:0 0 4px 0; font-size:22px; }
            .sub{ margin-bottom:16px; font-size:13px; }
            table{ width:100%; border-collapse:collapse; }
            th, td{ padding:6px; text-align:left; font-size:13px; }
            th{ border-bottom:2px solid #c96b24; }
            .kanan{ text-align:right; }
            .total-row td{ font-weight:bold; border-top:2px solid #c96b24; }
        </style>
        </head>
        <body>

            <h1>AIZZAY SNACK</h1>
            <div class="sub">
                Nota Pengambilan : ${t.tanggalSettle || ""}<br>
                (Titipan dikirim ${t.tanggalKirim || ""})<br>
                Toko : ${t.toko || ""}
            </div>

            <table>
            <tr>
                <th>Jml</th>
                <th>Nama Produk</th>
                <th class="kanan">Harga</th>
                <th class="kanan">Retur</th>
                <th class="kanan">Jumlah</th>
            </tr>
            ${baris}
            <tr class="total-row">
                <td colspan="4">TOTAL</td>
                <td class="kanan">Rp ${total.toLocaleString("id-ID")}</td>
            </tr>
            </table>

            <div class="sub" style="margin-top:12px">
                Status Bayar : ${t.statusBayar || ""}
                ${t.sisaHutang > 0 ? "<br>Sisa Hutang : Rp " + Number(t.sisaHutang).toLocaleString("id-ID") : ""}
            </div>

        </body>
        </html>
        `;

    } else {

        let { items, total } = bangunNotaTitipan(t);

        let baris = items.map(it => {
            let subtotal = Number(it.jumlahKirim || 0) * Number(it.hargaToko || 0);
            return `
            <tr>
                <td>${it.jumlahKirim || 0}</td>
                <td>${it.nama || ""}</td>
                <td class="kanan">${Number(it.hargaToko || 0).toLocaleString("id-ID")}</td>
                <td class="kanan">${subtotal.toLocaleString("id-ID")}</td>
            </tr>
            `;
        }).join("");

        html = `
        <html>
        <head>
        <title>Nota Titipan - ${t.toko}</title>
        <meta charset="UTF-8">
        <style>
            body{ font-family: Arial, sans-serif; padding:16px; color:#333; }
            h1{ color:#c96b24; margin:0 0 4px 0; font-size:22px; }
            .sub{ margin-bottom:16px; font-size:13px; }
            table{ width:100%; border-collapse:collapse; }
            th, td{ padding:6px; text-align:left; font-size:13px; }
            th{ border-bottom:2px solid #c96b24; }
            .kanan{ text-align:right; }
            .total-row td{ font-weight:bold; border-top:2px solid #c96b24; }
        </style>
        </head>
        <body>

            <h1>AIZZAY SNACK</h1>
            <div class="sub">
                Nota Titipan : ${t.tanggalKirim || ""}<br>
                Toko : ${t.toko || ""}
            </div>

            <table>
            <tr>
                <th>Jml</th>
                <th>Nama Produk</th>
                <th class="kanan">Harga</th>
                <th class="kanan">Jumlah</th>
            </tr>
            ${baris}
            <tr class="total-row">
                <td colspan="3">TOTAL</td>
                <td class="kanan">Rp ${total.toLocaleString("id-ID")}</td>
            </tr>
            </table>

        </body>
        </html>
        `;

    }

    let jendela = window.open("", "_blank");

    if(!jendela){
        alert("Popup diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.");
        return;
    }

    jendela.document.write(html);
    jendela.document.close();

    setTimeout(()=> jendela.print(), 300);

}


// UBAH FORMAT TANGGAL DARI YYYY-MM-DD (input HTML) JADI DD-MM-YYYY (tampilan nota)
function formatTanggalID(tgl){
    if(!tgl) return "";
    let bagian = tgl.split("-");
    if(bagian.length !== 3) return tgl;
    return bagian[2] + "-" + bagian[1] + "-" + bagian[0];
}

// RATAKAN TEKS KIRI, POTONG KALAU KEPANJANGAN (untuk kolom monospace)
function rataKiri(teks, panjang){
    teks = String(teks);
    if(teks.length > panjang) return teks.slice(0, panjang - 1) + "…";
    return teks.padEnd(panjang, " ");
}

// RATAKAN TEKS KANAN (untuk kolom angka)
function rataKanan(teks, panjang){
    teks = String(teks);
    if(teks.length > panjang) return teks.slice(teks.length - panjang);
    return teks.padStart(panjang, " ");
}


// KIRIM NOTA VIA WHATSAPP (teks siap kirim, tinggal pilih kontak)
// Otomatis pilih Nota Titipan atau Nota Selesai sesuai status titipan
function kirimWA(index){

    let t = titipan[index];

    let teks = "*AIZZAY SNACK*\n";

    if(t.status === "selesai"){

        let { items, total } = bangunNotaSelesai(t);

        teks += "Nota Pengambilan: " + formatTanggalID(t.tanggalSettle) + "\n";
        teks += "(Titipan dikirim " + formatTanggalID(t.tanggalKirim) + ")\n";
        teks += "Toko: " + (t.toko || "") + "\n\n";

        teks += "```\n";
        teks += rataKiri("Jml", 4) + rataKiri("Nama", 13) + rataKanan("Harga", 7) + "  " + rataKanan("Retur", 5) + rataKanan("Jumlah", 9) + "\n";
        teks += "-".repeat(40) + "\n";

        let totalRetur = 0;

        items.forEach(it=>{
            totalRetur += Number(it.jumlahRetur || 0);
            teks += rataKiri(it.jumlahKirim || 0, 4) +
                rataKiri(it.nama || "", 13) +
                rataKanan(Number(it.hargaToko || 0).toLocaleString("id-ID"), 7) + "  " +
                rataKanan(it.jumlahRetur || 0, 5) +
                rataKanan(Number(it.subtotal || 0).toLocaleString("id-ID"), 9) + "\n";
        });

        teks += "-".repeat(40) + "\n";
        teks += rataKiri("TOTAL", 31) + rataKanan(total.toLocaleString("id-ID"), 9) + "\n";
        teks += "```\n";

        if(totalRetur > 0){
            teks += "\n🔴 *RETUR: " + totalRetur + " bungkus*\n";
        }

        teks += "\nStatus Bayar: " + (t.statusBayar || "");
        if(t.sisaHutang > 0){
            teks += "\nSisa Hutang: Rp" + Number(t.sisaHutang).toLocaleString("id-ID");
        }

    } else {

        let { items, total } = bangunNotaTitipan(t);

        teks += "Nota Titipan: " + formatTanggalID(t.tanggalKirim) + "\n";
        teks += "Toko: " + (t.toko || "") + "\n\n";

        // Bagian tabel dibungkus ``` supaya WhatsApp menampilkannya pakai
        // font monospace (lebar karakter sama rata) - kolomnya jadi sejajar
        teks += "```\n";
        teks += rataKiri("Jml", 4) + rataKiri("Nama", 13) + rataKanan("Harga", 7) + "   " + rataKanan("Jumlah", 9) + "\n";
        teks += "-".repeat(36) + "\n";

        items.forEach(it=>{
            let subtotal = Number(it.jumlahKirim || 0) * Number(it.hargaToko || 0);
            teks += rataKiri(it.jumlahKirim || 0, 4) +
                rataKiri(it.nama || "", 13) +
                rataKanan(Number(it.hargaToko || 0).toLocaleString("id-ID"), 7) + "   " +
                rataKanan(subtotal.toLocaleString("id-ID"), 9) + "\n";
        });

        teks += "-".repeat(36) + "\n";
        teks += rataKiri("TOTAL", 17) + "   " + rataKanan(total.toLocaleString("id-ID"), 9) + "\n";
        teks += "```";

    }

    let url = "https://wa.me/?text=" + encodeURIComponent(teks);

    window.open(url, "_blank");

}


// TANDAI LUNAS (untuk titipan yang sudah selesai tapi masih hutang/cicilan)
function lunasTitipan(index){

    titipan[index].statusBayar = "lunas";
    titipan[index].jumlahDibayar = titipan[index].totalUangSettle;
    titipan[index].sisaHutang = 0;
    titipan[index].sinkron = false;

    simpanStorage();

    catatKasOtomatis(
        "toko",
        titipan[index].id,
        "usaha",
        "masuk",
        titipan[index].jumlahDibayar,
        "Pelunasan setoran toko " + (titipan[index].toko || "") + " (" + titipan[index].tanggalSettle + ")"
    );

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

    // Hapus juga entri Kas otomatis yang terkait titipan ini (kalau ada, dari settle)
    catatKasOtomatis("toko", t.id, "usaha", "masuk", 0, "");

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
window.editTitipan = editTitipan;
window.cetakNota = cetakNota;
window.kirimWA = kirimWA;
window.batalSettle = batalSettle;
window.simpanSettle = simpanSettle;
window.toggleJumlahDibayarSettle = toggleJumlahDibayarSettle;
window.hitungPreviewSettle = hitungPreviewSettle;
window.simpanDraftSettle = simpanDraftSettle;
window.lunasTitipan = lunasTitipan;
window.hapusTitipan = hapusTitipan;
window.cariToko = cariToko;
window.toggleArsip = toggleArsip;


// MULAI MEMBACA FIREBASE, LALU COBA KIRIM SISA DATA YANG BELUM TERSINKRON
ambilTitipanFirebase().then(sinkronKeFirebase);
