// PENGATURAN - EXPORT & IMPORT DATA (BACKUP/RESTORE)

// EXPORT SEMUA DATA (PRODUK, BELANJA, TOKO) JADI SATU FILE JSON
function exportData(){

    let data = {
        aplikasi: "Aizzay Snack Distributor",
        versiExport: 1,
        tanggalExport: new Date().toISOString(),
        produk: JSON.parse(localStorage.getItem("produkAizzay")) || [],
        belanja: JSON.parse(localStorage.getItem("belanjaAizzay")) || [],
        titipan: JSON.parse(localStorage.getItem("titipanAizzay")) || []
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

        if(!data || (!data.produk && !data.belanja && !data.titipan)){
            alert("File ini bukan file backup Aizzay yang dikenali.");
            event.target.value = "";
            return;
        }

        if(mode === "timpa"){

            let ringkasan =
                "Produk: " + (data.produk ? data.produk.length : 0) + " data\n" +
                "Belanja: " + (data.belanja ? data.belanja.length : 0) + " data\n" +
                "Toko: " + (data.titipan ? data.titipan.length : 0) + " data" +
                (data.tanggalExport
                    ? "\n\nDiexport pada: " + new Date(data.tanggalExport).toLocaleString("id-ID")
                    : "");

            let konfirmasi = confirm(
                "PERINGATAN!\n\nIni akan MENGGANTI SEMUA data Produk, Belanja, dan Toko " +
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

            alert("Import (timpa total) berhasil. Aplikasi akan dimuat ulang.");

            location.reload();

            return;

        }

        // MODE GABUNG
        let produkLama = JSON.parse(localStorage.getItem("produkAizzay")) || [];
        let belanjaLama = JSON.parse(localStorage.getItem("belanjaAizzay")) || [];
        let titipanLama = JSON.parse(localStorage.getItem("titipanAizzay")) || [];

        let hasilProduk = gabungkanArray(produkLama, data.produk || [], "kode");
        let hasilBelanja = gabungkanArray(belanjaLama, data.belanja || [], "id");
        let hasilTitipan = gabungkanArray(titipanLama, data.titipan || [], "id");

        let ringkasanGabung =
            "Produk: +" + hasilProduk.jumlahTambahan + " data baru\n" +
            "Belanja: +" + hasilBelanja.jumlahTambahan + " data baru\n" +
            "Toko: +" + hasilTitipan.jumlahTambahan + " data baru\n\n" +
            "Data yang sudah ada di HP tidak akan diubah.";

        let totalTambahan =
            hasilProduk.jumlahTambahan + hasilBelanja.jumlahTambahan + hasilTitipan.jumlahTambahan;

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
