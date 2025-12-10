# 📊 Sistem Akuntansi & Perpajakan 2026

Aplikasi manajemen keuangan lengkap berbasis web dengan fitur akuntansi dan perpajakan yang komprehensif, termasuk **SPT Tahunan PPh Badan**.

## 🎯 Fitur Utama

### 1. **Dashboard Keuangan**
- Overview posisi keuangan perusahaan
- Total Aset, Kewajiban, dan Modal
- Laba Bersih periode berjalan
- Ringkasan Pendapatan dan Beban
- Transaksi terakhir

### 2. **Pencatatan Transaksi**
- Input transaksi dengan sistem double-entry
- Validasi otomatis debit-kredit
- Nomor bukti transaksi
- Support multiple account per transaksi

### 3. **Laporan Keuangan**

#### 📋 Jurnal Umum
- Pencatatan kronologis semua transaksi
- Filter berdasarkan periode
- Export ke Excel/PDF

#### 📖 Buku Besar
- Detail mutasi per akun
- Perhitungan saldo running
- Filter per akun atau semua akun

#### ⚖️ Neraca Saldo
- Trial balance
- Validasi keseimbangan debit-kredit
- Per tanggal tertentu

#### 💰 Laporan Laba Rugi
- Income Statement
- Total pendapatan dan beban
- Perhitungan laba/rugi bersih

#### 🏢 Neraca
- Balance Sheet
- Posisi Aset, Kewajiban, dan Modal
- Persamaan akuntansi otomatis

#### 💵 Laporan Arus Kas
- Cash Flow Statement
- Arus kas operasi, investasi, dan pendanaan
- Rekonsiliasi saldo kas

### 4. **Perpajakan**

#### 📋 PPh Pasal 21
- Pajak Penghasilan Karyawan
- Perhitungan otomatis dari beban gaji
- Tarif 5%

#### 📋 PPh Pasal 23
- Pajak atas Jasa
- Withholding tax 2%
- Detail pemotongan

#### 📋 PPN (Pajak Pertambahan Nilai)
- Tarif 11%
- PPN Keluaran dan Masukan
- Perhitungan PPN terutang

### 5. **SPT Tahunan PPh Badan** ⭐ NEW!

#### 📄 Identitas Wajib Pajak
- Input NPWP, Nama, Alamat
- Jenis usaha

#### 💰 Perhitungan Lengkap
- Peredaran usaha & HPP
- Laba bruto dan laba usaha
- Laba sebelum pajak (komersial)
- Koreksi fiskal positif & negatif
- Penghasilan Neto Fiskal
- Penghasilan Kena Pajak (PKP)
- PPh Terutang dengan tarif 22% atau fasilitas 11%
- Kredit pajak
- PPh Kurang/Lebih Bayar

#### 📋 Lampiran SPT
- **Lampiran 1A**: Peredaran Usaha & Biaya (detail pendapatan & beban)
- **Lampiran 1B**: Daftar Penyusutan & Amortisasi Fiskal
- **Kredit Pajak**: PPh Pasal 22, 23, 25

#### ⚡ Fasilitas Otomatis
- Deteksi fasilitas tarif 50% untuk omzet ≤ Rp 4,8 M
- Perhitungan koreksi fiskal otomatis
- Status pembayaran (Kurang Bayar/Lebih Bayar/Nihil)
- Panduan batas waktu pelaporan

### 6. **Master Data Akun**
- Chart of Accounts (COA) lengkap
- Kelompok: Aset, Kewajiban, Modal, Pendapatan, Beban
- CRUD akun (Create, Read, Update, Delete)
- Default 40+ akun standar

## 🚀 Cara Menggunakan

### Instalasi
1. Download semua file
2. Simpan dalam satu folder
3. Buka `index.html` di browser

**Tidak perlu instalasi server atau database!** Aplikasi berjalan 100% di browser dengan localStorage.

### Memulai

#### 1. Input Transaksi
- Pilih tab **"Transaksi"**
- Isi tanggal dan keterangan
- Pilih akun dan masukkan nilai debit/kredit
- Pastikan total debit = total kredit
- Klik **"Simpan Transaksi"**

#### 2. Melihat Laporan
- Pilih tab laporan yang diinginkan
- Gunakan tombol **"Cetak"** untuk print
- Gunakan **"Export Excel"** untuk ekspor

#### 3. Menambah Akun
- Pilih tab **"Master Akun"**
- Isi kode, nama, dan kelompok akun
- Klik **"Simpan Akun"**

## 📊 Contoh Transaksi

### Contoh 1: Setoran Modal Awal
```
Tanggal: 01/01/2026
Keterangan: Setoran modal awal usaha

Debit:  Kas (1-1000)              Rp 100.000.000
Kredit: Modal Pemilik (3-1000)    Rp 100.000.000
```

### Contoh 2: Pembelian Peralatan
```
Tanggal: 05/01/2026
Keterangan: Pembelian peralatan kantor

Debit:  Peralatan (1-2000)        Rp 15.000.000
Kredit: Kas (1-1000)              Rp 15.000.000
```

### Contoh 3: Pendapatan Jasa
```
Tanggal: 10/01/2026
Keterangan: Pendapatan jasa konsultasi

Debit:  Kas (1-1000)              Rp 25.000.000
Kredit: Pendapatan Jasa (4-1100)  Rp 25.000.000
```

### Contoh 4: Pembayaran Gaji
```
Tanggal: 25/01/2026
Keterangan: Pembayaran gaji karyawan bulan Januari

Debit:  Beban Gaji (5-1000)       Rp 10.000.000
Kredit: Kas (1-1000)              Rp 10.000.000
```

## 📝 Cara Mengisi SPT Tahunan

### Langkah 1: Input Identitas Wajib Pajak
1. Buka tab **"SPT Tahunan"**
2. Isi NPWP (format: 00.000.000.0-000.000)
3. Isi Nama Perusahaan
4. Isi Alamat dan Jenis Usaha
5. Klik **"Simpan Identitas"**

### Langkah 2: Sistem Menghitung Otomatis
Aplikasi akan menghitung:
- Penghasilan Neto Fiskal
- Koreksi Fiskal
- Penghasilan Kena Pajak (PKP)
- PPh Terutang (dengan fasilitas otomatis)
- Kredit Pajak
- Status: Kurang Bayar/Lebih Bayar/Nihil

### Langkah 3: Review Lampiran
- Periksa **Lampiran 1A** (detail pendapatan & biaya)
- Periksa **Lampiran 1B** (penyusutan aset)
- Periksa **Kredit Pajak**

### Langkah 4: Cetak & Lapor
1. Klik **"Cetak SPT"** untuk print
2. Klik **"Export Excel"** untuk backup
3. Gunakan data ini untuk mengisi e-Filing DJP

## 🏗️ Struktur Akun Default

### ASET (1-xxxx)
- 1-1000: Kas
- 1-1100: Bank
- 1-1200: Piutang Usaha
- 1-1300: Persediaan Barang
- 1-2000: Peralatan
- 1-2200: Gedung
- 1-2400: Kendaraan

### KEWAJIBAN (2-xxxx)
- 2-1000: Hutang Usaha
- 2-1100: Hutang Gaji
- 2-1200: Hutang Pajak PPh 21
- 2-1300: Hutang Pajak PPh 23
- 2-1400: Hutang PPN

### MODAL (3-xxxx)
- 3-1000: Modal Pemilik
- 3-2000: Prive
- 3-3000: Laba Ditahan

### PENDAPATAN (4-xxxx)
- 4-1000: Pendapatan Penjualan
- 4-1100: Pendapatan Jasa
- 4-2000: Pendapatan Lain-lain

### BEBAN (5-xxxx)
- 5-1000: Beban Gaji
- 5-1100: Beban Listrik
- 5-1200: Beban Air
- 5-1400: Beban Sewa
- 5-1600: Beban Penyusutan
- 5-2100: Beban Pajak
- 5-2200: Beban Bunga

## 💡 Tips & Trik

1. **Backup Data**: Export laporan secara berkala sebagai backup
2. **Konsistensi Kode Akun**: Gunakan pola kode yang konsisten
3. **Nomor Bukti**: Gunakan sistem penomoran yang teratur (contoh: BKM-001, BKK-001)
4. **Cek Neraca Saldo**: Selalu pastikan debit = kredit di neraca saldo
5. **Review Bulanan**: Cek laporan laba rugi dan neraca setiap bulan
6. **SPT Tahunan**: Isi identitas WP di awal tahun untuk perhitungan pajak yang akurat
7. **Koreksi Fiskal**: Perhatikan koreksi fiskal untuk perhitungan PPh yang benar
8. **Fasilitas Pajak**: Manfaatkan fasilitas tarif 11% jika omzet ≤ Rp 4,8 M

## 📊 Ketentuan Perpajakan

### Tarif PPh Badan
- **Tarif Normal**: 22% (berlaku sejak 2022 berdasarkan UU HPP)
- **Fasilitas Tarif**: 11% (50% x 22%) untuk WP dengan omzet ≤ Rp 4,8 Miliar

### Batas Waktu
- **Pelaporan SPT**: Paling lambat 30 April tahun berikutnya
- **Pembayaran**: Paling lambat 30 April (jika kurang bayar)

### Koreksi Fiskal
**Positif (menambah penghasilan):**
- Biaya tidak ada bukti
- Biaya untuk kepentingan pribadi
- Sanksi pajak
- Penyusutan komersial > fiskal

**Negatif (mengurangi penghasilan):**
- Penghasilan yang sudah kena PPh Final
- Penyusutan fiskal > komersial

### Kredit Pajak
Yang dapat diperhitungkan:
- PPh Pasal 22 (pemungutan)
- PPh Pasal 23 (pemotongan)
- PPh Pasal 25 (angsuran bulanan)

## 🔧 Teknologi

- **HTML5**: Struktur aplikasi
- **CSS3**: Styling modern dan responsive
- **JavaScript (Vanilla)**: Logic dan perhitungan
- **LocalStorage**: Penyimpanan data lokal
- **No Dependencies**: Tidak memerlukan library eksternal

## 📱 Mobile-Friendly & Responsive

Aplikasi **100% responsive** dan dioptimalkan untuk semua device:

### 📱 **Smartphone (iOS & Android)**
- ✅ Hamburger menu navigation
- ✅ Touch-optimized buttons (44px minimum)
- ✅ Single column layout
- ✅ Swipe-able tables
- ✅ Full-width forms
- ✅ PWA-ready (bisa ditambahkan ke home screen)
- ✅ No zoom on input (font-size optimized)

### 📱 **Tablet**
- ✅ 2-column grid layout
- ✅ Touch & stylus support
- ✅ Portrait & landscape mode

### 💻 **Desktop**
- ✅ Multi-column dashboard
- ✅ Mouse-optimized interactions
- ✅ Wide-screen support

**Tested on:**
- iPhone Safari, Android Chrome
- iPad, Android Tablets
- Windows, Mac, Linux

## 🎨 Fitur UI/UX

- ✨ Design modern dan elegant
- 🎨 Color-coded untuk kemudahan identifikasi
- 📊 Dashboard interaktif
- 🖨️ Print-friendly reports
- ⚡ Fast & responsive
- 🔍 Easy navigation

## ⚠️ Catatan Penting

### Perpajakan
Perhitungan pajak dalam aplikasi ini adalah **simulasi untuk pembelajaran**. Untuk perhitungan pajak aktual dan pelaporan resmi:
- Konsultasikan dengan konsultan pajak
- Gunakan aplikasi e-Filing resmi DJP
- Ikuti peraturan perpajakan yang berlaku

### Keamanan Data
- Data disimpan di localStorage browser
- Tidak ada sinkronisasi cloud
- Backup manual diperlukan
- Jangan gunakan untuk data sensitif tanpa enkripsi

## 🎯 Fitur SPT Tahunan yang Tersedia

✅ **Perhitungan Lengkap**
- Peredaran usaha & HPP
- Laba bruto, usaha, dan sebelum pajak
- Koreksi fiskal positif & negatif
- Penghasilan Kena Pajak (PKP)
- PPh Terutang (otomatis deteksi fasilitas)
- Kredit pajak & status pembayaran

✅ **Lampiran Resmi**
- Lampiran 1A: Peredaran Usaha & Biaya
- Lampiran 1B: Penyusutan & Amortisasi Fiskal
- Detail Kredit Pajak

✅ **Fitur Tambahan**
- Deteksi fasilitas tarif otomatis
- Panduan batas waktu & cara bayar
- Status kurang bayar/lebih bayar/nihil
- Print-ready format

## 📈 Roadmap

Pengembangan selanjutnya:
- [x] SPT Tahunan PPh Badan ✅
- [ ] SPT Masa PPN
- [ ] Bukti Potong PPh 21 & 23
- [ ] Export to Excel (real)
- [ ] Import data dari Excel
- [ ] Multi-currency support
- [ ] Budget vs Actual
- [ ] Inventory management
- [ ] Customer & Supplier management
- [ ] Invoice generator
- [ ] Backup & Restore otomatis
- [ ] User authentication
- [ ] Cloud sync
- [ ] E-Filing integration

## 📄 Lisensi

Free to use untuk pembelajaran dan penggunaan pribadi.

## 👨‍💻 Support

Untuk pertanyaan dan dukungan:
- Review kode sumber di `app.js`
- Modifikasi sesuai kebutuhan
- Tambahkan fitur custom

## 🎓 Cocok Untuk

- ✅ Mahasiswa akuntansi
- ✅ UMKM & startup
- ✅ Freelancer
- ✅ Pembelajaran sistem akuntansi
- ✅ Prototype aplikasi keuangan
- ✅ Personal finance management

---

**Dibuat dengan ❤️ untuk memudahkan pengelolaan keuangan**

Selamat menggunakan Sistem Akuntansi & Perpajakan 2026! 🎉
