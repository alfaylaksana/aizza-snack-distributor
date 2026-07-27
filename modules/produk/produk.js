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
