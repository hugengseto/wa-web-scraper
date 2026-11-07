# WA Group Members & Number Scraper (Chrome Extension) v1.0.0

Ekstensi browser Chrome / Edge / Brave (Manifest V3) serbaguna untuk:
1. **Mengekstrak (scrape) seluruh nomor kontak dari anggota grup WhatsApp** secara otomatis ke Excel / CSV / Clipboard.
2. **Mencocokkan data CSV eksternal (data pendaftar, leads, member, pelanggan)** langsung dengan anggota grup WhatsApp untuk mengetahui siapa saja yang **sudah masuk** vs **belum masuk grup**.

---

## 🌟 Fitur Unggulan

### 1. ⚡ Scrape Anggota Grup WhatsApp
- **Ekstraksi Cerdas & Lengkap**: Mengambil kontak tersimpan maupun nomor belum tersimpan (nomor baru) dari grup WhatsApp berkapasitas besar (>1.000 anggota).
- **Auto-Scroll Pintar**: Menangani sistem virtual-list WhatsApp Web secara otomatis dan toleran terhadap koneksi lambat.
- **Deep Scan & IndexedDB Integration**: Mampu membaca database internal lokal peramban untuk verifikasi nomor telepon peserta.

### 2. ⚡ Pencocokan Data CSV Eksternal (Universal CSV Matcher)
- **Universal untuk Semua Bidang**: Cocok untuk panitia event/webinar, admin komunitas, pemilik bisnis online/CRM, maupun institusi pendidikan/kampus.
- **Wizard 3 Langkah Interaktif**:
  - **Langkah 1**: Upload file CSV (drag & drop, auto-detect delimiter koma `,`, titik koma `;`, atau tab `\t`).
  - **Langkah 2**: Deteksi kolom otomatis dengan live preview.
  - **Langkah 3**: Statistik hasil pencocokan, filter instan, dan tombol aksi.
- **Dukungan Dual-Phone (2 Nomor per Baris)**: Mendukung peserta yang memiliki 2 nomor WhatsApp sekaligus (misal nomor utama & cadangan, atau nomor pribadi & kantor). Jika salah satu atau keduanya bergabung, data terhitung akurat.
- **Normalisasi Format Indonesia & Excel**: Otomatis mengonversi nomor tanpa nol depan (`812...`), awalan `08...`, `+62...`, maupun spasi/strip ke format standar internasional E.164.
- **Tingkat Akurasi 98%**: Menggunakan pencocokan identitas nomor telepon pasti (*Zero False Positive*).

### 3. 📥 Ekspor Hasil Fleksibel & Proteksi Excel
- **📗 Excel Lengkap (.xls) — Sorotan Sel Hijau Asli**: Sel nomor telepon yang sudah masuk grup otomatis diwarnai **HIJAU ASLI** (`#86efac`) dengan teks hijau tebal.
- **Bebas Notasi Ilmiah (`6.28E+11`)**: Seluruh nomor telepon di-protect dengan `mso-number-format: "\@"` sehingga angka `08...` atau `62...` tidak akan terpotong angka nol depannya.
- **📄 CSV Lengkap (.csv)**: Mempertahankan seluruh kolom file asli + menambahkan kolom status `🟢 SUDAH MASUK GRUP` / `⏳ BELUM MASUK`.
- **📋 CSV Khusus Belum Masuk (.csv)**: Mengekstrak hanya baris yang belum bergabung untuk kebutuhan follow-up / broadcast.
- **⚡ Salin Nomor Sekali Klik**: Salin seluruh nomor yang belum masuk ke clipboard komputer siap pakai.

### 4. 🔒 100% Aman & Menjaga Privasi
- Berjalan **100% secara lokal di browser Anda**.
- **Tidak ada data yang dikirim ke server pihak ketiga manapun**.
- Dilengkapi template aman `sample_contacts_dummy.csv` dan `.gitignore` untuk melindungi data pribadi.

---

## 📁 Struktur Folder Proyek

```
wa-web-scraper/
├── manifest.json              # Konfigurasi Manifest V3 Chrome Extension
├── icons/                     # Ikon ekstensi (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content/                   # Floating widget & antarmuka WhatsApp Web
│   ├── content.js             # Engine scroller, matcher wizard, & UI controller
│   └── content.css            # Desain tema modern WhatsApp Dark Mode
├── injected/                  # Script injeksi context halaman (MAIN world)
│   └── store-extractor.js     # Akses memori Store internal WhatsApp Web
├── utils/                     # Utility helpers
│   ├── phone-parser.js        # Parser & normalisasi nomor telepon (+62...)
│   ├── csv-matcher.js         # Engine RFC 4180 CSV parser & dual-phone matcher
│   ├── exporter.js            # Generator Excel (.xls hijau), CSV UTF-8, & clipboard
│   └── idb-extractor.js       # Pembaca IndexedDB lokal WhatsApp Web
├── popup/                     # Menu ringkas popup extension
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── sample_contacts_dummy.csv  # File contoh template CSV publik
├── LICENSE                    # Lisensi Open Source (MIT License)
├── .gitignore                 # Proteksi keamanan data pengguna
└── README.md                  # Dokumentasi panduan
```

---

## 🚀 Panduan Instalasi (Load Unpacked)

Ekstensi ini dapat dipasang pada semua browser berbasis Chromium (**Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi**):

1. Buka browser **Google Chrome** (atau Brave / Edge).
2. Di kolom alamat URL, buka:
   ```
   chrome://extensions/
   ```
   *(Untuk Edge: `edge://extensions/`)*
3. Di sudut kanan atas halaman, aktifkan toggle **"Developer mode"** (Mode pengembang).
4. Klik tombol **"Load unpacked"** (Muat yang belum dibongkar) di sudut kiri atas.
5. Pilih folder proyek `wa-web-scraper`.
6. Ekstensi **"WA Group Members & Number Scraper"** telah siap digunakan! 🎉

---

## 📖 Cara Menggunakan

### A. Mengambil Anggota Grup (Scraping):
1. Buka [web.whatsapp.com](https://web.whatsapp.com/) dan buka salah satu obrolan grup WhatsApp.
2. Klik tombol mengambang hijau **🟢 WA Scraper** di sudut kanan bawah.
3. Klik tombol **"⚡ Scrape Semua Anggota"**.
4. Tunggu beberapa detik hingga proses auto-scroll selesai (indikator mencapai 100%).
5. Klik **"Download CSV"** atau **"Salin Semua Nomor"**.

### B. Mencocokkan Data CSV dengan Anggota Grup:
1. Pastikan Anda sudah melakukan scraping anggota grup di atas.
2. Buka tab **"⚡ Cocokkan CSV"** pada panel ekstensi.
3. **Langkah 1 (Upload)**: Drag & drop file CSV data kontak Anda (atau gunakan `sample_contacts_dummy.csv`).
4. **Langkah 2 (Pilih Kolom)**: Sistem otomatis mendeteksi kolom nomor telepon utama & cadangan. Klik **"Mulai Cocokkan Data"**.
5. **Langkah 3 (Hasil & Tindakan)**:
   - Pantau ringkasan berapa kontak yang sudah vs belum bergabung.
   - Klik **"Salin Belum Masuk"** untuk langsung menyalin nomor yang belum join untuk di-broadcast / japri.
   - Klik **"Download Hasil"** $\rightarrow$ pilih **Excel Lengkap (.xls)** untuk mendapatkan file tabel dengan sel nomor bertanda hijau asli.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **MIT License** — bebas digunakan, dimodifikasi, dan didistribusikan untuk keperluan pribadi maupun komersial. Lihat file [LICENSE](LICENSE) untuk informasi lebih lanjut.
