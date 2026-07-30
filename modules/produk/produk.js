import { db } from "../firebase.js";

import {
collection,
getDocs,
doc,
setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

alert("TES AIZZAY");
alert("produk.js berjalan");


// DATA PRODUK
let produk = JSON.parse(localStorage.getItem("produkAizzay")) || [];

// TAMPIL DULUAN DARI LOCAL STORAGE (offline-first, langsung kelihatan tanpa nunggu internet)
tampilProduk();


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem(
        "produkAizzay",
        JSON.stringify(produk)
    );
}


// AMBIL DATA FIREBASE (sinkron di belakang layar, tidak menghalangi tampilan offline)
async function ambilProdukFirebase(){

    try {

        const snapshot = await getDocs(
            collection(db,"produk")
        );

        snapshot.forEach((doc)=>{

            const dataFirebase = doc.data();

            const indexLokal = produk.findIndex(
                p => p.kode === dataFirebase.kode
            );

            if(indexLokal >= 0){
                if(produk[indexLokal].sinkron !== false){
                    // Data lokal sudah tersinkron sebelumnya -> aman ditimpa versi Firebase
                    produk[indexLokal] = {...dataFirebase, sinkron:true};
                }
                // Kalau sinkron:false -> ada perubahan lokal yang belum terkirim, jangan ditimpa dulu
            } else {
                produk.push({...dataFirebase, sinkron:true});
            }

        });

        simpanStorage();
        tampilProduk();

    } catch (err) {

        // Kemungkinan besar offline / tidak ada koneksi -> tetap pakai data lokal, tidak apa-apa
        console.log("Gagal sinkron Firebase (mungkin offline):", err.message);

    }

}

// KIRIM DATA LOKAL YANG BELUM TERSINKRON KE FIREBASE
async function sinkronKeFirebase(){

    let adaPerubahan = false;

    for(const p of produk){

        if(p.sinkron === false){

            try {

                await setDoc(doc(db,"produk",p.kode), p);

                p.sinkron = true;
                adaPerubahan = true;

            } catch (err) {

                // Masih offline / gagal kirim -> biarkan sinkron:false, dicoba lagi nanti
                console.log("Gagal sinkron produk " + p.kode + ":", err.message);

            }

        }

    }

    if(adaPerubahan){
        simpanStorage();
    }

}

// COBA SINKRON OTOMATIS SETIAP KALI KONEKSI INTERNET KEMBALI
window.addEventListener("online", sinkronKeFirebase);


function tampilProduk(data = produk){

    let area = document.getElementById(
        "daftarProduk"
    );


    if(!area){
        console.log(
            "daftarProduk tidak ditemukan"
        );
        return;
    }


    area.innerHTML = "";


    data.forEach((p,index)=>{


        area.innerHTML += `

        <div class="card">

            <h3>${p.kode || ""}</h3>

            <b>${p.nama || ""}</b>

            <p>
            Berat Bal : ${p.berat || 0} kg
            </p>


            <p>
            Harga Toko :
            Rp ${Number(p.hargaToko || 0)
            .toLocaleString()}
            </p>


            <p>
            Harga Jual :
            Rp ${Number(p.hargaJual || 0)
            .toLocaleString()}
            </p>


            <p>
            Status :
            ${p.status || "aktif"}
            </p>

            <p>
            ${p.sinkron === false
                ? "🟡 Menunggu kirim..."
                : "🟢 Tersinkron"}
            </p>


            <button onclick="editProduk(${index})">
            ✏️ Edit
            </button>


            <button onclick="nonaktifProduk(${index})">
            ⛔ Nonaktif
            </button>


        </div>

        `;

    });

}
// CARI PRODUK
function cariProduk(){

    let kata = document
        .getElementById("cariProduk")
        .value
        .toLowerCase();

    let hasil = produk.filter(p =>
        (p.nama || "")
        .toLowerCase()
        .includes(kata)
    );

    tampilProduk(hasil);

}



// SIMPAN PRODUK
function simpanProduk(){

    let data = {

        kode: document
            .getElementById("kode")
            .value
            .toUpperCase(),

        nama: document
            .getElementById("nama")
            .value,

        kategori: document
            .getElementById("kategori")
            .value,

        berat: Number(
            document
            .getElementById("berat")
            .value
        ),

        modal: Number(
            document
            .getElementById("modal")
            .value
        ),

        hargaToko: Number(
            document
            .getElementById("hargaToko")
            .value
        ),

        hargaJual: Number(
            document
            .getElementById("hargaJual")
            .value
        ),

        catatan: document
            .getElementById("catatan")
            .value,

        status: "aktif",

        sinkron: false

    };


    if(!data.kode || !data.nama){

        alert("Kode dan Nama wajib diisi");
        return;

    }


    let cek = produk.some(
        p => p.kode === data.kode
    );

    if(cek){

        alert("Kode produk sudah ada");
        return;

    }


    produk.push(data);

    simpanStorage();

    tampilProduk();

    alert("Produk berhasil ditambahkan");

    sinkronKeFirebase();

}



// EDIT PRODUK
function editProduk(index){

    let p = produk[index];

    document.getElementById("kode").value = p.kode;
    document.getElementById("nama").value = p.nama;
    document.getElementById("kategori").value = p.kategori || "";
    document.getElementById("berat").value = p.berat;
    document.getElementById("modal").value = p.modal || "";
    document.getElementById("hargaToko").value = p.hargaToko;
    document.getElementById("hargaJual").value = p.hargaJual;
    document.getElementById("catatan").value = p.catatan || "";

    produk.splice(index,1);

    simpanStorage();

    alert("Silakan ubah data lalu tekan Simpan");

}



// NONAKTIF PRODUK
function nonaktifProduk(index){

    produk[index].status = "nonaktif";
    produk[index].sinkron = false;

    simpanStorage();

    tampilProduk();

    alert("Produk berhasil dinonaktifkan");

    sinkronKeFirebase();

}



// AGAR BISA DIPANGGIL DARI HTML
window.simpanProduk = simpanProduk;
window.editProduk = editProduk;
window.nonaktifProduk = nonaktifProduk;
window.cariProduk = cariProduk;



// MULAI MEMBACA FIREBASE, LALU COBA KIRIM SISA DATA YANG BELUM TERSINKRON
ambilProdukFirebase().then(sinkronKeFirebase);
