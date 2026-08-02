// PENGATURAN - EXPORT & IMPORT DATA (BACKUP/RESTORE)

// EXPORT SEMUA DATA (PRODUK, BELANJA, TOKO) JADI SATU FILE JSON
function exportData(){

    let data = {
        aplikasi: "Aizzay Snack Distributor",
        versiExport: 1,
        tanggalExport: new Date().toISOString(),
        produk: JSON.parse(localStorage.getItem("produkAizzay")) || [],
        belanja: JSON.parse(localStorage.getItem("belanjaAizzay")) || [],
        titipan: JSON.parse(localStorage.getItem("titipanAizzay")) || [],
        kas: JSON.parse(localStorage.getItem("kasAizzay")) || [],
        packing: JSON.parse(localStorage.getItem("packingAizzay")) || [],
        bayarUpahPacking: JSON.parse(localStorage.getItem("packingBayarUpahAizzay")) || []
    };

    let teks = JSON.stringify(data, null, 2);

    let blob = new Blob([teks], { type: "application/json" });
    let url = URL.createObjectURL(blob);

    let namaFile = "aizzay-backup-" + new Date().toISOString().slice(0, 10) + ".json";

    let a = document.createElement("a");
    a.href = url;
    a.download = namaFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

}


// GABUNGKAN DATA LAMA + DATA IMPORT, TANPA MENIMPA YANG SUDAH ADA (COCOKKAN BERDASAR KEY UNIK)
function gabungkanArray(existing, incoming, keyField){

    let existingKeys = new Set(existing.map(x => x[keyField]));

    let tambahan = incoming.filter(x => !existingKeys.has(x[keyField]));

    return {
        hasil: existing.concat(tambahan),
        jumlahTambahan: tambahan.length
    };

}


// IMPORT DATA DARI FILE JSON (MODE GABUNG ATAU TIMPA, DENGAN KONFIRMASI)
function importData(event){

    let file = event.target.files[0];
    if(!file) return;

    let mode = document.querySelector('input[name="modeImport"]:checked').value;

    let reader = new FileReader();

    reader.onload = function(e){

        let data;

        try {
            data = JSON.parse(e.target.result);
        } catch (err) {
            alert("File JSON tidak valid / rusak.");
            event.target.value = "";
            return;
        }

        if(!data || (!data.produk && !data.belanja && !data.titipan && !data.kas && !data.packing && !data.bayarUpahPacking)){
            alert("File ini bukan file backup Aizzay yang dikenali.");
            event.target.value = "";
            return;
        }

        if(mode === "timpa"){

            let ringkasan =
                "Produk: " + (data.produk ? data.produk.length : 0) + " data\n" +
                "Belanja: " + (data.belanja ? data.belanja.length : 0) + " data\n" +
                "Toko: " + (data.titipan ? data.titipan.length : 0) + " data\n" +
                "Kas: " + (data.kas ? data.kas.length : 0) + " data\n" +
                "Packing: " + (data.packing ? data.packing.length : 0) + " data\n" +
                "Bayar Upah Packing: " + (data.bayarUpahPacking ? data.bayarUpahPacking.length : 0) + " data" +
                (data.tanggalExport
                    ? "\n\nDiexport pada: " + new Date(data.tanggalExport).toLocaleString("id-ID")
                    : "");

            let konfirmasi = confirm(
                "PERINGATAN!\n\nIni akan MENGGANTI SEMUA data Produk, Belanja, Toko, Kas, dan Packing " +
                "yang ada di HP ini dengan isi file berikut:\n\n" +
                ringkasan +
                "\n\nData yang sekarang akan HILANG dan tidak bisa dikembalikan kecuali " +
                "Antum punya backup lain. Lanjutkan?"
            );

            if(!konfirmasi){
                event.target.value = "";
                return;
            }

            if(data.produk) localStorage.setItem("produkAizzay", JSON.stringify(data.produk));
            if(data.belanja) localStorage.setItem("belanjaAizzay", JSON.stringify(data.belanja));
            if(data.titipan) localStorage.setItem("titipanAizzay", JSON.stringify(data.titipan));
            if(data.kas) localStorage.setItem("kasAizzay", JSON.stringify(data.kas));
            if(data.packing) localStorage.setItem("packingAizzay", JSON.stringify(data.packing));
            if(data.bayarUpahPacking) localStorage.setItem("packingBayarUpahAizzay", JSON.stringify(data.bayarUpahPacking));

            alert("Import (timpa total) berhasil. Aplikasi akan dimuat ulang.");

            location.reload();

            return;

        }

        // MODE GABUNG
        let produkLama = JSON.parse(localStorage.getItem("produkAizzay")) || [];
        let belanjaLama = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];
        let titipanLama = JSON.parse(localStorage.getItem("titipanAizzay")) || [];
        let kasLama = JSON.parse(localStorage.getItem("kasAizzay")) || [];
        let packingLama = JSON.parse(localStorage.getItem("packingAizzay")) || [];
        let bayarUpahLama = JSON.parse(localStorage.getItem("packingBayarUpahAizzay")) || [];

        let hasilProduk = gabungkanArray(produkLama, data.produk || [], "kode");
        let hasilBelanja = gabungkanArray(belanjaLama, data.belanja || [], "id");
        let hasilTitipan = gabungkanArray(titipanLama, data.titipan || [], "id");
        let hasilKas = gabungkanArray(kasLama, data.kas || [], "id");
        let hasilPacking = gabungkanArray(packingLama, data.packing || [], "id");
        let hasilBayarUpah = gabungkanArray(bayarUpahLama, data.bayarUpahPacking || [], "id");

        let ringkasanGabung =
            "Produk: +" + hasilProduk.jumlahTambahan + " data baru\n" +
            "Belanja: +" + hasilBelanja.jumlahTambahan + " data baru\n" +
            "Toko: +" + hasilTitipan.jumlahTambahan + " data baru\n" +
            "Kas: +" + hasilKas.jumlahTambahan + " data baru\n" +
            "Packing: +" + hasilPacking.jumlahTambahan + " data baru\n" +
            "Bayar Upah Packing: +" + hasilBayarUpah.jumlahTambahan + " data baru\n\n" +
            "Data yang sudah ada di HP tidak akan diubah.";

        let totalTambahan =
            hasilProduk.jumlahTambahan + hasilBelanja.jumlahTambahan +
            hasilTitipan.jumlahTambahan + hasilKas.jumlahTambahan +
            hasilPacking.jumlahTambahan + hasilBayarUpah.jumlahTambahan;

        if(totalTambahan === 0){
            alert("Tidak ada data baru untuk ditambahkan — semua data di file ini sudah ada di HP.");
            event.target.value = "";
            return;
        }

        let konfirmasi = confirm(
            "Gabungkan data dari file ini?\n\n" + ringkasanGabung + "\n\nLanjutkan?"
        );

        if(!konfirmasi){
            event.target.value = "";
            return;
        }

        localStorage.setItem("produkAizzay", JSON.stringify(hasilProduk.hasil));
        localStorage.setItem("belanjaAizzay", JSON.stringify(hasilBelanja.hasil));
        localStorage.setItem("titipanAizzay", JSON.stringify(hasilTitipan.hasil));
        localStorage.setItem("kasAizzay", JSON.stringify(hasilKas.hasil));
        localStorage.setItem("packingAizzay", JSON.stringify(hasilPacking.hasil));
        localStorage.setItem("packingBayarUpahAizzay", JSON.stringify(hasilBayarUpah.hasil));

        alert("Gabung data berhasil. Aplikasi akan dimuat ulang.");

        location.reload();

    };

    reader.onerror = function(){
        alert("Gagal membaca file.");
        event.target.value = "";
    };

    reader.readAsText(file);

}


// AGAR BISA DIPANGGIL DARI HTML
window.exportData = exportData;
window.importData = importData;
