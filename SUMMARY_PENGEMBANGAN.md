# Project.md — Fin-Samudera: Fitur Rekapan & Peningkatan Cek Pengajuan Super Admin

## 1. Latar Belakang

Saat ini laporan pencapaian KPI Biaya Ops GA (contoh: "Detil Data & Informasi Pencapaian KPI Juli 2026 — Biaya Ops GA") masih dibuat manual/terpisah dari sistem — berisi rekap bulanan per Unit Bisnis untuk kategori ATK, RTK, BBM, dst.

Dibutuhkan versi **live** dari laporan ini di dalam aplikasi: menu baru "Rekapan" yang otomatis terisi dari setiap pengajuan (BS, Reimbursement BBM/Operasional/Umum) yang sudah melalui sistem — tanpa rekap manual lagi. Selain itu, halaman Cek Pengajuan Super Admin (BS/RBS/LPJ) juga perlu ditingkatkan agar bisa menampilkan semua status sekaligus dan mendukung pencarian by nama/unit bisnis.

Dokumen ini berisi delapan bagian:
- **Bagian A** — Menu Rekapan Unit Bisnis (bagian 2–10)
- **Bagian B** — Peningkatan Laporan/Cek Pengajuan Super Admin (bagian 11–12)
- **Bagian C** — Perbaikan Bug Kritis: Duplikasi Nomor BS & Kode Unit Bisnis Hilang di RBS (bagian 13)
- **Bagian D** — Audit Kode Menyeluruh & Perbaikan Tambahan, 2026-09-01 (bagian 14)
- **Bagian E** — Plat No Kendaraan, Kategori BBM di RBS/LPJ, & Perluasan Rekapan BBM, 2026-09-01 (bagian 15)
- **Bagian F** — Filter Checkbox Rekapan, Aksi Cetak/Transferred Reimbursement, Reported BS, & Deploy Produksi, 2026-09-01 (bagian 16)
- **Bagian G** — Perbaikan Bug Kritis: Reject RBS/LPJ Silent Fail untuk Reviewer1/Reviewer2, 2026-09-01 (bagian 17)
- **Bagian H** — Audit & Pengetatan Firestore Rules, Verifikasi Edit/Hapus Super Admin, 2026-09-01 (bagian 18)

## 1.1 Struktur Folder Project

Stack: React (CRA) + Firebase (Firestore, Functions, Hosting, Storage). Berikut struktur source code aktual (di luar `node_modules`, `build`, `.git`):

```
Fin-Samudera/
├── .env
├── .firebaserc
├── firebase.json
├── firestore.rules              # 273 baris — rules Firestore (termasuk isElevatedRole())
├── storage.rules
├── tailwind.config.js
├── package.json
│
├── functions/                   # Cloud Functions (Node.js)
│   ├── index.js                 # 1305 baris — seluruh Cloud Functions project ini
│   └── package.json
│
├── public/
│   ├── index.html
│   └── logo-tanpa-tulisan.png
│
└── src/
    ├── App.jsx                  # 170 baris — routing utama aplikasi
    ├── firebaseConfig.js
    ├── index.js / index.css
    │
    ├── assets/
    │   ├── fonts/                (Optima, Poppins — dipakai util PDF)
    │   └── images/
    │
    ├── context/
    │   └── ThemeContext.jsx
    │
    ├── hooks/
    │   └── useFormDraft.js
    │
    ├── components/               # komponen inti (form, tabel, modal, chart)
    │   ├── FormBs.jsx                    # 893 baris  — Form BS (Bon Sementara)
    │   ├── FormRbsBbm.jsx                # 1002 baris — Form RBS BBM
    │   ├── FormRbsUmum.jsx               # 987 baris  — Form RBS Umum
    │   ├── FormRbsOperasional.jsx        # 990 baris  — Form RBS Operasional
    │   ├── FormLpjUmum.jsx
    │   ├── FormLpjMarketing.jsx
    │   ├── FormAddUser.jsx / FormEditUser.jsx
    │   ├── BsCheck.jsx                   # 1088 baris — Cek Pengajuan BS (termasuk tab Super Admin)
    │   ├── ReimbursementCheck.jsx        # 1159 baris — Cek Pengajuan RBS (termasuk tab Super Admin)
    │   ├── LpjBsCheck.jsx                # 1196 baris — Cek Pengajuan LPJ (termasuk tab Super Admin)
    │   ├── BsTable.jsx / ReimbursementTable.jsx / LpjBsTable.jsx
    │   ├── DetailBs.jsx / DetailRbs.jsx / DetailLpj.jsx
    │   ├── DashboardSummary.jsx
    │   ├── GAUBarChart.jsx / GAUComparisonBarChart.jsx / GAUPieChart.jsx
    │   ├── ReportCard.jsx / ReportExport.jsx
    │   ├── ManageUser.jsx
    │   ├── Navbar.jsx / Sidebar.jsx / sidebarWrapper.jsx
    │   ├── Modal.jsx / ModalPDF.jsx
    │   ├── BankUpdateModal.jsx / DefaultBankModal.jsx / PasswordChangeModal.jsx
    │   ├── AnnouncementPopup.jsx
    │   ├── BSAlerts.jsx / bsTimerDisplay.jsx
    │   ├── Login.jsx
    │   ├── SessionTimeoutHandler.js
    │   ├── protectedRoute.jsx
    │   └── routesConfig.jsx
    │
    ├── pages/                    # wrapper halaman (route-level) di atas components/
    │   ├── Dashboard.jsx
    │   ├── BsPage.jsx / BsCheckPage.jsx / DetailBsPage.jsx
    │   ├── RbsUmum.jsx / RbsOperasional.jsx / RbsBbm.jsx / RbsCheckPage.jsx / DetailRbsPage.jsx
    │   ├── LpjUmum.jsx / LpjMarketing.jsx / LpjCheckPage.jsx / DetailLpjPage.jsx
    │   ├── ManageUserPage.jsx / AddUserPage.jsx / EditUserPage.jsx
    │   ├── AnnouncementManager.jsx / AnnouncementManagerPage.jsx
    │   ├── ReportExportPage.jsx
    │   ├── LoginPage.jsx / Layout.jsx / NotFoundPage.jsx
    │
    └── utils/
        ├── BsPdf.jsx / ReimbursementPdf.jsx / LpjPdf.jsx   # generator PDF
        └── uploadPdfFile.js
```

**Catatan relevan untuk rencana pengembangan di dokumen ini:**
- Bagian A (Rekapan) → komponen baru akan masuk ke `src/components/RekapanUnitBisnis.jsx` + `src/pages/RekapanPage.jsx`, route baru didaftarkan di `App.jsx` (170 baris, cukup ringkas untuk ditambah 1 route + role guard).
- Bagian B (Cek Pengajuan Super Admin) → menyentuh 3 file besar: `BsCheck.jsx` (1088 baris), `ReimbursementCheck.jsx` (1159 baris), `LpjBsCheck.jsx` (1196 baris) — masing-masing punya bagian khusus tab Super Admin yang perlu di-refactor.
- Bagian C (bug BS/RBS) → menyentuh `FormBs.jsx`, `FormRbsUmum.jsx`, `FormRbsOperasional.jsx`, dan (untuk field Liter di Bagian A) `FormRbsBbm.jsx` — keempatnya punya `UNIT_CODES`/`BUSINESS_UNIT_CODES` sendiri-sendiri, cocok dengan temuan di bagian 13.5.
- Semua Cloud Function project ini ada dalam **satu file** `functions/index.js` (1305 baris) — kalau Bagian A memilih pendekatan agregasi server-side (Opsi B di bagian 7), trigger baru akan ditambahkan di file ini.
- `firestore.rules` (273 baris) sudah berisi `isElevatedRole()` yang dipakai sebagai basis rules di seluruh dokumen ini.

---

# BAGIAN A — Menu Rekapan Unit Bisnis

## 2. Tujuan Fitur

Menampilkan rekapan biaya per Unit Bisnis, per bulan, per kategori (BBM, Meeting, Entertainment, Meal Meeting, dan kategori GA/Umum lain), dengan detail tambahan khusus BBM (liter pemakaian per plat per bulan) — dan rekap ini **update otomatis** setiap ada pengajuan baru, tanpa proses manual.

## 3. Pengguna & Akses

| Role | Akses ke menu Rekapan |
|---|---|
| Employee | Tidak ada |
| Validator | Ya — hanya Unit Bisnis tempat dia jadi Validator |
| Reviewer | Tidak ada |
| Admin / Super Admin | **Ya — dan justru ini use case utamanya** (lihat catatan di bawah) |

> **Catatan penting soal prioritas:** meski awalnya diminta sebagai menu untuk Validator, kebutuhan intinya justru untuk **Admin/GA** — dipakai untuk screenshot tabel rekap sebagai bahan laporan PPT bulanan (menggantikan proses rekap manual yang selama ini dibuat terpisah, seperti contoh gambar KPI Juli 2026 yang dikirim). Ini berarti:
> - Admin harus bisa melihat rekap untuk **SEMUA Unit Bisnis sekaligus** (bukan cuma UB yang jadi tanggung jawabnya), lewat dropdown UB yang sama.
> - **Tampilan tabel harus benar-benar rapi & siap-screenshot** — layout, warna header, dan struktur kolom (bulan Jan–Des + Total) sebaiknya semirip mungkin dengan format PPT existing yang dikirim, supaya Admin tinggal screenshot tanpa perlu edit lagi di PPT.
> - Prioritas desain: kerapian visual untuk kebutuhan dokumentasi/pelaporan, bukan cuma fungsi lihat data.

- Kalau Validator ditugaskan di **lebih dari satu Unit Bisnis**, tampilkan **dropdown pilihan UB** di halaman ini. Sumber daftar UB: field `unit`/`validator` pada dokumen `users/{uid}` milik Validator yang login.
- Kalau hanya 1 UB, dropdown tetap ditampilkan tapi terisi otomatis (konsisten dengan role yang punya banyak UB).

## 4. Struktur Data yang Sudah Ada (dipakai sebagai sumber rekap)

| Koleksi | Field relevan untuk rekap |
|---|---|
| `reimbursement` (RBS Umum & Operasional) | `user.unit`, `status`, `reimbursements[].jenisReimbursement` (`Entertaint`, `Meals Meeting`, dll), `reimbursements[].biaya`, `reimbursements[].tanggalAktivitas` |
| `reimbursement` (RBS BBM) | `user.unit`, `status`, `reimbursements[].plat`, `reimbursements[].biaya`, `reimbursements[].tanggalAktivitas` |
| `bonSementara` | `user.unit`, `status`, `kategori`, `jumlahBS`, `tanggalPengajuan` |
| `lpj` | Dipakai kalau rekap ingin berbasis "sudah di-LPJ-kan", bukan cuma "diajukan" |

**Catatan:** field `jenisReimbursement` untuk kategori Meeting/Entertainment sudah ada di form RBS Umum (`Entertaint`, `Meals Meeting`) — kategori-kategori itu **sudah bisa direkap tanpa perubahan form**.

## 5. Kebutuhan Data Tambahan (gap yang perlu ditambahkan ke form)

- **Field "Liter" belum ada di `FormRbsBbm.jsx`.** Form BBM saat ini hanya menyimpan `plat` dan `biaya` (Rupiah) — TIDAK menyimpan jumlah liter. Untuk menampilkan "berapa liter pemakaian setiap bulan" per plat, field **Liter** wajib ditambahkan ke form BBM (input number, disimpan sejajar `biaya` dan `plat` di setiap baris `reimbursements[]`). Hanya berlaku pengajuan baru, tanpa backfill data lama.
- **Rekap berdasarkan `tanggalAktivitas`** (keputusan final, lihat bagian 9).
- **Hanya status `Disetujui` (final) yang dihitung ke rekap** (keputusan final, lihat bagian 9) — rekap baru terisi setelah pengajuan full-approved, bukan real-time sejak submit.

## 6. Desain Halaman / Menu Baru

**Nama menu:** "Rekapan" — muncul khusus untuk role Validator/Admin/Super Admin (Reviewer tidak diberi akses)

**Struktur halaman:**
1. Dropdown **Unit Bisnis** (Admin: semua UB; Validator: UB penempatannya saja)
2. Dropdown **Tahun** (default: tahun berjalan)
3. Tabel per kategori, format serupa contoh gambar yang dikirim, dengan tambahan:
   - **BBM**: bukan cuma total Rupiah per bulan, tapi **drill-down per Plat Nomor** → baris tambahan menampilkan liter per bulan per plat
   - **Meeting** (Meals Meeting)
   - **Entertainment** (Entertaint)
   - Kategori GA/Umum lain sesuai `jenisReimbursement`: `ATK` sudah ada, `RTK` perlu ditambahkan sebagai opsi baru (lihat Open Question #3 di bagian 9 — `RTG` yang sudah ada BUKAN `RTK`, keduanya kategori berbeda)
4. Kolom bulan Januari–Desember + kolom **Total**, sama seperti contoh gambar.

**Kebutuhan khusus untuk screenshot/PPT (Admin/GA):**
- Header tabel warna merah solid (sesuai brand & contoh gambar), teks bulan putih, rata tengah.
- Baris per Unit Bisnis, kolom bulan rapi, angka rata kanan format ribuan (mis. `1,020,000`), tanpa simbol "Rp" berulang tiap sel.
- Setiap kategori sebagai tabel terpisah dengan judul kategori di baris header merah, sama seperti pemisahan "ATK / RTK / BBM" di contoh gambar.
- Pertimbangkan tombol **"Download sebagai PNG"** per tabel kategori (pakai `html2canvas`) supaya Admin tidak perlu screenshot manual.
- Kolom bulan yang belum lewat tetap ditampilkan kosong/placeholder (bukan dihilangkan) — supaya struktur tabel identik dengan template PPT yang sudah ada.

## 7. Logika Agregasi ("terposting otomatis")

**A. Agregasi di sisi client (query + hitung manual saat halaman dibuka)**
- Query dokumen `reimbursement`/`bonSementara` untuk UB & tahun terpilih, jumlahkan di JavaScript per bulan/kategori/plat.
- ✅ Simpel, tidak perlu Cloud Function. ❌ Bisa lambat kalau data sudah ribuan dokumen — tapi rules `list` (`isElevatedRole()`) sudah mendukung query broad ini, **tidak perlu ubah rules**.

**B. Agregasi di sisi server (Cloud Function → koleksi ringkasan `rekapUnitBisnis/{unit}_{tahun}`)**
- Trigger `onCreate`/`onUpdate` di `reimbursement`/`bonSementara` → update angka rekap otomatis.
- ✅ Halaman rekap tinggal baca 1 dokumen kecil — cepat & skalabel. ❌ Effort tambahan bikin & pasang Cloud Function.

**Keputusan (2026-09-01):** pakai pendekatan A (client-side) untuk MVP, optimasi ke B kalau data membesar dan halaman terasa lambat.

## 8. Firestore Rules Tambahan

Rules `/reimbursement` dan `/bonSementara` sudah mendukung `list` untuk Validator/Admin lewat `isElevatedRole()` — pendekatan A **tidak perlu rule baru**.

Kalau pakai pendekatan B, tambahan match block:
```
match /rekapUnitBisnis/{docId} {
  allow read: if isElevatedRole();
  allow write: if false; // hanya lewat Cloud Function (Admin SDK, bypass rules)
}
```

## 9. Open Questions — Bagian A (SUDAH DIPUTUSKAN, 2026-09-01)

1. **Status pengajuan yang dihitung** — **Hanya `Disetujui` (final).** Rekap mencerminkan angka yang sudah final/disetujui, sesuai kebutuhan laporan resmi ke manajemen.
2. **Basis tanggal rekap** — **`tanggalAktivitas`** (tanggal kejadian biaya sebenarnya, bukan tanggal submit).
3. **Kategori ATK & RTK** — dicek langsung ke kode: `ATK` **sudah ada** di `jenisOptions` (`FormRbsUmum.jsx`), tapi yang ada bukan `RTK` melainkan **`RTG`** — dan sudah dikonfirmasi **RTG ≠ RTK, kategori berbeda**. Jadi perlu **opsi kategori baru `RTK`** ditambahkan ke `jenisOptions` `FormRbsUmum.jsx` (terpisah dari `RTG` yang sudah ada). Catatan tambahan: `FormRbsOperasional.jsx` sama sekali tidak punya kategori ATK/RTG/RTK — kategori GA/Umum ini hanya masuk lewat RBS Umum.
4. **Role Reviewer** — **Tidak diberi akses.** Menu Rekapan khusus Validator, Admin, dan Super Admin.
5. **Field Liter BBM** — **Cukup untuk pengajuan baru ke depan.** Tidak perlu backfill manual data BBM lama; rekap liter untuk bulan-bulan sebelum fitur ini live akan kosong/tidak lengkap (hanya kolom Rupiah yang lengkap untuk data lama).
6. **Pendekatan agregasi** — **Client-side** (sesuai rekomendasi MVP di bagian 7 Opsi A).

## 10. Ringkasan Task Development — Bagian A

**Status: SELESAI DIIMPLEMENTASIKAN (2026-09-01)**, kecuali item yang ditandai opsional/di luar scope. Riset kode saat implementasi (lihat rencana pengembangan di sesi ini) menemukan bahwa breakdown per kategori (ATK/RTK/dst) cuma bisa akurat dari `reimbursement` — `bonSementara` (BS) cuma punya kategori kasar dan `lpj` punya field nama item yang tadinya teks bebas. Keputusan final: sertakan `reimbursement` + `lpj` (BS tidak ikut breakdown per kategori), dengan syarat form LPJ diubah dulu jadi dropdown kategori (lihat item baru di bawah).

- [x] Tambah field **Liter** ke `FormRbsBbm.jsx` (input + validasi + simpan ke `reimbursements[].liter`, termasuk alur edit) — hanya berlaku pengajuan baru, tanpa backfill data lama. Kolom Liter juga ditambahkan ke tabel detail (`DetailRbs.jsx`).
- [x] Tambah opsi kategori **`RTK`** (baru, terpisah dari `RTG`) ke `jenisOptions` di `FormRbsUmum.jsx`
- [x] **(Tambahan di luar rencana awal)** Ubah field `namaItem` di `FormLpjUmum.jsx` & `FormLpjMarketing.jsx` dari input teks bebas jadi dropdown kategori (mengikuti `jenisOptions` RBS Umum/Operasional masing-masing + fallback "Lainnya"), supaya LPJ bisa direkap per kategori. Data LPJ lama yang masih teks bebas otomatis dipetakan ke mode "Lainnya" saat diedit (tidak hilang, tapi tetap tidak akurat direkap sampai dibetulkan manual).
- [x] Buat util agregasi baru `src/utils/rekapanAggregation.js` (fungsi murni: `aggregateByCategory`, `aggregateBbm`, dll)
- [x] Buat komponen halaman baru `RekapanPage.jsx` + route `/rekapan` di `App.jsx` (role: **Validator, Admin, Super Admin** — Reviewer TIDAK termasuk)
- [x] Buat komponen `RekapanUnitBisnis.jsx`: dropdown UB (Admin/Super Admin dapat opsi "Semua Unit Bisnis") + tahun, tabel kategori per bulan, drill-down BBM per plat (liter & Rupiah)
- [x] Implementasi agregasi **client-side**: query `reimbursement`/`lpj` dengan `status == 'Disetujui'` (satu kali fetch, filter unit/tahun di client — pola sama seperti `ReportExport.jsx`)
- [x] Tambah item menu "Rekapan" di sidebar, tampil kondisional sesuai role (Validator/Admin/Super Admin)
- [x] Styling tabel rekap mengikuti brand (header merah `#ED1C24`, grid rapi, scroll horizontal di layar sempit)
- [ ] (Opsional, belum dikerjakan) Tombol export tabel ke PNG per kategori — `html2canvas` belum ter-install, perlu keputusan dependency baru terpisah

**Verifikasi yang sudah dilakukan:** `CI=true npm run build` sukses (0 warning/error). Smoke-test manual di browser (role di-spoof lewat `localStorage` untuk melewati gate client-side `ProtectedRoute`, memakai akun dev yang sebenarnya tidak elevated) mengonfirmasi: route `/rekapan` accessible, dropdown Unit Bisnis & Tahun terisi dari data Firestore user login, query `reimbursement`/`lpj` yang ditolak Firestore Rules (`permission-denied`, karena akun tes tidak elevated) ditangani dengan baik oleh `try/catch` — tampil pesan "Belum ada data" alih-alih crash, tabel header merah render sesuai brand dengan scroll horizontal yang benar.

**Belum diverifikasi (perlu dicek user langsung dengan akun Validator/Admin/Super Admin sungguhan):** angka rekap yang benar-benar terisi dari data `Disetujui` asli, karena tidak ada kredensial role elevated yang tersedia untuk pengujian otomatis.
- [ ] (Kalau pendekatan B) Tambah rules Firestore untuk koleksi rekap baru

---

# BAGIAN B — Peningkatan Laporan/Cek Pengajuan Super Admin

**Status: SELESAI DIIMPLEMENTASIKAN (2026-09-01)**

**Berlaku untuk ketiga modul:** `BsCheck.jsx`, `ReimbursementCheck.jsx` (RBS), `LpjBsCheck.jsx`.

**Koreksi premis dari riset kode saat implementasi:** tidak ada "tab khusus Super Admin" yang terpisah — ketiga file memakai tab yang SAMA (`Perlu Ditanggapi`/`Riwayat Persetujuan`/`Pengajuan Dibatalkan`) untuk semua role, cuma **query di baliknya** yang beda per role. Perubahan "semua status sekaligus" di bawah ini **khusus berlaku untuk role Super Admin** (keputusan user) — Reviewer/Validator/Admin tetap pakai 3 tab seperti sebelumnya, karena workflow mereka memang berbasis "apa yang perlu saya proses", bukan audit/overview.

## 11. Tampilkan Semua Status Sekaligus + Pencarian Nama/Unit Bisnis

### 11.1 Semua Status dalam Satu Tampilan

Saat ini tab Super Admin di ketiga file memisahkan data lewat beberapa query berbeda per status (mis. `pendingQ` untuk `Diajukan/Diproses`, `approvedQ` untuk `Diproses/Disetujui`, `canceledQ` untuk status batal). Permintaan baru: Super Admin bisa lihat **SEMUA status sekaligus** — `Diajukan`, `Diproses`/`Divalidasi`, `Disetujui`, `Ditolak`, `Dibatalkan`, dan status lain yang ada — tanpa pindah-pindah tab.

- Ganti pendekatan filter-per-tab dengan **satu tabel utuh** (atau tab "Semua Status" sebagai default), dengan kolom **Status** berbadge warna (biru=Diajukan, ungu=Divalidasi, hijau=Disetujui, dst. — sama seperti tabel dashboard yang sudah ada) supaya tetap mudah dibedakan meski tergabung.
- Query dasar cukup `where('status', 'in', [...semua status valid...])` — rules `list` Super Admin (`isElevatedRole()`) sudah mendukung ini, **tidak perlu perubahan rules**.
- Filter status tetap disediakan sebagai **dropdown filter tambahan** (bukan tab terpisah), default menampilkan semua.

### 11.2 Kolom "Nama" & Pencarian Nama/Unit Bisnis/Nomor Dokumen

**Koreksi premis dari riset kode:** kolom **Nama sudah ada** di ketiga tabel sebelum sesi ini (`item.user.nama`, sudah didenormalisasi langsung ke tiap dokumen sejak awal oleh form-form pengajuan) — jadi seluruh diskusi "Opsi A vs Opsi B" (lookup `users` vs denormalisasi) di bawah ini **tidak relevan/tidak diperlukan**, sudah otomatis terpenuhi. Yang benar-benar dikerjakan cuma search box-nya.

- [x] Search box (satu `<input>` teks) di atas tabel unified Super Admin: mencari substring case-insensitive ke **Nama, Unit Bisnis, DAN Nomor Dokumen** sekaligus (keputusan user: cakupan diperluas dari draft awal yang cuma Nama+Unit).

### 11.3 Task Development — Bagian B

- [x] Refactor bagian fetch Super Admin di `BsCheck.jsx`, `ReimbursementCheck.jsx`, `LpjBsCheck.jsx`: ganti 2-3 query per-status jadi **1 query tanpa filter status** (`getDocs(collection(db, '...'))`) — rules `isElevatedRole()` sudah mendukung list broad ini tanpa perubahan. Blok fetch untuk role lain (Reviewer/Validator/Admin) **tidak disentuh**.
- [x] UI: tab pending/approved/canceled diganti 1 tabel + dropdown filter Status (default "Semua Status") + search box, **khusus saat role Super Admin** — komponen baru `SuperAdminAllStatusTable` di masing-masing file.
- [x] Extract helper warna badge status baru `src/utils/statusBadge.js` (`getStatusBadgeClass`), dipakai di tabel unified baru (tabel lama tidak diubah, biar blast radius kecil).
- [x] ~~Tambah fetch `users` + map uid→nama~~ — tidak diperlukan, Nama sudah ada di setiap dokumen.

**Bug tersembunyi yang ikut ketutup:** query Super Admin lama tidak pernah mengambil status `'Ditolak'` (di ketiga file), dan `ReimbursementCheck.jsx`/`LpjBsCheck.jsx` juga tidak pernah mengambil `'Dibatalkan'` untuk Super Admin — dokumen dengan status itu sama sekali tidak terlihat Super Admin di mana pun sebelumnya. Query tunggal baru otomatis mencakup semua status, menutup celah ini.

## 12. Open Questions — Bagian B (SUDAH DIPUTUSKAN, 2026-09-01)

1. ~~Apakah "Nomor Dokumen" tetap jadi acuan utama tabel~~ — **tidak relevan**, Nama sudah ada sebagai kolom terpisah sejak awal (lihat 11.2), Nomor Dokumen tetap kolom pertama seperti sebelumnya.
2. **Pencarian mencakup Nomor Dokumen** — **Ya**, disertakan (lihat 11.2).
3. **Diterapkan ke Dashboard juga?** — **Tidak**, scope tetap 3 halaman Cek Pengajuan saja.

---

# BAGIAN C — Perbaikan Bug Kritis: Duplikasi Nomor BS & Kode Unit Bisnis Hilang di RBS

**Status: SUDAH DIPERBAIKI** (fix sudah diterapkan ke `FormBs.jsx`, `FormRbsUmum.jsx`, `FormRbsOperasional.jsx`). Bagian ini didokumentasikan supaya masuk riwayat project dan jadi acuan kalau bug serupa muncul lagi di modul lain (mis. `FormRbsBbm.jsx`, `FormLpj.jsx`, dll — lihat catatan preventif di 13.5).

## 13.1 Temuan Awal

Dilaporkan oleh user (screenshot tabel Cek Pengajuan Super Admin):
- Dua pengajuan BS berbeda pengaju (Nuzul Wijaya & Reza Rahmat, Unit Bisnis sama: PT Samudera Kendari Logistik) memiliki **nomor dokumen identik**: `BS2608SKEL0000501`.
- Beberapa nomor dokumen RBS GA/Umum menampilkan **nama lengkap unit bisnis**, bukan kode singkatnya — mis. `RBS.GAU.PT Masaji Kargosentra Tama.260827.3201`, seharusnya `RBS.GAU.MKT.260827.xxxx`.

## 13.2 Root Cause #1 — Duplikasi Nomor BS (`FormBs.jsx`)

Nomor BS di-generate di **dua tempat terpisah** dengan logika yang tidak sinkron:

1. **Saat memilih Unit Bisnis** (`handleUnitChange` / `generateNomorBS`) → memanggil `getCurrentCounter()`, yang **hanya membaca** `lastNumber` dari `businessUnitCounters/{unitCode}` dan menampilkan `lastNumber + 1` sebagai *preview*. Fungsi ini **tidak pernah menulis/increment** nilai counter.
2. **Saat submit** (`handleSubmit`) → dokumen `bonSementara` disimpan lebih dulu (`setDoc`) memakai nomor preview di atas, **baru kemudian** counter di-increment lewat `runTransaction` — terpisah dan setelah dokumen tersimpan.

**Akibatnya:** kalau dua user memilih Unit Bisnis yang sama sebelum salah satu dari mereka submit, keduanya membaca `lastNumber` yang sama dan mendapat preview nomor yang identik. Siapa pun yang submit lebih dulu menaikkan counter, tapi nomor yang **sudah tersimpan di dokumen tidak pernah diperbarui ulang** — sehingga submit kedua tetap memakai nomor duplikat tadi, meski counter sebenarnya sudah maju.

## 13.3 Root Cause #2 — Kode Unit Bisnis Hilang di RBS Umum & Operasional

`FormRbsUmum.jsx` dan `FormRbsOperasional.jsx` masing-masing punya map `UNIT_CODES` sendiri (terpisah dari `FormBs.jsx` dan `FormRbsBbm.jsx`), dan **keduanya tidak memiliki entri untuk `'PT Masaji Kargosentra Tama'`**. Fungsi `getUnitCode()` di kedua file punya fallback `UNIT_CODES[unitName] || unitName` — begitu key tidak ditemukan di map, fallback-nya jatuh ke **nama lengkap unit bisnis**, bukan kode singkat. Itu sebabnya nomor dokumen menampilkan nama penuh perusahaan.

Catatan: `FormRbsBbm.jsx` dan `FormBs.jsx` sebenarnya sudah punya entri `MKT` di map masing-masing — jadi bug ini spesifik hanya ada di dua file RBS Umum & Operasional, karena setiap form menyimpan salinan `UNIT_CODES`-nya sendiri-sendiri (tidak ada sumber tunggal/shared constant).

## 13.4 Perbaikan yang Diterapkan

| File | Perbaikan |
|---|---|
| `FormBs.jsx` | Nomor BS final sekarang di-generate **di dalam** `runTransaction` yang sama dengan increment counter dan penulisan dokumen `bonSementara` (bukan dibaca terpisah sebelumnya lalu dipakai apa adanya). Firestore otomatis retry transaksi kalau ada konflik baca-tulis pada counter, sehingga dua submit bersamaan **tidak mungkin lagi mendapat nomor akhir yang sama**. |
| `FormRbsUmum.jsx` | Ditambahkan entri `'PT Masaji Kargosentra Tama': 'MKT'` ke `UNIT_CODES`. |
| `FormRbsOperasional.jsx` | Ditambahkan entri `'PT Masaji Kargosentra Tama': 'MKT'` ke `UNIT_CODES` (bug & fix identik dengan RBS Umum). |

**Catatan teknis (usang — lihat 13.7 untuk update):** Saat temuan ini pertama didokumentasikan, `FormRbsUmum.jsx` dan `FormRbsOperasional.jsx` masih memakai sequence acak 4-digit (`Math.random()`) untuk nomor dokumennya, bukan counter Firestore bersama seperti BS — risiko tabrakannya dinilai kecil (~1/10.000) tapi tetap nyata dan bukan nol. Per 2026-09-01, seluruh form RBS/LPJ (termasuk `FormRbsBbm.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx` yang sebelumnya tidak disebut di temuan ini) sudah dipindahkan ke counter atomik yang sama seperti BS — lihat 13.7.

## 13.5 Dampak ke Data Lama & Rekomendasi Lanjutan

- **28 baris BS yang sudah kadung duplikat** (termasuk kasus Nuzul Wijaya vs Reza Rahmat) **tidak otomatis diperbaiki** oleh fix ini — perlu koreksi manual di Firestore (`bonSementara` collection) kalau nomor dokumennya perlu dibedakan untuk keperluan pelaporan/arsip. **Masih belum dikerjakan** — butuh akses admin Firestore langsung, di luar cakupan perbaikan kode.
- **Rekomendasi struktural (belum dikerjakan, untuk dipertimbangkan):** pindahkan `BUSINESS_UNIT_CODES`/`UNIT_CODES` yang saat ini terduplikasi di 6 file form (`FormBs.jsx`, `FormRbsBbm.jsx`, `FormRbsUmum.jsx`, `FormRbsOperasional.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx`) ke **satu shared constant file** (mis. `src/constants/businessUnits.js`), supaya kalau ada penambahan/perubahan Unit Bisnis di masa depan, cukup diedit di satu tempat dan tidak berisiko lupa update salah satu form seperti yang terjadi di sini.
- ~~Perlu dicek juga: modul lain yang kemungkinan punya pola numbering serupa (LPJ, atau modul lain yang memakai `businessUnitCounters`)~~ — **sudah diaudit & diperbaiki, lihat 13.7**.

## 13.6 Task Development — Bagian C

- [x] Fix race condition nomor BS di `FormBs.jsx` (generate nomor final di dalam transaksi)
- [x] Tambah kode `MKT` yang hilang di `FormRbsUmum.jsx`
- [x] Tambah kode `MKT` yang hilang di `FormRbsOperasional.jsx`
- [ ] Koreksi manual data BS duplikat lama di Firestore (jika diperlukan untuk pelaporan)
- [x] Audit modul LPJ / modul lain yang memakai `businessUnitCounters` untuk bug serupa — lihat 13.7
- [ ] (Opsional, perbaikan struktural) Pindahkan semua `UNIT_CODES`/`BUSINESS_UNIT_CODES` ke satu shared constant file

## 13.7 Update Lanjutan — Migrasi Semua Nomor Dokumen ke Counter Atomik (2026-09-01)

Audit kode menyeluruh (lihat Bagian D) mengonfirmasi kekhawatiran di 13.5: pola random-sequence yang tadinya dianggap "risiko kecil" di `FormRbsUmum.jsx`/`FormRbsOperasional.jsx` ternyata dipakai juga di **3 form lain yang belum disebut di temuan awal** — `FormRbsBbm.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx`. Kelima form ini sekarang sudah dipindahkan ke pola counter atomik `runTransaction` yang sama seperti `FormBs.jsx`, dengan counter terpisah per unit+tipe dokumen (mis. `businessUnitCounters/SMDR_RBS_BBM`) supaya tidak saling mengganggu nomor urut satu sama lain maupun dengan BS.

Sebagai bagian dari perbaikan ini, mode edit di kelima form juga diperbaiki: sebelumnya saat Super Admin mengedit pengajuan lama dan mengunggah lampiran baru, lampiran itu tersimpan di path Storage bernama nomor **acak baru** yang tidak pernah tersimpan sebagai `displayId` dokumen (lampiran jadi "nyasar", tidak konsisten dengan nomor dokumen aslinya). Sekarang mode edit memakai `displayId` asli dari dokumen yang diedit.

Detail teknis & file yang diubah ada di Bagian D (14.2).

---

# BAGIAN D — Audit Kode Menyeluruh & Perbaikan Tambahan (2026-09-01)

Audit menyeluruh atas seluruh codebase (build/lint, Firestore/Storage rules, alur auth, form pengajuan, Cloud Functions) di luar konteks Bagian A/B/C, untuk mencari potensi error yang belum terdokumentasi. Semua temuan di bawah **sudah diperbaiki** dan diverifikasi lewat `CI=true npm run build` (sukses, 0 warning/error) serta `node --check functions/index.js`.

## 14.1 Build Gagal di CI (`CI=true`)

**Temuan:** `react-scripts build` men-treat ESLint warning sebagai error saat `process.env.CI=true` (perilaku default banyak platform CI/CD). Ada 3 unused-var yang bikin build gagal (exit code 1) meski build manual (tanpa `CI=true`) tetap sukses.

**Perbaikan:**
- `FormBs.jsx` — hapus state `currentCounter`/`setCurrentCounter` yang di-set tapi tidak pernah dibaca/dirender.
- `FormRbsOperasional.jsx`, `FormRbsUmum.jsx` — hapus import `addDoc` yang tidak terpakai.

## 14.2 Nomor Dokumen RBS/LPJ Rentan Duplikat

**Temuan:** `FormRbsBbm.jsx`, `FormRbsOperasional.jsx`, `FormRbsUmum.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx` men-generate `displayId` pakai `Math.floor(Math.random() * 10000)`, bukan counter atomik seperti `FormBs.jsx` — lihat 13.7 untuk detail lengkap & alasan ini digabung dengan Bagian C.

## 14.3 Validasi "PDF Only" pada Upload Lampiran Bisa Dilewati

**Temuan:** `uploadPdfFile.js` selalu memaksa metadata `contentType: 'application/pdf'` saat upload ke Storage, apa pun isi file sebenarnya — sehingga Storage Rules (`validPdfUpload()` yang mengecek `contentType`) jadi tidak berarti, karena client sendiri yang menyetel metadata tsb. Satu-satunya penjagaan nyata (`isPdfFile()`) hanya mengecek nama/ekstensi file, gampang dilewati dengan mengganti ekstensi file jadi `.pdf`.

**Perbaikan:** `uploadPdfFile.js` sekarang punya `isValidPdfFile()` (async) yang membaca 5 byte pertama file dan memastikan cocok signature asli PDF (`%PDF-`) sebelum file dianggap valid. Dipakai di kelima form upload lampiran (`FormRbsBbm.jsx`, `FormRbsOperasional.jsx`, `FormRbsUmum.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx`), menggantikan `isPdfFile()` yang cuma cek nama file.

## 14.4 Bug `nextApproverUid` di Cloud Functions — Approval Bisa "Hilang" Diam-diam

**Temuan:** Di `functions/index.js`, `notifyReviewersAndUserRBS` dan `notifyReviewersAndUserLPJ` menginisialisasi `let nextApproverUid = null` lalu mengecek `if (nextApproverUid !== undefined)` di akhir untuk memutuskan apakah `currentApproverUid` perlu di-update. Karena `null !== undefined` selalu `true`, pengecekan ini **selalu lolos** — jadi status apa pun yang tidak cocok persis dengan salah satu string status yang di-hardcode di situ akan diam-diam menge-null-kan `currentApproverUid`, walau approval belum selesai. Efeknya: dokumen jadi tidak muncul lagi di dashboard approver mana pun, perlu intervensi manual. Saat ini belum aktif jadi bug (semua string status di frontend masih cocok), tapi rapuh terhadap perubahan/typo di masa depan pada salah satu sisi (functions vs `ReimbursementCheck.jsx`/`LpjBsCheck.jsx`).

**Perbaikan:** Sentinel diubah jadi `let nextApproverUid;` (tanpa nilai awal) di kedua fungsi, supaya `currentApproverUid` hanya diperbarui kalau ada cabang status yang benar-benar cocok.

## 14.5 Auto-logout Idle Tidak Sign-out dari Firebase Auth

**Temuan:** `SessionTimeoutHandler.js` (auto-logout setelah 60 menit tidak aktif) hanya menghapus `localStorage`, tidak memanggil `signOut(auth)` seperti logout manual di `Navbar.jsx`/`Layout.jsx`. Akibatnya sesi Firebase Auth tetap hidup di browser walau tampilan sudah "logout".

**Perbaikan:** `checkForInactivity` sekarang memanggil `await signOut(auth)` sebelum membersihkan `localStorage` dan redirect, konsisten dengan logout manual.

## 14.6 `reviewer1[0]` Tanpa Optional Chaining di Cloud Functions

**Temuan:** `notifyReviewersAndUserCreateBS` di `functions/index.js` mengakses `newData.user.reviewer1[0]` tanpa `?.` — Firestore Rules tidak mewajibkan field `reviewer1` ada saat create BS, jadi kalau ada dokumen BS tanpa `reviewer1` (mis. data lama/edit manual), trigger notifikasi status akan crash dan email approval untuk dokumen itu tidak pernah terkirim.

**Perbaikan:** Diubah jadi `newData.user.reviewer1?.[0]`.

## 14.7 Task Development — Bagian D

- [x] Fix 3 unused-var yang bikin build gagal di `CI=true`
- [x] Migrasi 5 form RBS/LPJ ke counter atomik untuk `displayId` (detail di 13.7)
- [x] Perkuat validasi PDF dengan pengecekan magic bytes (`isValidPdfFile`)
- [x] Fix bug sentinel `nextApproverUid` di `notifyReviewersAndUserRBS` & `notifyReviewersAndUserLPJ`
- [x] Fix auto-logout idle supaya ikut `signOut` dari Firebase Auth
- [x] Fix akses `reviewer1[0]` tanpa optional chaining di `notifyReviewersAndUserCreateBS`

---

# BAGIAN E — Plat No Kendaraan, Kategori BBM di RBS/LPJ, & Perluasan Rekapan BBM (2026-09-01)

**Status: SELESAI DIIMPLEMENTASIKAN**, kecuali item yang ditandai belum diverifikasi (butuh login sungguhan, lihat 15.8).

## 15.1 Latar Belakang

Permintaan awal: tambahkan field **Plat No Kendaraan** di Manage User (Tambah/Edit Pengguna) supaya Admin bisa mendaftarkan kendaraan milik karyawan — lalu field `plat` di form pengajuan BBM otomatis terisi/bisa dipilih dari daftar plat terdaftar, bukan diketik manual dari nol. Berkembang jadi beberapa tahap lanjutan dalam sesi yang sama: penyesuaian kategori `jenis`/`namaItem` di seluruh form RBS & LPJ (termasuk menambahkan kemampuan input BBM — Liter & Plat — ke `FormRbsOperasional.jsx`, `FormRbsUmum.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx`, yang sebelumnya cuma dimiliki `FormRbsBbm.jsx`), dan akhirnya memperluas rekap BBM (`aggregateBbm`) supaya menarik data dari SEMUA sumber tersebut, bukan cuma dari form BBM khusus.

## 15.2 Field Plat No Kendaraan di Manage User

- `FormAddUser.jsx` & `FormEditUser.jsx`: field baru **"Plat No Kendaraan"** (opsional, multi-value pakai `CreatableSelect` dari `react-select/creatable` — bisa isi lebih dari satu plat per karyawan, atau kosong kalau tidak punya kendaraan). Nilai di-uppercase & difilter ke karakter plat yang valid (`A-Z0-9` + spasi) sebelum disimpan.
- `functions/index.js` (`normalizeManagedUser`, dipakai `createManagedUser`): tambah `platKendaraan` ke daftar field yang di-normalize (list string, maks 20 item, opsional).
- `firestore.rules` (`validUserDocument`): tambah `validStringList(data.platKendaraan, 20)` supaya field ini divalidasi konsisten dengan field array lain (`unit`, `lokasi`, dst) di jalur update Super Admin.
- Data disimpan di `users/{uid}.platKendaraan` (array of string).

## 15.3 Plat Nomor di Form Pengajuan — dari "milik sendiri" jadi "semua plat terdaftar"

Awalnya field `plat` di `FormRbsBbm.jsx` diubah dari input teks bebas jadi dropdown (`CreatableSelect`) berisi plat milik user yang login saja. Setelah diskusi lanjut, cakupannya diperluas: dropdown plat sekarang menarik **semua plat terdaftar lintas seluruh user** (query `users` collection, dedup, label `PLAT - Nama Pemilik`), supaya karyawan bisa memilih kendaraan siapa pun yang terdaftar (mis. kendaraan operasional/dinas bersama), bukan cuma miliknya sendiri. Tetap bisa mengetik plat baru yang belum terdaftar (fallback `CreatableSelect`, contoh kasus: `DD 1273 XCS`).

Kalau user yang login (atau, saat mode edit, user pemilik pengajuan asli — diambil fresh dari Firestore, bukan snapshot lama) cuma punya **1 plat terdaftar di profilnya sendiri**, plat itu otomatis terisi default (tetap bisa diganti manual).

## 15.4 Kategori Jenis BBM & Kalkulasi Liter Otomatis

**`FormRbsBbm.jsx`** — opsi `jenisOptions` dirapikan jadi murni jenis bahan bakar: BBM Pertalite, BBM Pertamax, BBM Pertamax Turbo, BBM Solar, BBM Dexlite, Lainnya (opsi lama "Top Up E-Toll" & "Parkir" dihapus — bukan jenis BBM).

Field **Liter** sekarang dihitung otomatis: `liter = biaya ÷ harga per liter`, recalculate tiap kali `biaya` atau `jenis` berubah (tetap bisa diedit manual kalau harga di struk beda dari patokan). Patokan harga per liter (wilayah Sulawesi Selatan, Pertamina Patra Niaga, berlaku 1 September 2026):

| Jenis | Rp/Liter |
|---|---|
| BBM Pertalite | 10.000 |
| BBM Pertamax | 16.300 |
| BBM Pertamax Turbo | 19.600 |
| BBM Solar (Biosolar) | 6.800 |
| BBM Dexlite | 23.700 |

**Catatan penting:** harga di atas **hardcoded** di masing-masing file (`BBM_PRICE_PER_LITER`, di-copy identik ke `FormRbsBbm.jsx`, `FormRbsOperasional.jsx`, `FormRbsUmum.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx`) — kalau Pertamina merevisi harga, kelima file itu harus diupdate manual satu-satu (tidak ada shared constant, sama seperti pola `UNIT_CODES` yang sudah ada sebelumnya, lihat 13.5).

## 15.5 Kategori BBM Ditambahkan ke RBS Operasional & RBS Umum (GA/Umum)

Sebelumnya cuma `FormRbsBbm.jsx` yang punya field Liter/Plat. Sekarang `FormRbsOperasional.jsx` & `FormRbsUmum.jsx` juga bisa punya item berjenis BBM dalam satu pengajuan campur dengan item non-BBM lain:

- **`FormRbsOperasional.jsx`** — `jenisOptions` baru: BBM Pertalite, BBM Pertamax, Meeting, Entertaint, Parkir, Biaya Buruh, Meal Buruh, Meal Lembur, Lainnya (opsi lama "Toll" dihapus, "Meals Lembur" diganti "Meal Lembur").
- **`FormRbsUmum.jsx`** — ditambah **E-Toll**, BBM Pertalite, BBM Pertamax, BBM Pertamax Turbo, BBM Solar ke opsi yang sudah ada (ATK, RTG, RTK, Entertaint, Parkir, Meals Lembur, Meals Meeting, Lainnya — nama-nama lama TIDAK diubah di form ini).
- **Perilaku kondisional per baris item**: kalau `jenis` yang dipilih adalah salah satu jenis BBM, field **Kebutuhan** (Operasional) / **Item** (Umum) disembunyikan, diganti **Plat Nomor** (dropdown sama seperti 15.3) + **Liter** (auto-kalkulasi sama seperti 15.4). Validasi submit menyesuaikan: item BBM wajib isi Plat & Liter (bukan Kebutuhan/Item), item non-BBM tetap seperti semula.
- `DetailRbs.jsx`: kolom Kebutuhan/Item di tabel Detail Pengajuan sekarang menampilkan info Plat & Liter di bawah nama kategori kalau item tersebut BBM (sebelumnya kolom Plat/Liter cuma ada untuk dokumen `kategori === 'BBM'`, jadi data BBM dari Operasional/Umum tidak akan pernah kelihatan tanpa perbaikan ini).

## 15.6 Kategori BBM di LPJ Umum & LPJ Marketing

`FormLpjUmum.jsx` & `FormLpjMarketing.jsx` sudah lebih dulu punya field `namaItem` dropdown yang mengikuti `jenisOptions` RBS Umum/Operasional masing-masing (lihat bagian 10) — jadi diselaraskan ulang mengikuti daftar baru di 15.5 (LPJ Umum → sama seperti RBS Umum baru; LPJ Marketing → sama seperti RBS Operasional baru).

Struktur data LPJ per item itu `biaya` (harga satuan) × `jumlah` (kuantitas) = `jumlahBiaya` — kebetulan pas untuk BBM (harga per liter × liter), jadi **tidak perlu field Liter terpisah**: cukup relabel `Biaya` → "Harga/Liter" dan `Jumlah` → "Liter" saat item-nya BBM, plus auto-isi `Biaya` dari patokan harga (15.4) begitu jenis BBM dipilih. Field **Plat Nomor** baru ditambahkan (dropdown sama seperti 15.3), wajib diisi untuk item BBM.

`DetailLpj.jsx`: kolom Item menampilkan Plat di bawah nama item kalau item tersebut BBM.

## 15.7 Perluasan Rekapan BBM (Bagian A, lanjutan)

Sebelumnya `aggregateBbm` (di `rekapanAggregation.js`) cuma menarik data dari dokumen `reimbursement` dengan `kategori === 'BBM'` (submission lewat `FormRbsBbm.jsx` saja). Setelah 15.5 & 15.6, item BBM bisa muncul di dokumen `reimbursement` kategori Operasional/GA-Umum maupun dokumen `lpj` — jadi `aggregateBbm` diperluas:

- Dikenali dari **prefix `"BBM "`** pada `item.jenis` (reimbursement) / `item.namaItem` (lpj), bukan dari `kategori` di level dokumen — supaya satu dokumen campuran (ada item BBM & non-BBM) tetap kepisah dengan benar per item.
- Menarik dari kedua koleksi: `reimbursementDocs` DAN `lpjDocs` (parameter baru `aggregateBbm(reimbursementDocs, lpjDocs, options)`).
- Konversi liter/Rupiah disesuaikan per sumber: di `reimbursement`, `item.biaya` sudah total Rupiah & `item.liter` sudah liter langsung; di `lpj`, total Rupiah aktualnya `item.jumlahBiaya` (bukan `item.biaya` yang cuma harga satuan) & liternya `item.jumlah`.
- `aggregateByCategory` (rekap kategori umum) di-update supaya **mengecualikan** item BBM (prefix `"BBM "`) di level item juga (sebelumnya cuma exclude dokumen `kategori === 'BBM'`) — mencegah item BBM dari Operasional/Umum/LPJ terhitung dua kali (muncul di tabel kategori umum DAN tabel BBM sekaligus).
- `RekapanUnitBisnis.jsx`: pemanggilan `aggregateBbm` diupdate untuk ikut mengirim `lpjDocs`.

## 15.8 Filter "Tampilkan Rekapan"

Ditambahkan dropdown multi-select **"Tampilkan Rekapan"** di halaman Rekapan (`RekapanUnitBisnis.jsx`), sejajar dengan filter Unit Bisnis & Tahun yang sudah ada. Berisi semua tabel yang tersedia: "BBM -- Total Biaya", "BBM -- Liter per Plat Nomor", plus setiap kategori dinamis dari data (`ATK`, `RTK`, `Meeting`, `E-Toll`, `Biaya Buruh`, dst). Kosong (default) = tampilkan semua tabel, sama seperti perilaku sebelumnya — pilih satu/lebih untuk mempersempit tampilan ke rekap yang diminati saja. `CATEGORY_ORDER` juga diperluas supaya kategori-kategori baru dari 15.5 (Meeting, E-Toll, Biaya Buruh, Meal Buruh, Meal Lembur) ikut terurut rapi, tidak jatuh ke grup "tidak dikenal" di akhir.

## 15.9 Verifikasi & Keterbatasan

- `CI=true npm run build` sukses (0 warning/error) di setiap tahap perubahan.
- Login page & route guard (`ProtectedRoute`) dicek jalan normal tanpa error console saat dev server dijalankan lokal (port 3000 dipakai sesi lain, dipindah otomatis via `autoPort: true` di `.claude/launch.json`).
- **Belum diverifikasi dengan data asli**: verifikasi visual data BBM Operasional/Umum/LPJ yang benar-benar terisi di tabel Rekapan (termasuk hasil filter "Tampilkan Rekapan") **butuh login sungguhan sebagai Validator/Admin/Super Admin**, yang tidak bisa dilakukan otomatis dalam sesi ini (tidak ada mekanisme untuk memasukkan password akun asli). Perlu dicek manual oleh user langsung di browser.

## 15.10 Task Development — Bagian E

- [x] Field `platKendaraan` di `FormAddUser.jsx`, `FormEditUser.jsx`, `functions/index.js` (`normalizeManagedUser`), `firestore.rules` (`validUserDocument`)
- [x] Plat Nomor di `FormRbsBbm.jsx` jadi dropdown lintas semua user (bukan cuma milik sendiri) + auto-default kalau submitter cuma punya 1 plat
- [x] Rapikan `jenisOptions` `FormRbsBbm.jsx` jadi murni BBM (Pertalite/Pertamax/Pertamax Turbo/Solar/Dexlite) + hapus Top Up E-Toll/Parkir
- [x] Liter auto-kalkulasi dari Biaya ÷ harga/liter (patokan Sulawesi Selatan, 1 Sept 2026) di `FormRbsBbm.jsx`
- [x] Tambah kategori BBM (Pertalite/Pertamax) + field Liter/Plat kondisional ke `FormRbsOperasional.jsx`
- [x] Tambah E-Toll + kategori BBM (Pertalite/Pertamax/Pertamax Turbo/Solar) + field Liter/Plat kondisional ke `FormRbsUmum.jsx`
- [x] `DetailRbs.jsx`: surface Plat/Liter untuk item BBM di kategori Operasional/GA-Umum
- [x] Sinkronkan `jenisOptions`/`namaItem` `FormLpjUmum.jsx` & `FormLpjMarketing.jsx` dengan RBS terbaru + relabel Biaya/Jumlah jadi Harga per Liter/Liter + field Plat untuk item BBM
- [x] `DetailLpj.jsx`: surface Plat untuk item BBM
- [x] Perluas `aggregateBbm` (`rekapanAggregation.js`) menarik dari RBS Operasional/Umum + LPJ Umum/Marketing, dikenali dari prefix `"BBM "`, bukan cuma dokumen `kategori === 'BBM'`
- [x] `aggregateByCategory` exclude item BBM di level item supaya tidak double-count dengan `aggregateBbm`
- [x] Filter multi-select "Tampilkan Rekapan" di `RekapanUnitBisnis.jsx`
- [ ] Verifikasi visual data asli di browser (Validator/Admin/Super Admin sungguhan) — **butuh user login manual**, tidak bisa dilakukan otomatis
- [ ] (Belum dikerjakan, opsional) Pindahkan `BBM_PRICE_PER_LITER` yang terduplikasi di 5 file ke satu shared constant, sama seperti rekomendasi `UNIT_CODES` di 13.5

---

# BAGIAN F — Filter Checkbox Rekapan, Aksi Cetak/Transferred Reimbursement, Reported BS, & Deploy Produksi (2026-09-01)

**Status: SELESAI DIIMPLEMENTASIKAN & DI-DEPLOY ke produksi.**

## 16.1 Filter "Tampilkan Rekapan" jadi Checkbox Dropdown

`RekapanUnitBisnis.jsx`: filter "Tampilkan Rekapan" (lihat 15.8) yang tadinya pakai `react-select` multi-select (chip/tag), diganti jadi dropdown custom berisi daftar checkbox per tabel/kategori, dengan tombol cepat "Pilih Semua" / "Kosongkan". Perilaku filter (`tableFilter`, `isTableVisible`) tidak berubah — cuma UI-nya, supaya lebih mudah dipakai untuk memilih banyak item sekaligus dibanding chip yang menyempit.

## 16.2 Reimbursement Diajukan — Aksi "Cetak" & "Transferred"

`ReimbursementTable.jsx` (tabel "Reimbursement Diajukan" di Dashboard): saat status pengajuan `Disetujui`, kolom Aksi yang tadinya cuma tombol "Batalkan" (disabled) berubah jadi dropdown **Cetak ▾** dengan 4 pilihan:
- **Print RBS Form** — generate ulang PDF form RBS (`generateReimbursementPDF`, sudah ada dari `DetailRbs.jsx`) lalu buka di tab baru.
- **Print Lampiran** — buka `lampiranUrl` (bukti/nota) di tab baru.
- **Print Both** — buka keduanya sekaligus.
- **Transferred** — menandai dokumen sudah di-TF finance (`updateDoc` field `transferred: true`, `transferredAt`). Setelah ditandai, opsi ini nonaktif (bertanda centang) supaya tidak bisa ditandai dua kali.

**Firestore Rules baru** (`firestore.rules`): ditambahkan fungsi `canMarkTransferred()` — mengizinkan pemilik dokumen (`isWorkflowOwner`) menandai `transferred` hanya kalau `status == 'Disetujui'`, dan cuma field `transferred`/`transferredAt` yang boleh berubah (`affectedKeys().hasOnly([...])`), satu arah (tidak ada rule untuk un-set balik ke `false`). Dipanggil dari `canUpdateWorkflow()` bersama rule-rule lain yang sudah ada. Keputusan akses (dikonfirmasi ke user): **siapa pun yang bisa melihat tabel ini (pemilik pengajuan) boleh menandai Transferred sendiri** — bukan dibatasi role Admin/Finance, karena tabel ini toh cuma menampilkan pengajuan milik user yang login sendiri (query difilter `user.uid == uid`).

## 16.3 Bon Sementara — Label "Reported" & Disable "Buat Laporan"

- `BsTable.jsx` (tabel "Bon Sementara Diajukan"): sudah ada logika `lpjStatus[item.id].status` (`'Belum LPJ'` / `'Sedang LPJ'` / `'Sudah LPJ'`, dihitung dari query koleksi `lpj` yang dicocokkan lewat `nomorBS`). Ditambahkan label **"Reported"** di sebelah Nomor BS ketika `lpjStatus[item.id].status === 'Sudah LPJ'` (LPJ untuk BS itu sudah Disetujui).
- `DetailBs.jsx`: sebelumnya tombol "Buat Laporan" cuma dicek dari status BS itu sendiri (`bonSementaraDetail.status === 'Disetujui'`) — tidak pernah cek apakah LPJ untuk BS itu sudah pernah dibuat & disetujui. Celahnya: user bisa saja buka lagi Detail BS yang sudah Disetujui dan submit LPJ kedua untuk BS yang sama. Ditambahkan `useEffect` baru yang query koleksi `lpj` milik user (di-filter `user.uid`, cocok dengan rules `list`), dicocokkan ke `nomorBS` BS ini — kalau ketemu dan `status === 'Disetujui'`, tombol "Buat Laporan" di-disable + muncul catatan kecil "Reported -- LPJ sudah Disetujui" di bawahnya.

## 16.4 Styling Label "Reported"/"Transferred"

Berdasarkan feedback user: label dipindah dari baris baru di bawah nomor dokumen jadi **sebaris di depan nomor dokumen** (Nomor BS / Nomor Dokumen Reimbursement), dan warna diubah dari hitam ke **abu-abu** (`text-gray-500` light / `text-gray-400` dark) supaya tetap jelas terbaca tapi tidak terlalu menonjol dibanding nomor dokumennya sendiri. Berlaku di `ReimbursementTable.jsx`, `BsTable.jsx`, dan catatan "Reported" di `DetailBs.jsx`.

## 16.5 Deploy ke Produksi & Alur Kerja Git

Seluruh pekerjaan yang tadinya menumpuk **belum ter-commit** di branch `dev` (Bagian A–E di atas + Bagian F ini) di-commit, di-push, di-merge ke `main`, dan **di-deploy ke produksi** (`samudera-web-cbf2f`, Hosting URL: `https://samudera-web-cbf2f.web.app`) — mencakup Firestore Rules, Storage Rules, 10 Cloud Functions, dan Hosting.

**Catatan penting soal akses deploy:** akun Firebase CLI yang login sebelumnya (`samudera.makassar@gmail.com`) **tidak** terdaftar sebagai member project `samudera-web-cbf2f` (cuma punya akses ke project lain, `sibm-app`) — deploy Firestore Rules sempat gagal 403 karenanya. User login ulang lewat `firebase login` di terminalnya sendiri pakai akun `cctv.samudera@gmail.com` yang punya akses, baru deploy berhasil.

**Catatan soal build flaky:** `CI=true npm run build` sempat gagal 2× dengan error unused-var (`currentCounter` di `FormBs.jsx`, `addDoc` di `FormRbsOperasional.jsx`/`FormRbsUmum.jsx`) padahal isi file di disk (dicek lewat `grep`) **tidak** mengandung kode yang dituduh error tersebut, dan `git status` bersih. Kemungkinan penyebab: cache build (`node_modules/.cache`) yang stale, kemungkinan terganggu oleh sesi lain yang juga menjalankan dev server di folder yang sama secara bersamaan. Solusi yang berhasil: `rm -rf node_modules/.cache` lalu build ulang — selalu sukses setelah itu. **Kalau build gagal dengan error yang terasa tidak sesuai isi file terbaru, cek dulu `git status`/`grep` sebelum menyimpulkan ada bug — kemungkinan besar cache stale, bukan regresi kode.**

**Alur kerja yang disepakati user untuk sesi mendatang:** setiap kali melakukan push sampai tahap deploy produksi, WAJIB (1) update dokumen `SUMMARY_PENGEMBANGAN.md` ini dengan ringkasan perubahan sebelum/sesudah deploy, dan (2) checkout kembali ke branch `dev` setelah selesai deploy dari `main` — supaya kerja lanjutan/perbaikan berikutnya tidak dilakukan langsung di `main` (branch yang di-deploy live), mengurangi risiko tidak sengaja mengganggu link utama yang sedang dipakai user selagi masih dalam proses perbaikan.

## 16.6 Task Development — Bagian F

- [x] Filter "Tampilkan Rekapan" di `RekapanUnitBisnis.jsx` diganti jadi checkbox dropdown custom (dari `react-select` multi-select)
- [x] Menu Cetak (RBS Form/Lampiran/Both) + Transferred di `ReimbursementTable.jsx` untuk status Disetujui
- [x] Rule Firestore `canMarkTransferred()` untuk mengizinkan pemilik menandai `transferred`
- [x] Label "Reported" di `BsTable.jsx` + disable tombol "Buat Laporan" di `DetailBs.jsx` kalau LPJ terkait sudah Disetujui
- [x] Reposisi label Reported/Transferred jadi sebaris di depan nomor dokumen, warna abu-abu
- [x] Commit seluruh pekerjaan Bagian A–F, merge `dev` → `main`, deploy penuh (`firebase deploy`) ke `samudera-web-cbf2f`
- [x] Verifikasi manual oleh user langsung di produksi: fitur Transferred & Reported dikonfirmasi jalan normal
- [ ] (Belum dikerjakan) Pindahkan `UNIT_CODES`/`BBM_PRICE_PER_LITER` yang terduplikasi ke shared constant (masih pending dari 13.5 & 15.10)

---

# BAGIAN G — Perbaikan Bug Kritis: Reject RBS/LPJ Silent Fail untuk Reviewer1/Reviewer2 (2026-09-01)

**Status: SUDAH DIPERBAIKI & DI-DEPLOY.**

## 17.1 Laporan User

User menolak (reject) satu pengajuan LPJ Bon Sementara berstatus `Diproses` (di halaman "Cek Pengajuan LPJ Bon Sementara") — muncul toast sukses dan baris hilang dari tabel "Perlu Ditanggapi" seperti biasa. Tapi setelah reload halaman, dokumen yang sama muncul lagi di tabel "Perlu Ditanggapi", seolah-olah reject tadi tidak pernah terjadi.

## 17.2 Root Cause

Ditemukan di `ReimbursementCheck.jsx` dan `LpjBsCheck.jsx` (dua-duanya punya alur approval 3 tahap: Validator → Reviewer 1 → Reviewer 2). `handleSubmitReject` di kedua file menentukan tahap mana yang sedang ditolak dengan **mengecek keberadaan field** `approvedByValidatorStatus`/`approvedByReviewer1Status` pada dokumen (`if (!selectedReport.approvedByValidatorStatus) {...} else {...}`).

Masalahnya: field `approvedByValidatorStatus` **HANYA PERNAH diisi lewat alur reject itu sendiri** (`approvedByValidatorStatus: 'validator'`/`'superadmin'`) — `handleApprove` di kedua file **TIDAK PERNAH** mengisi field ini saat approval normal, cuma mengisi `approvedByValidator: true` (field boolean yang berbeda nama). Akibatnya, untuk **dokumen mana pun yang lolos approval Validator secara normal** (kasus paling umum), field `approvedByValidatorStatus` tetap `undefined` selamanya — bukan karena belum divalidasi, tapi karena approve normal memang tidak pernah mengisinya.

Efeknya saat Reviewer1/Reviewer2 (yang BUKAN Validator) menekan Reject pada dokumen status `Divalidasi`/`Diproses`:
1. `!selectedReport.approvedByValidatorStatus` selalu `true` (field memang tidak pernah ada) → kode masuk ke cabang "Validator belum approve", padahal validator sudah approve dari dulu.
2. Di cabang itu, hanya `isValidatorAndReviewer1` atau `isValidator` yang ditangani — Reviewer1/Reviewer2 murni tidak cocok kondisi manapun.
3. `updateData` tetap `{}` (objek kosong) sampai akhir fungsi.
4. `await updateDoc(ref, {})` — Firestore menerima update kosong sebagai **no-op yang sukses** (tidak ada field yang berubah, tidak ada error dilempar, lolos rules `workflowStatusUpdateKeysOnly()` karena diff-nya kosong).
5. Kode setelahnya tetap jalan seolah reject berhasil: item dihapus dari state lokal + toast sukses ditampilkan — padahal dokumen di Firestore **sama sekali tidak berubah**.
6. Reload halaman → query ulang ke Firestore → dokumen (status masih `Divalidasi`/`Diproses`, tidak pernah jadi `Ditolak`) otomatis muncul lagi di tabel "Perlu Ditanggapi".

**Catatan cakupan:** `BsCheck.jsx` (alur BS, cuma 2 tahap: Reviewer1 → Reviewer2) **tidak kena bug ini** — reject-nya sudah benar mengecek `isReviewer1`/`isReviewer2` langsung tanpa bergantung pada field yang tidak reliable ini.

## 17.3 Perbaikan

`handleSubmitReject` di `ReimbursementCheck.jsx` dan `LpjBsCheck.jsx` diubah supaya cabang ditentukan dari **`selectedReport.status`** (tahap approval yang sebenarnya, field yang SELALU akurat dan konsisten dipakai `handleApprove`) — bukan dari keberadaan field `approvedByValidatorStatus`/`approvedByReviewer1Status`. Polanya sekarang persis meniru percabangan `handleApprove`:
- `status === 'Diajukan'` → reject sebagai Validator (atau Validator+Reviewer1 sekaligus)
- `status === 'Divalidasi'` → reject sebagai Reviewer 1
- `status === 'Diproses'` → reject sebagai Reviewer 2
- Status lain / role tidak cocok → `throw new Error(...)` eksplisit (ditangkap `catch`, muncul toast **gagal**, bukan lagi diam-diam sukses padahal tidak ada perubahan)

Dengan ini, setiap kombinasi status+role menghasilkan salah satu dari dua hasil yang jelas: **update valid** (status jadi `Ditolak`) atau **error eksplisit** — tidak ada lagi jalur `updateData = {}` yang lolos tanpa efek.

## 17.4 Dampak ke Data Lama

Dua dokumen LPJ yang sempat "di-reject" tapi gagal diam-diam (`LPJ.MRO.SKEL.260901.3311` milik Nuzul Wijaya dan `LPJ.MRO.SKEL.260901.8679` milik Rahmat Hidayat, sama-sama status `Diproses` per laporan user) **tidak otomatis berubah** oleh fix ini — statusnya di Firestore tetap `Diproses` seperti semula. **User perlu klik Reject ulang** pada kedua dokumen itu setelah fix ini live; dengan kode yang sudah diperbaiki, reject kali ini akan benar-benar tersimpan ke Firestore.

## 17.5 Task Development — Bagian G

- [x] Root cause: reject RBS/LPJ bercabang dari keberadaan field `approvedByValidatorStatus` yang tidak pernah diisi saat approve normal
- [x] Fix `handleSubmitReject` di `ReimbursementCheck.jsx` — cabang berdasarkan `selectedReport.status`, tambah `throw` eksplisit untuk kombinasi status/role yang tidak valid
- [x] Fix `handleSubmitReject` di `LpjBsCheck.jsx` — perbaikan identik
- [x] Konfirmasi `BsCheck.jsx` tidak terdampak (alur 2 tahap, tidak bergantung pada field bermasalah)
- [x] `CI=true npm run build` sukses (0 warning/error)
- [ ] User perlu reject ulang 2 dokumen LPJ yang datanya "tersangkut" akibat bug ini (lihat 17.4)

---

# BAGIAN H — Audit & Pengetatan Firestore Rules, Verifikasi Edit/Hapus Super Admin (2026-09-01)

**Status: SUDAH DIPERBAIKI & DI-DEPLOY.**

## 18.1 Permintaan User

User minta dicek: (1) apakah fungsi Edit dan Hapus untuk Super Admin di halaman Cek Pengajuan (BS/RBS/LPJ) sudah bekerja dengan baik, dan (2) apakah Firestore Rules sudah cukup ketat.

## 18.2 Hasil Cek Edit & Hapus Super Admin

**Edit — sudah benar.** Ditelusuri lewat kode (tidak ada kredensial untuk tes langsung di browser): `BsCheck.jsx`/`ReimbursementCheck.jsx`/`LpjBsCheck.jsx` → `FormBs.jsx`/`FormRbsUmum.jsx`/dst. Alur edit Super Admin cuma pernah `updateDoc` field konten (`bonSementara`/`reimbursements`, `totalBiaya`, `statusHistory`, opsional `lampiran`), tidak pernah menyentuh `user`/`displayId` — jadi `keepsWorkflowIdentity()` selalu lolos, dan `isSuperAdmin()` di `canUpdateWorkflow()` memberi bypass tanpa syarat field apa pun. Konsisten di ketiga modul.

**Hapus — TIDAK ADA di UI untuk dokumen pengajuan.** `firestore.rules` punya `allow delete: if isSuperAdmin();` di `bonSementara`/`reimbursement`/`lpj`, tapi tidak ada tombol/handler hapus sama sekali di `BsCheck.jsx`, `ReimbursementCheck.jsx`, maupun `LpjBsCheck.jsx` — izinnya ada di level database, fiturnya tidak ada di aplikasi. **Belum diputuskan** apakah ini memang disengaja (dibiarkan) atau perlu ditambah fitur hapusnya — belum ada keputusan/permintaan eksplisit dari user soal ini.

Terpisah dari itu, **Hapus/Edit User (Manage User)** sudah benar dan aman: `deleteManagedUser`/`createManagedUser` adalah Cloud Functions yang verifikasi `role === 'Super Admin'` di server (`requireSuperAdmin`), tidak bergantung ke client sama sekali.

## 18.3 Temuan Audit Firestore Rules & Perbaikan

Ditemukan 3 celah signifikan (diurutkan dari paling kritis), semua sudah diperbaiki di `firestore.rules`:

**🔴 Kritis — `canCreateWorkflow()` tidak validasi `status` saat create.** Sebelumnya `validWorkflowCreate()` cuma cek `validOptionalString(data.status, 80)` — STRING APA PUN diterima, termasuk `'Disetujui'`. Artinya seseorang bisa menulis langsung ke Firestore (bypass UI resmi, lewat SDK/console) membuat dokumen `bonSementara`/`reimbursement`/`lpj` yang LANGSUNG berstatus Disetujui, tanpa melalui approval sama sekali — bug self-approval penuh. Diperbaiki: `data.status == 'Diajukan'` wajib (dikonfirmasi seluruh 6 form pengajuan selalu create dengan status ini), plus validasi `validator`/`reviewer1`/`reviewer2` (kalau ada) harus berupa list, bukan sembarang tipe.

**🟠 Tinggi — `canApproverUpdateWorkflow()` tidak validasi transisi status.** Sebelumnya siapa pun yang terdaftar sebagai validator/reviewer1/reviewer2 pada dokumen bisa mengirim request yang direkayasa untuk melompat langsung ke `status: 'Disetujui'`, melewati tahap approval lain — rule cuma cek SIAPA yang boleh menyentuh field, bukan transisi APA yang sah. Diperbaiki: tambah `isValidForwardTransition()` yang membatasi transisi maju sesuai alur asli (`Diajukan→Divalidasi/Diproses`, `Divalidasi→Diproses`, `Diproses→Disetujui`); transisi ke `'Ditolak'` tetap bebas dari status manapun (sudah dijaga di sisi aplikasi, lihat Bagian G).

**🟠 Tinggi — `/counters` & `/businessUnitCounters` tanpa validasi field.** Sebelumnya `allow create, update: if signedIn()` — Employee biasa pun bisa menulis field/nilai APA PUN ke counter nomor dokumen, berpotensi me-reset/menurunkan `lastNumber` dan memicu ulang bug duplikasi nomor dokumen yang sudah diperbaiki di Bagian C/13.7. Diperbaiki: `validCounterFields()` (cuma field `lastNumber`/`lastResetYear`, tipe & rentang benar) + `validCounterUpdate()` (lastNumber tidak boleh menurun kecuali `lastResetYear` ikut berubah, sesuai perilaku reset tahun baru yang memang sah di kode).

**Catatan teknis penting:** percobaan pertama menambah validasi approver list (`data.user.validator` dkk) sempat salah — mengakses key map yang tidak ada (BS tidak punya field `validator` sama sekali di `user`) lewat dot-notation langsung MEMBUAT RULE ERROR (dianggap deny), bukan `null`. Ketahuan sebelum deploy lewat review manual, diperbaiki pakai `data.user.get('validator', null)` (accessor aman Firestore Rules untuk key yang mungkin tidak ada).

## 18.4 Temuan yang BELUM Diperbaiki (Perlu Keputusan User)

**🟡 Moderat — `/users/{uid}` read terlalu longgar.** `allow read: if signedIn()` mengizinkan SIAPA PUN yang login membaca profil lengkap user lain, termasuk `bankName` & `accountNumber` (nomor rekening bank asli), bukan cuma nama. Ini saat ini DIPAKAI SECARA SENGAJA oleh fitur plat BBM (Bagian E — query seluruh koleksi `users` untuk dropdown plat lintas user), jadi tidak bisa langsung diperketat tanpa perubahan skema (mis. pindahkan `bankName`/`accountNumber` ke subcollection privat yang cuma bisa dibaca pemilik + Super Admin). **Belum dikerjakan** — butuh keputusan user karena perlu refactor beberapa titik baca.

**🟡 Minor — `storage.rules` mengizinkan `write` (upload/timpa) tanpa cek kepemilikan path** di `Reimbursement/`, `BonSementara/`, `LPJ/` — siapa pun yang login bisa menimpa file lampiran di path manapun kalau tahu/menebak path-nya. Risiko lebih rendah (perlu menebak path persis), **belum dikerjakan**.

## 18.5 Task Development — Bagian H

- [x] Verifikasi Edit Super Admin (BS/RBS/LPJ) — struktur kode sudah benar
- [x] Verifikasi Hapus Super Admin — TIDAK ADA di UI meski rule mengizinkan; dilaporkan sebagai gap, bukan bug
- [x] Verifikasi Edit/Hapus User di Manage User — sudah benar, terverifikasi via Cloud Function `requireSuperAdmin`
- [x] `canCreateWorkflow()`: wajibkan `status == 'Diajukan'` saat create + validasi tipe `validator`/`reviewer1`/`reviewer2`
- [x] `canApproverUpdateWorkflow()`: tambah `isValidForwardTransition()` untuk cegah lompat status
- [x] `/counters` & `/businessUnitCounters`: tambah `validCounterFields()`/`validCounterUpdate()`
- [x] Deploy `firestore.rules` yang sudah diperketat ke produksi
- [ ] (Butuh keputusan user) Perketat read `/users/{uid}` — perlu refactor plat-picker BBM dulu
- [ ] (Opsional, prioritas rendah) Perketat `storage.rules` supaya write terikat kepemilikan path
