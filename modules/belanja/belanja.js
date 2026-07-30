import { db } from "../firebase.js";

import {
collection,
getDocs,
doc,
setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// DATA BELANJA
let belanja = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];

// TAMPIL DULUAN DARI LOCAL STORAGE (offline-first)
tampilBelanja();

// ISI DATALIST PRODUK DARI MASTER PRODUK (localStorage bersama modul Produk)
isiDaftarProdukDropdown();


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem(
        "belanjaAizzay",
        JSON.stringify(belanja)
    );
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


// OTOMATIS ISI NAMA PRODUK KALAU KODE COCOK DENGAN MASTER PRODUK
function isiNamaOtomatis(){

    let kode = document
        .getElementById("kodeBelanja")
        .value
        .toUpperCase();

    let produkList = JSON.parse(localStorage.getItem("produkAizzay")) || [];

    let ditemukan = produkList.find(p => p.kode === kode);

    if(ditemukan){
        document.getElementById("namaBelanja").value = ditemukan.nama;
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


// TAMPIL BELANJA
function tampilBelanja(data = belanja){

    let area = document.getElementById(
        "daftarBelanja"
    );

    if(!area){
        console.log(
            "daftarBelanja tidak ditemukan"
        );
        return;
    }

    area.innerHTML = "";

    // Terbaru di atas
    let urut = [...data].reverse();

    urut.forEach((b)=>{

        let indexAsli = belanja.indexOf(b);

        let kelasBayar = b.statusBayar === "lunas"
            ? "bayar-lunas"
            : b.statusBayar === "cicilan"
                ? "bayar-cicilan"
                : "bayar-hutang";

        area.innerHTML += `

        <div class="card">

            <h3>${b.tanggal || ""}</h3>

            <p>${b.supplier || ""}</p>

            <b>${b.kode || ""} - ${b.nama || ""}</b>

            <p>
            ${b.jumlahBal || 0} bal &times;
            Rp ${Number(b.hargaPerBal || 0).toLocaleString()}
            </p>

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

        </div>

        `;

    });

}


// CARI BELANJA
function cariBelanja(){

    let kata = document
        .getElementById("cariBelanja")
        .value
        .toLowerCase();

    let hasil = belanja.filter(b =>
        (b.nama || "").toLowerCase().includes(kata) ||
        (b.supplier || "").toLowerCase().includes(kata) ||
        (b.kode || "").toLowerCase().includes(kata)
    );

    tampilBelanja(hasil);

}


// SIMPAN BELANJA
function simpanBelanja(){

    let kode = document
        .getElementById("kodeBelanja")
        .value
        .toUpperCase();

    let nama = document
        .getElementById("namaBelanja")
        .value;

    let jumlahBal = Number(
        document.getElementById("jumlahBal").value
    );

    let hargaPerBal = Number(
        document.getElementById("hargaPerBal").value
    );

    let statusBayar = document
        .getElementById("statusBayar")
        .value;

    if(!kode || !nama || !jumlahBal || !hargaPerBal){
        alert("Kode, Nama, Jumlah Bal, dan Harga per Bal wajib diisi");
        return;
    }

    let total = jumlahBal * hargaPerBal;

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

        tanggal: document.getElementById("tanggalBelanja").value,

        supplier: document.getElementById("supplierBelanja").value,

        kode: kode,

        nama: nama,

        jumlahBal: jumlahBal,

        hargaPerBal: hargaPerBal,

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

    alert("Belanja berhasil dicatat");

    sinkronKeFirebase();

}


// EDIT BELANJA
function editBelanja(index){

    let b = belanja[index];

    document.getElementById("tanggalBelanja").value = b.tanggal || "";
    document.getElementById("supplierBelanja").value = b.supplier || "";
    document.getElementById("kodeBelanja").value = b.kode || "";
    document.getElementById("namaBelanja").value = b.nama || "";
    document.getElementById("jumlahBal").value = b.jumlahBal || "";
    document.getElementById("hargaPerBal").value = b.hargaPerBal || "";
    document.getElementById("statusBayar").value = b.statusBayar || "lunas";
    document.getElementById("jumlahDibayar").value = b.jumlahDibayar || "";
    document.getElementById("catatanBelanja").value = b.catatan || "";

    toggleJumlahDibayar();

    belanja.splice(index,1);

    simpanStorage();

    tampilBelanja();

    alert("Silakan ubah data lalu tekan Simpan");

}


// TANDAI LUNAS (untuk hutang/cicilan yang sudah dibayar penuh)
function lunasBelanja(index){

    belanja[index].statusBayar = "lunas";
    belanja[index].jumlahDibayar = belanja[index].total;
    belanja[index].sisaHutang = 0;
    belanja[index].sinkron = false;

    simpanStorage();

    tampilBelanja();

    alert("Belanja ditandai lunas");

    sinkronKeFirebase();

}


// AGAR BISA DIPANGGIL DARI HTML
window.simpanBelanja = simpanBelanja;
window.editBelanja = editBelanja;
window.lunasBelanja = lunasBelanja;
window.cariBelanja = cariBelanja;
window.isiNamaOtomatis = isiNamaOtomatis;
window.toggleJumlahDibayar = toggleJumlahDibayar;


// MULAI MEMBACA FIREBASE, LALU COBA KIRIM SISA DATA YANG BELUM TERSINKRON
ambilBelanjaFirebase().then(sinkronKeFirebase);
