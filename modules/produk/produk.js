import { db } from "../../firebase.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


alert("TES AIZZAY");
alert("produk.js berjalan");


// DATA PRODUK
let produk = JSON.parse(localStorage.getItem("produkAizzay")) || [];


// SIMPAN LOCAL STORAGE
function simpanStorage(){
    localStorage.setItem(
        "produkAizzay",
        JSON.stringify(produk)
    );
}


// AMBIL DATA FIREBASE
async function ambilProdukFirebase(){

    try {

        console.log("Mulai membaca Firestore...");

        const snapshot = await getDocs(
            collection(db,"produk")
        );


        produk = [];


        snapshot.forEach((doc)=>{

            produk.push({
                id: doc.id,
                ...doc.data()
            });

        });


        console.log("Jumlah produk:", produk.length);


        tampilProduk();


    } catch(error){

        console.error(
            "Gagal membaca Firebase:",
            error
        );

    }

}


// TAMPIL PRODUK
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
