const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyaIKhpTPFX8agYAJ-s9v2j2dk0AMtTZLndtO5_151e9z1yio7OkqI2fKLUcsL508LM/exec";

let masterMenuRaw = []; // Menyimpan semua baris data dari sheet Daftar_Doc_Soal
let kontenPanel = { utama: "", tambahan: "", kerja: "" }; 
let identitasSudahValid = false; 

// 1. Ambil Menu Bab & Daftar Kelas Dinamis saat halaman pertama dibuka
window.onload = function() {
    // Ambil Semua Data Baris Menu dari Sheet Daftar_Doc_Soal
    fetch(WEB_APP_URL + "?action=getDaftarMenu")
    .then(res => res.json())
    .then(response => {
        if(response.status === "success") {
            masterMenuRaw = response.data;
            const dropdown = document.getElementById("pilihLkpd");
            dropdown.innerHTML = '<option value="">-- Pilih Pembahasan LKPD --</option>';
            
            // Filter agar dropdown hanya memunculkan judul utama unik (baris pertama tiap pertemuan)
            let pertemuanUnik = [];
            masterMenuRaw.forEach(item => {
                if(item.tipe.toUpperCase() === "LKPD" && !pertemuanUnik.includes(item.pertemuan)) {
                    pertemuanUnik.push(item.pertemuan);
                    let opt = document.createElement("option");
                    opt.value = item.pertemuan; // Simpan nomor pertemuan sebagai value
                    opt.innerText = "Pertemuan " + item.pertemuan + " - " + item.judul;
                    dropdown.appendChild(opt);
                }
            });
        }
    }).catch(err => console.error("Gagal memuat menu dokumen: " + err));

    // Ambil Daftar Kelas Dinamis dari Tab Nilai_LKPD
    fetch(WEB_APP_URL + "?action=getDaftarKelasDinamis")
    .then(res => res.json())
    .then(response => {
        if(response.status === "success") {
            const dropdownKelas = document.getElementById("pilihKelas");
            dropdownKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
            response.data.forEach(kelas => {
                let opt = document.createElement("option");
                opt.value = kelas; opt.innerText = kelas;
                dropdownKelas.appendChild(opt);
            });
        }
    }).catch(err => alert("Gagal memuat daftar kelas: " + err));
};

// 2. Menarik konten dari 3 baris spreadsheet sekaligus berdasarkan nomor Pertemuan
// Menarik konten dari 3 dokumen spreadsheet secara berurutan berdasarkan nomor Pertemuan
// Menarik konten Google Doc dan membaginya ke 3 panel berdasarkan urutan ID halaman
// Menarik konten Google Doc dan membaginya ke 3 panel berdasarkan urutan halaman asli
// Menarik konten dinamis dari 3 baris spreadsheet beserta ID Tab uniknya
// Menarik konten dinamis dari 3 baris spreadsheet secara aman (Bebas Bug Potong Markdown)
function muatStrukturGoogleDoc() {
    const noPertemuan = document.getElementById("pilihLkpd").value;
    const isiDoc = document.getElementById("isiDoc");
    
    if(!noPertemuan) {
        isiDoc.innerText = "Silakan pilih bab pertemuan di atas.";
        return;
    }

    isiDoc.innerHTML = "<span style='font-style:italic; color:#64748b;'>Sedang menyinkronkan data dari spreadsheet...</span>";
    
    // Filter mengambil paket baris berdasarkan kesamaan nomor pertemuan
    let paketMateri = masterMenuRaw.filter(item => item.pertemuan.toString() === noPertemuan.toString() && item.tipe.toUpperCase() === "LKPD");

    if(paketMateri.length === 0) {
        isiDoc.innerText = "Data paket pertemuan tidak ditemukan.";
        return;
    }

    // AMAN: Memecah baris spreadsheet 1, 2, dan 3 menggunakan Destructuring (Tanpa Kurung Siku Angka)
    const [itemUtama, itemTambahan, itemKerja] = paketMateri;

    // Mengunci ID Dokumen dan ID Tab masing-masing panel secara dinamis
    let idUtama = itemUtama ? itemUtama.idDoc : "";
    let tabUtama = itemUtama ? itemUtama.idTab : "";

    let idTambahan = itemTambahan ? itemTambahan.idDoc : "";
    let tabTambahan = itemTambahan ? itemTambahan.idTab : "";

    let idKerja = itemKerja ? itemKerja.idDoc : "";
    let tabKerja = itemKerja ? itemKerja.idTab : "";

    // Siapkan transaksi penarikan berkas teks HTML menuju server backend
    let reqUtama = idUtama ? fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify({ action: "getDocContentParsed", idDoc: idUtama, tabId: tabUtama }) }).then(r => r.json()) : Promise.resolve({status:"success", content:"Materi Utama kosong."});
    let reqTambahan = idTambahan ? fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify({ action: "getDocContentParsed", idDoc: idTambahan, tabId: tabTambahan }) }).then(r => r.json()) : Promise.resolve({status:"success", content:"Materi Tambahan kosong."});
    let reqKerja = idKerja ? fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify({ action: "getDocContentParsed", idDoc: idKerja, tabId: tabKerja }) }).then(r => r.json()) : Promise.resolve({status:"success", content:"Lembar Kerja kosong."});

    // Jalankan eksekusi penarikan 3 dokumen secara bersamaan
Promise.all([reqUtama, reqTambahan, reqKerja])
.then(results => {
  // === BARIS PELACAK (DEBUG): SILAKAN LIHAT ISI INI DI INSPECT ELEMENT ===
  console.log("Respon Masuk dari Server Google:", results);
  
  const [resUtama, resTambahan, resKerja] = results;

  // Jika gagal, tampilkan pesan eror asli dari server agar kita bisa membacanya
  if (resUtama && resUtama.status !== "success") {
    alert("Pesan Eror Server (Utama): " + resUtama.message);
  }

  // Menyuntikkan hasil teks final ke masing-masing panel penampung
  kontenPanel.utama = (resUtama && resUtama.status === "success") ? resUtama.content : "Gagal memuat Materi Utama.";
  kontenPanel.tambahan = (resTambahan && resTambahan.status === "success") ? resTambahan.content : "Materi Tambahan tidak tersedia.";
  kontenPanel.kerja = (resKerja && resKerja.status === "success") ? resKerja.content : "Lembar Kerja tidak tersedia.";
  
  gantiPanel('utama');
}).catch(err => {
  isiDoc.innerText = "Error kegagalan transaksi data panel: " + err;
  alert("Eror Koneksi/Script Frontend: " + err);
});

}

// 3. Fungsi memindahkan tayangan isi teks saat tombol panel diklik siswa
function gantiPanel(namaPanel) {
    document.querySelectorAll('.tab-navigation .tab-btn').forEach(b => b.classList.remove('active'));
    
    if(namaPanel === 'utama') document.getElementById("btnMateriUtama").classList.add('active');
    if(namaPanel === 'tambahan') document.getElementById("btnMateriTambahan").classList.add('active');
    if(namaPanel === 'kerja') document.getElementById("btnLembarKerja").classList.add('active');

    // Suntikkan teks materi ke kotak HP
    document.getElementById("isiDoc").innerHTML = kontenPanel[namaPanel] || "Konten kosong.";
}

// 4. Fungsi memuat nama siswa otomatis berdasarkan dropdown Kelas
function muatDaftarSiswaPerKelas() {
    const kelasTerpilih = document.getElementById("pilihKelas").value;
    const semuaDropdownNama = document.querySelectorAll(".opsi-nama-siswa");
    semuaDropdownNama.forEach((dropdown, idx) => { dropdown.innerHTML = `<option value="">-- Pilih Anggota ${idx + 1} --</option>`; });
    if (!kelasTerpilih) return;

    fetch(WEB_APP_URL + "?action=getSiswaPerKelas&kelas=" + encodeURIComponent(kelasTerpilih))
    .then(res => res.json()).then(response => {
        if (response.status === "success") {
            semuaDropdownNama.forEach((dropdown) => {
                response.data.forEach(namaSiswa => {
                    let opt = document.createElement("option"); opt.value = namaSiswa; opt.innerText = namaSiswa;
                    dropdown.appendChild(opt);
                });
            });
        }
    });
}

function dapatkanListAnggotaDariDropdown() {
    let listNama = [];
    document.querySelectorAll(".opsi-nama-siswa").forEach(d => { if (d.value.trim() !== "") listNama.push(d.value.trim()); });
    return listNama.join(", ");
}

// 5. Proses Pengiriman Tahap 1 & Tahap 2 (Tetap Dipertahankan Sesuai Sistem Lama)
// ==========================================================================
// TAHAP 1: KUNCI & DAFTARKAN IDENTITAS KELOMPOK KE SERVER
// ==========================================================================
// ==========================================================================
// TAHAP 1: KUNCI & DAFTARKAN IDENTITAS KELOMPOK VIA GET (ANTI EROR FETCH)
// ==========================================================================
function kirimBagianIdentitas() {
  const kelasSelect = document.getElementById("pilihKelas");
  const lkpdSelect = document.getElementById("pilihLkpd");
  
  const kelasSiswa = kelasSelect ? kelasSelect.value.trim() : "";
  const noPertemuan = lkpdSelect ? lkpdSelect.value.trim() : "";

  if (!kelasSiswa || !noPertemuan) {
    alert("Silakan pilih Bab Pertemuan dan Kelas terlebih dahulu!");
    return;
  }

  const semuaDropdown = document.querySelectorAll(".opsi-nama-siswa");
  let arrayNamaTerpilih = [];
  semuaDropdown.forEach(dropdown => {
    if (dropdown && dropdown.value.trim() !== "") {
      arrayNamaTerpilih.push(dropdown.value.trim());
    }
  });

  if (arrayNamaTerpilih.length === 0) {
    alert("Minimal pilih 1 nama anggota kelompok!");
    return;
  }

  const anggotaList = arrayNamaTerpilih.join(", ");
  const kolomLKPD = "Nilai_LKPD_" + noPertemuan;

  // SUSUN PARAMETER DI DALAM URL (METODE GET)
  const urlTujuan = WEB_APP_URL + 
    "?action=simpanNilaiLKPDViaGet" +
    "&kelasSiswa=" + encodeURIComponent(kelasSiswa) +
    "&anggotaList=" + encodeURIComponent(anggotaList) +
    "&kolomLKPD=" + encodeURIComponent(kolomLKPD) +
    "&jawabanDiskusi=" + encodeURIComponent("--- Terdaftar ---");

  const btnKunci = document.getElementById("btnKunciIdentitas");
  if (btnKunci) {
    btnKunci.disabled = true;
    btnKunci.innerText = "Mendaftarkan Kelompok...";
  }

  // Tembak menggunakan GET biasa agar lolos dari blokir CORS browser
  fetch(urlTujuan, { method: "GET" })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      alert("Identitas Kelompok Berhasil Didaftarkan!");
      
      if (kelasSelect) kelasSelect.disabled = true;
      if (lkpdSelect) lkpdSelect.disabled = true;
      semuaDropdown.forEach(d => { if (d) d.disabled = true; });
      if (btnKunci) btnKunci.style.display = "none";

      const txtJawaban = document.getElementById("jawabanTugas");
      const btnKirim = document.getElementById("btnKirimJawaban");
      if (txtJawaban) {
        txtJawaban.disabled = false;
        txtJawaban.placeholder = "Tuliskan hasil diskusi kelompok Anda di sini dengan lengkap...";
        txtJawaban.focus();
      }
      if (btnKirim) btnKirim.disabled = false;

      const badge = document.getElementById("badgeStatusIdentitas");
      if (badge) {
        badge.innerText = "Kelompok Terdaftar (" + arrayNamaTerpilih.length + " Siswa)";
        badge.className = "status-badge status-success";
      }
    } else {
      alert("Gagal daftar dari server: " + data.message);
      if (btnKunci) {
        btnKunci.disabled = false;
        btnKunci.innerText = "1. Kunci & Daftarkan Kelompok";
      }
    }
  })
  .catch(err => {
    alert("Eror transmisi data: " + err);
    if (btnKunci) {
      btnKunci.disabled = false;
      btnKunci.innerText = "1. Kunci & Daftarkan Kelompok";
    }
  });
}

// ==========================================================================
// TAHAP 2: KIRIM JAWABAN TEKS DISKUSI KELOMPOK VIA GET
// ==========================================================================
function kirimBagianJawaban() {
  const jawabanDiskusi = document.getElementById("jawabanTugas") ? document.getElementById("jawabanTugas").value.trim() : "";
  
  if (!jawabanDiskusi) {
    alert("Kotak jawaban masih kosong! Silakan tulis hasil diskusi Anda.");
    return;
  }

  const kelasSiswa = document.getElementById("pilihKelas") ? document.getElementById("pilihKelas").value.trim() : "";
  const noPertemuan = document.getElementById("pilihLkpd") ? document.getElementById("pilihLkpd").value.trim() : "";

  const semuaDropdown = document.querySelectorAll(".opsi-nama-siswa");
  let arrayNamaTerpilih = [];
  semuaDropdown.forEach(dropdown => {
    if (dropdown && dropdown.value.trim() !== "") {
      arrayNamaTerpilih.push(dropdown.value.trim());
    }
  });

  const anggotaList = arrayNamaTerpilih.join(", ");
  const kolomLKPD = "Nilai_LKPD_" + noPertemuan;

  // SUSUN PARAMETER JAWABAN DI DALAM URL GET
  const urlTujuanJawaban = WEB_APP_URL + 
    "?action=simpanNilaiLKPDViaGet" +
    "&kelasSiswa=" + encodeURIComponent(kelasSiswa) +
    "&anggotaList=" + encodeURIComponent(anggotaList) +
    "&kolomLKPD=" + encodeURIComponent(kolomLKPD) +
    "&jawabanDiskusi=" + encodeURIComponent(jawabanDiskusi);

  const btnKirim = document.getElementById("btnKirimJawaban");
  if (btnKirim) {
    btnKirim.disabled = true;
    btnKirim.innerText = "Mengirim Jawaban...";
  }

  fetch(urlTujuanJawaban, { method: "GET" })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      alert("Selamat! Lembar Jawaban Diskusi Kelompok Berhasil Terkirim.");
      
      const txtJawaban = document.getElementById("jawabanTugas");
      if (txtJawaban) {
        txtJawaban.value = "";
        txtJawaban.disabled = true;
        txtJawaban.placeholder = "Jawaban berhasil dikirim! Kotak dikunci kembali.";
      }
      if (btnKirim) {
        btnKirim.innerText = "Jawaban Terkirim ✅";
      }
    } else {
      alert("Gagal mengirim jawaban: " + data.message);
      if (btnKirim) {
        btnKirim.disabled = false;
        btnKirim.innerText = "2. Kirim Lembar Jawaban";
      }
    }
  })
  .catch(err => {
    alert("Eror jaringan saat kirim: " + err);
    if (btnKirim) {
      btnKirim.disabled = false;
      btnKirim.innerText = "2. Kirim Lembar Jawaban";
    }
  });
}
