let produk = JSON.parse(localStorage.getItem("produkAizzay")) || [
{
kode:"MDJ",
nama:"Makroni Daun Jeruk",
berat:4,
hargaToko:7000,
hargaJual:8000,
status:"aktif"
},
{
kode:"BTK",
nama:"Basreng Tongkol",
berat:2,
hargaToko:7000,
hargaJual:8000,
status:"aktif"
},
{
kode:"SBM",
nama:"Seblak Mix",
berat:2.5,
hargaToko:7000,
hargaJual:8000,
status:"aktif"
}
];


function simpanStorage(){
    localStorage.setItem(
        "produkAizzay",
        JSON.stringify(produk)
    );
}


function tampilProduk(data=produk){

let area=document.getElementById("daftarProduk");

area.innerHTML="";


data.forEach((p,index)=>{

area.innerHTML += `

<div class="card">

<h3>${p.kode}</h3>

<b>${p.nama}</b>

<p>
Berat Bal : ${p.berat} kg
</p>

<p>
Harga Toko :
Rp ${p.hargaToko.toLocaleString()}
</p>

<p>
Harga Jual :
Rp ${p.hargaJual.toLocaleString()}
</p>

<p>
Status : ${p.status}
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


function cariProduk(){

let kata =
document.getElementById("cariProduk")
.value
.toLowerCase();


let hasil = produk.filter(p =>
p.nama.toLowerCase().includes(kata)
);


tampilProduk(hasil);

}


window.onload = tampilProduk;
function simpanProduk(){

let data = {

kode: document.getElementById("kode").value.toUpperCase(),

nama: document.getElementById("nama").value,

kategori: document.getElementById("kategori").value,

berat: Number(document.getElementById("berat").value),

modal: Number(document.getElementById("modal").value),

hargaToko: Number(document.getElementById("hargaToko").value),

hargaJual: Number(document.getElementById("hargaJual").value),

catatan: document.getElementById("catatan").value,

status:"aktif"

};


if(!data.kode || !data.nama){

alert("Kode dan nama produk wajib diisi");

return;

}


let cek = produk.some(p => p.kode === data.kode);

if(cek){

alert("Kode produk sudah terdaftar");

return;

}


produk.push(data);

simpanStorage();

tampilProduk();


alert("Produk berhasil ditambahkan");

}



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


alert("Data siap diedit. Silakan tekan Simpan.");

}



function nonaktifProduk(index){

    produk[index].status="nonaktif";

    simpanStorage();

    tampilProduk();

    alert("Produk dinonaktifkan");

}


// di luar fungsi
tampilProduk();
