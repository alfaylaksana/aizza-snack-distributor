import { db } from "../firebase.js";

import {
collection,
getDocs,
doc,
setDoc,
deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// DATA PACKING (tiap record = 1 sesi: status "ambil" -> "selesai")
let packing = JSON.parse(localStorage.getItem("packingAizzay")) || [];
let antrianHapus = JSON.parse(localStorage.getItem("packingHapusAizzay")) || [];

// DATA PEMBAYARAN UPAH (terpisah dari sesi packing, karena pembayaran sesukanya/tidak per-sesi)
let bayarUpahList = JSON.parse(localStorage.getItem("packingBayarUpahAizzay")) || [];
let antrianHapusBayar = JSON.parse(localStorage.getItem("packingBayarUpahHapusAizzay")) || [];


// SET TANGGAL DEFAULT HARI INI
let inputTanggal = document.getElementById("tanggalAmbil");
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
isiDaftarNamaPekerja();
tampilStokBal();
tampilSedangProses();
tampilUpahPekerja();
tampilPacking();


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem("packingAizzay", JSON.stringify(packing));
}
function simpanAntrianHapus(){
    localStorage.setItem("packingHapusAizzay", JSON.stringify(antrianHapus));
}
function simpanBayarUpah(){
    localStorage.setItem("packingBayarUpahAizzay", JSON.stringify(bayarUpahList));
}
function simpanAntrianHapusBayar(){
    localStorage.setItem("packingBayarUpahHapusAizzay", JSON.stringify(antrianHapusBayar));
}


// CATAT/PERBARUI/HAPUS ENTRI KAS OTOMATIS (dipakai untuk pembayaran upah)
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


// SIMPAN TARIF UPAH KE LOCAL STORAGE
function simpanTarifUpah(){
    let tarif = Number(document.getElementById("tarifUpahPacking").value) || 0;
    localStorage.setItem("packingTarifUpah", tarif);
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


// TOTAL BAL YANG SUDAH DIAMBIL UNTUK PACKING (BAIK STATUS AMBIL MAUPUN SELESAI) UNTUK SATU KODE PRODUK
// (begitu diambil pekerja, bal dianggap keluar dari stok gudang meski belum "selesai")
function hitungTotalDipacking(kode){

    return packing
        .filter(p => p.kode === kode)
        .reduce((total, p)=> total + Number(p.balDipakai || 0), 0);

}


// STOK BAL TERSISA DI GUDANG (BELUM DIAMBIL SIAPA-SIAPA)
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


// ISI SARAN NAMA PEKERJA (DARI NAMA-NAMA YANG PERNAH DIPAKAI SEBELUMNYA)
function isiDaftarNamaPekerja(){

    let datalist = document.getElementById("daftarNamaPekerja");
    if(!datalist) return;

    let namaUnik = [...new Set(
        packing
            .map(p => p.pekerja)
            .filter(nama => nama)
    )];

    datalist.innerHTML = namaUnik
        .map(nama => `<option value="${nama}">`)
        .join("");

}


// TAMPIL INFO RASIO & STOK BAL SAAT PRODUK DIPILIH
function tampilInfoProduk(){

    let kode = document.getElementById("produkPacking").value;
    let info = document.getElementById("infoProduk");

    if(!kode){
        info.textContent = "";
        return;
    }

    let p = ambilProdukByKode(kode);
    let stokBal = hitungStokBal(kode);
    let rasio = p && p.rasioPacking ? p.rasioPacking : 0;

    info.innerHTML =
        "Rasio: " + (rasio || "belum diisi di Produk") + " bks/bal &nbsp;|&nbsp; " +
        "Stok Bal di Gudang: " + stokBal + " bal";

}


// CEK APAKAH PEKERJA INI MASIH PUNYA SESI "AMBIL" YANG BELUM DISELESAIKAN
function cekSedangProses(pekerja){
    return packing.find(p => p.pekerja === pekerja && p.status === "ambil");
}


// CATAT AMBIL (BAL KELUAR DARI GUDANG, DIBAWA PEKERJA, BELUM DIHITUNG HASIL)
function catatAmbilPacking(){

    let pekerja = document.getElementById("pekerjaAmbil").value.trim();
    let tanggal = document.getElementById("tanggalAmbil").value;
    let kode = document.getElementById("produkPacking").value;
    let bal = Number(document.getElementById("balPacking").value);
    let catatan = document.getElementById("catatanPacking").value.trim();

    if(!pekerja || !tanggal || !kode){
        alert("Nama Pekerja, Tanggal, dan Produk wajib diisi");
        return;
    }

    if(!bal || bal <= 0){
        alert("Jumlah bal harus lebih dari 0");
        return;
    }

    let sesiBerjalan = cekSedangProses(pekerja);

    if(sesiBerjalan){
        alert(
            pekerja + " masih punya proses packing yang belum selesai:\n\n" +
            (sesiBerjalan.nama || sesiBerjalan.kode) + " - " + sesiBerjalan.balDipakai + " bal " +
            "(diambil " + sesiBerjalan.tanggalAmbil + ")\n\n" +
            "Selesaikan dulu sesi itu sebelum ambil baru."
        );
        return;
    }

    let p = ambilProdukByKode(kode);
    let stokBal = hitungStokBal(kode);

    if(bal > stokBal){
        let lanjut = confirm(
            "Stok Bal " + kode + " di gudang cuma tersisa " + stokBal + ", tapi mau diambil " + bal +
            ".\n\nLanjutkan tetap? (mungkin ada kulakan yang belum dicatat)"
        );
        if(!lanjut) return;
    }

    packing.push({
        id: Date.now() + "_" + Math.random().toString(36).slice(2),
        kode: kode,
        nama: p ? p.nama : "",
        balDipakai: bal,
        pekerja: pekerja,
        tanggalAmbil: tanggal,
        status: "ambil",
        tanggalSelesai: null,
        rasioSaatItu: null,
        tarifUpahSaatItu: null,
        hasilBungkus: null,
        upah: null,
        catatan: catatan,
        sinkron: false
    });

    simpanStorage();
    tampilStokBal();
    tampilSedangProses();
    tampilInfoProduk();
    isiDaftarNamaPekerja();

    document.getElementById("balPacking").value = "";
    document.getElementById("catatanPacking").value = "";

    alert("Tercatat: " + pekerja + " ambil " + bal + " bal " + (p ? p.nama : kode));

    sinkronKeFirebase();

}


// TANDAI SESI SEBAGAI SELESAI (HASIL BUNGKUS & UPAH DIHITUNG DI SINI)
function selesaikanPacking(id){

    let rec = packing.find(p => p.id === id);
    if(!rec || rec.status !== "ambil") return;

    let p = ambilProdukByKode(rec.kode);
    let rasio = p && p.rasioPacking ? Number(p.rasioPacking) : 0;

    if(!rasio){
        alert("Rasio Packing produk " + rec.kode + " belum diisi. Isi dulu di menu Produk (Master Produk).");
        return;
    }

    let tarifUpah = Number(localStorage.getItem("packingTarifUpah")) || 0;
    let hasilBungkus = rec.balDipakai * rasio;
    let upah = hasilBungkus * tarifUpah;

    let konfirmasi = confirm(
        "Selesaikan packing " + (rec.nama || rec.kode) + " (" + rec.pekerja + ", " + rec.balDipakai + " bal)?\n\n" +
        "Hasil: " + hasilBungkus + " bungkus\n" +
        (tarifUpah > 0 ? "Upah: Rp " + upah.toLocaleString("id-ID") : "Tarif upah belum diisi, upah dicatat Rp 0")
    );

    if(!konfirmasi) return;

    rec.status = "selesai";
    rec.tanggalSelesai = new Date().toISOString().slice(0, 10);
    rec.rasioSaatItu = rasio;
    rec.tarifUpahSaatItu = tarifUpah;
    rec.hasilBungkus = hasilBungkus;
    rec.upah = upah;
    rec.sinkron = false;

    simpanStorage();
    tampilStokBal();
    tampilSedangProses();
    tampilUpahPekerja();
    tampilPacking();

    sinkronKeFirebase();

}


// HAPUS SATU SESI PACKING (BAIK YANG MASIH "AMBIL" MAUPUN YANG SUDAH "SELESAI")
function hapusPacking(id){

    let p = packing.find(x => x.id === id);
    if(!p) return;

    let pesan = p.status === "ambil"
        ? "Yakin hapus catatan ambil " + (p.nama || p.kode) + " (" + p.pekerja + ", " + p.balDipakai + " bal)?"
        : "Yakin hapus catatan packing selesai " + (p.nama || p.kode) + " (" + p.pekerja + ", " + p.balDipakai + " bal)?\n\nKalau upahnya sudah pernah dibayar sebagian/lunas, sisa utang pekerja ini bisa jadi tidak akurat lagi setelah dihapus.";

    if(!confirm(pesan)) return;

    packing = packing.filter(x => x.id !== id);
    simpanStorage();
    tampilStokBal();
    tampilSedangProses();
    tampilUpahPekerja();
    tampilPacking();

    antrianHapus.push(id);
    simpanAntrianHapus();

    prosesAntrianHapus();

}


// HITUNG TOTAL UPAH YANG SUDAH "SELESAI" DIKERJAKAN UNTUK SATU PEKERJA
function hitungTotalUpahSelesai(pekerja){
    return packing
        .filter(p => p.pekerja === pekerja && p.status === "selesai")
        .reduce((total, p)=> total + Number(p.upah || 0), 0);
}

// HITUNG TOTAL YANG SUDAH DIBAYARKAN KE SATU PEKERJA
function hitungTotalDibayar(pekerja){
    return bayarUpahList
        .filter(b => b.pekerja === pekerja)
        .reduce((total, b)=> total + Number(b.nominal || 0), 0);
}

// SISA UTANG UPAH = TOTAL SELESAI - TOTAL SUDAH DIBAYAR
function hitungUtangUpah(pekerja){
    return hitungTotalUpahSelesai(pekerja) - hitungTotalDibayar(pekerja);
}


// BAYAR UPAH KE SATU PEKERJA (INPUT NOMINAL BEBAS, SESUAI PERMINTAAN PEKERJA)
function bayarUpah(pekerja){

    let utang = hitungUtangUpah(pekerja);

    let input = prompt(
        "Sisa utang upah " + pekerja + ": Rp " + utang.toLocaleString("id-ID") + "\n\nBayar berapa sekarang?",
        utang > 0 ? utang : ""
    );

    if(input === null) return;

    let nominal = Number(input);

    if(!nominal || nominal <= 0){
        alert("Nominal tidak valid");
        return;
    }

    let idBayar = Date.now() + "_" + Math.random().toString(36).slice(2);
    let tanggal = new Date().toISOString().slice(0, 10);

    bayarUpahList.push({
        id: idBayar,
        pekerja: pekerja,
        tanggal: tanggal,
        nominal: nominal,
        sinkron: false
    });

    simpanBayarUpah();

    catatKasOtomatis(
        "packing-upah",
        idBayar,
        "usaha",
        "keluar",
        nominal,
        "Bayar upah packing " + pekerja + " (" + tanggal + ")"
    );

    tampilUpahPekerja();

    alert("Pembayaran Rp " + nominal.toLocaleString("id-ID") + " ke " + pekerja + " tercatat.");

    sinkronBayarUpahKeFirebase();

}


// TAMPIL DAFTAR SESI YANG SEDANG DIKERJAKAN (STATUS "AMBIL")
function tampilSedangProses(){

    let area = document.getElementById("daftarSedangProses");
    if(!area) return;

    let berjalan = packing.filter(p => p.status === "ambil");

    if(berjalan.length === 0){
        area.innerHTML = "<p style='color:#888;'>Tidak ada yang sedang dikerjakan.</p>";
        return;
    }

    area.innerHTML = berjalan.map(p=>`
        <div class="baris-proses">
            <span class="status-badge status-ambil">PROSES</span>
            <b>${p.pekerja}</b> - ${p.nama || p.kode} (${p.balDipakai} bal)
            <div class="baris-catatan">Diambil: ${p.tanggalAmbil}${p.catatan ? " — " + p.catatan : ""}</div>
            <button onclick="selesaikanPacking('${p.id}')">✅ Selesaikan</button>
            <button onclick="hapusPacking('${p.id}')">🗑️ Hapus</button>
        </div>
    `).join("");

}


// TAMPIL DAFTAR UPAH PER PEKERJA YANG BELUM LUNAS DIBAYAR
function tampilUpahPekerja(){

    let area = document.getElementById("daftarUpahPekerja");
    if(!area) return;

    let namaPekerja = [...new Set(packing.filter(p => p.status === "selesai").map(p => p.pekerja))];

    if(namaPekerja.length === 0){
        area.innerHTML = "<p style='color:#888;'>Belum ada packing yang selesai.</p>";
        return;
    }

    area.innerHTML = namaPekerja.map(nama=>{

        let utang = hitungUtangUpah(nama);

        let riwayat = bayarUpahList
            .filter(b => b.pekerja === nama)
            .sort((a, b)=> new Date(b.tanggal) - new Date(a.tanggal));

        let htmlRiwayat = riwayat.length === 0
            ? "<p style='color:#888;'>Belum ada pembayaran.</p>"
            : riwayat.map(b=>`
                <div class="baris-transaksi">
                    <div>${b.tanggal} — Rp ${Number(b.nominal).toLocaleString("id-ID")}</div>
                    <button class="btn-icon" onclick="hapusBayarUpah('${b.id}')">🗑️</button>
                </div>
            `).join("");

        return `
        <div class="baris-upah">
            <span><b>${nama}</b><br><span class="utang-nominal">Rp ${utang.toLocaleString("id-ID")}</span></span>
            <button onclick="bayarUpah('${nama}')" ${utang <= 0 ? "disabled" : ""}>💵 Bayar Upah</button>
        </div>
        <details class="bulan-group">
            <summary>Riwayat pembayaran ${nama} <span class="jumlah-bulan">(${riwayat.length})</span></summary>
            <div class="bulan-isi">${htmlRiwayat}</div>
        </details>
        `;

    }).join("");

}


// HAPUS SATU RIWAYAT PEMBAYARAN UPAH (SEKALIGUS BATALKAN ENTRI KAS YANG TERKAIT)
function hapusBayarUpah(id){

    let b = bayarUpahList.find(x => x.id === id);
    if(!b) return;

    if(!confirm("Yakin hapus pembayaran Rp " + Number(b.nominal).toLocaleString("id-ID") + " ke " + b.pekerja + " (" + b.tanggal + ")?\n\nEntri Kas yang terbentuk otomatis dari pembayaran ini juga akan ikut terhapus.")){
        return;
    }

    bayarUpahList = bayarUpahList.filter(x => x.id !== id);
    simpanBayarUpah();

    antrianHapusBayar.push(id);
    simpanAntrianHapusBayar();

    // HAPUS JUGA ENTRI KAS OTOMATIS YANG TERKAIT (NOMINAL 0 = HAPUS, TIDAK BIKIN BARU)
    catatKasOtomatis("packing-upah", id, "usaha", "keluar", 0, "");

    tampilUpahPekerja();

    prosesAntrianHapusBayar();

}


// TAMPIL STOK BAL PER PRODUK
function tampilStokBal(){

    let area = document.getElementById("daftarStokBal");
    if(!area) return;

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];
    let aktif = produkList.filter(p => p.status !== "nonaktif");

    if(aktif.length === 0){
        area.innerHTML = "<p style='color:#888;'>Belum ada produk.</p>";
        return;
    }

    area.innerHTML = aktif.map(p=>{

        let stok = hitungStokBal(p.kode);
        let kelas = stok < 0 ? "stok-minus" : (stok === 0 ? "stok-habis" : "");

        return `
        <div class="baris-stok ${kelas}" onclick="debugStokBal('${p.kode}')" style="cursor:pointer;">
            <span>${p.kode} - ${p.nama}</span>
            <b>${stok} bal</b>
        </div>
        `;

    }).join("");

}


// DEBUG SEMENTARA: TAMPIL RINCIAN MENTAH PERHITUNGAN STOK BAL UNTUK SATU KODE
// (dipanggil dengan tap di baris Stok Bal — bukan fitur permanen, buat lacak masalah Juli)
function debugStokBal(kode){

    let belanjaMentah = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];

    let cocok = [];
    belanjaMentah.forEach(b=>{
        ambilItemsBelanja(b).forEach(it=>{
            if(it.kode === kode){
                cocok.push((b.tanggal || "?") + " : " + it.jumlahBal + " bal");
            }
        });
    });

    let totalBeli = hitungTotalBeli(kode);
    let totalDipacking = hitungTotalDipacking(kode);
    let stokAkhir = totalBeli - totalDipacking;

    let pesan =
        "KODE: " + kode + "\n\n" +
        "Jumlah nota belanja tersimpan di HP ini: " + belanjaMentah.length + "\n\n" +
        "Baris yang cocok kode '" + kode + "':\n" +
        (cocok.length > 0 ? cocok.join("\n") : "(TIDAK ADA YANG COCOK)") + "\n\n" +
        "Total Beli: " + totalBeli + " bal\n" +
        "Total Dipacking: " + totalDipacking + " bal\n" +
        "Stok Bal: " + stokAkhir + " bal";

    alert(pesan);

}


// TAMPIL RIWAYAT PACKING YANG SUDAH SELESAI (DIKELOMPOKKAN PER BULAN)
function tampilPacking(){

    let area = document.getElementById("daftarPacking");
    if(!area) return;

    area.innerHTML = "";

    let selesai = packing.filter(p => p.status === "selesai");

    if(selesai.length === 0){
        area.innerHTML = "<p style='color:#888;'>Belum ada riwayat packing selesai.</p>";
        return;
    }

    let urut = [...selesai].sort((a, b)=>{
        return new Date(b.tanggalSelesai) - new Date(a.tanggalSelesai);
    });

    let kelompok = {};

    urut.forEach((p)=>{

        let tgl = p.tanggalSelesai ? new Date(p.tanggalSelesai) : null;

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
                    <span class="status-badge status-selesai">SELESAI</span>
                    <b>${p.nama || p.kode}</b>
                    <span class="label-kas">${p.pekerja}</span>
                    <div class="baris-catatan">
                        Ambil: ${p.tanggalAmbil} → Selesai: ${p.tanggalSelesai}<br>
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


// ================== SINKRON FIREBASE: SESI PACKING ==================

async function ambilPackingFirebase(){

    try {

        const snapshot = await getDocs(collection(db, "packing"));

        snapshot.forEach((docSnap)=>{

            const dataFirebase = docSnap.data();

            if(antrianHapus.includes(dataFirebase.id)){
                return;
            }

            const indexLokal = packing.findIndex(p => p.id === dataFirebase.id);

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
        tampilSedangProses();
        tampilUpahPekerja();
        tampilPacking();

    } catch (err) {
        console.log("Gagal sinkron Firebase packing (mungkin offline):", err.message);
    }

}

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


// ================== SINKRON FIREBASE: PEMBAYARAN UPAH ==================

async function ambilBayarUpahFirebase(){

    try {

        const snapshot = await getDocs(collection(db, "packingBayarUpah"));

        snapshot.forEach((docSnap)=>{

            const dataFirebase = docSnap.data();

            if(antrianHapusBayar.includes(dataFirebase.id)){
                return;
            }

            const indexLokal = bayarUpahList.findIndex(b => b.id === dataFirebase.id);

            if(indexLokal >= 0){
                if(bayarUpahList[indexLokal].sinkron !== false){
                    bayarUpahList[indexLokal] = {...dataFirebase, sinkron: true};
                }
            } else {
                bayarUpahList.push({...dataFirebase, sinkron: true});
            }

        });

        simpanBayarUpah();
        tampilUpahPekerja();

    } catch (err) {
        console.log("Gagal sinkron Firebase bayar upah (mungkin offline):", err.message);
    }

}

async function sinkronBayarUpahKeFirebase(){

    let adaPerubahan = false;

    for(const b of bayarUpahList){
        if(b.sinkron === false){
            try {
                await setDoc(doc(db, "packingBayarUpah", b.id), b);
                b.sinkron = true;
                adaPerubahan = true;
            } catch (err) {
                console.log("Gagal sinkron bayar upah " + b.id + ":", err.message);
            }
        }
    }

    if(adaPerubahan){
        simpanBayarUpah();
    }

}

window.addEventListener("online", sinkronBayarUpahKeFirebase);

async function prosesAntrianHapusBayar(){

    let sisaAntrian = [];

    for(const id of antrianHapusBayar){
        try {
            await deleteDoc(doc(db, "packingBayarUpah", id));
        } catch (err) {
            console.log("Gagal hapus bayar upah " + id + " di Firebase (mungkin offline):", err.message);
            sisaAntrian.push(id);
        }
    }

    antrianHapusBayar = sisaAntrian;
    simpanAntrianHapusBayar();

}

window.addEventListener("online", prosesAntrianHapusBayar);


// AGAR BISA DIPANGGIL DARI HTML
window.tampilInfoProduk = tampilInfoProduk;
window.simpanTarifUpah = simpanTarifUpah;
window.catatAmbilPacking = catatAmbilPacking;
window.selesaikanPacking = selesaikanPacking;
window.hapusPacking = hapusPacking;
window.bayarUpah = bayarUpah;
window.hapusBayarUpah = hapusBayarUpah;
window.debugStokBal = debugStokBal;


// PROSES ANTRIAN HAPUS DULU, BARU AMBIL DATA FIREBASE (HINDARI RACE CONDITION), BARU SINKRON SISA DATA
prosesAntrianHapus()
    .then(ambilPackingFirebase)
    .then(sinkronKeFirebase);

prosesAntrianHapusBayar()
    .then(ambilBayarUpahFirebase)
    .then(sinkronBayarUpahKeFirebase);
