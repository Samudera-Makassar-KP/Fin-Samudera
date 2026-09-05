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
- **Bagian I** — Detail Item di PDF/Print RBS, 2026-09-01 (bagian 19)
- **Bagian J** — Detail Item (khusus BBM) di PDF/Print LPJ, Tanpa Ubah Format, 2026-09-01 (bagian 20)
- **Bagian K** — Eksekusi 2 Temuan Keamanan Tertunda dari Bagian H: Storage Ownership & Proteksi Data Bank User, 2026-09-02 (bagian 21) — **DI-DEPLOY ke produksi 2026-09-02, WAJIB klik 2 tombol sync di Manage Users + tes manual sebelum dipakai (lihat 21.5)**
- **Bagian L** — Aksi "Send Reminder to Finance" di Tabel BS, 2026-09-02 (bagian 22) — **DI-DEPLOY ke produksi 2026-09-02 (bersama Bagian K), wajib tes manual (lihat 22.5)**

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

---

# BAGIAN I — Detail Item di PDF/Print RBS (2026-09-01)

**Status: SUDAH DIPERBAIKI & DI-DEPLOY.**

## 19.1 Masalah

Hasil cetak/PDF RBS (Print RBS Form, dihasilkan `generateReimbursementPDF` di `src/utils/ReimbursementPdf.jsx` -- dipakai bersama oleh `DetailRbs.jsx` dan menu Cetak di `ReimbursementTable.jsx`, jadi berlaku untuk SEMUA kategori RBS: BBM/Operasional/GA-Umum) cuma menampilkan tanggal + `item.jenis` (kategori, mis. "E-Toll") di kolom ACTIVITIES NAME, dan kolom KETERANGAN sering kosong (field `keterangan` opsional, banyak pengajuan tidak mengisinya). Akibatnya orang yang baca hasil cetak tidak tahu **detail permintaan sebenarnya** -- cuma tahu kategorinya, bukan barang/kebutuhan/plat kendaraan spesifiknya.

## 19.2 Perbaikan

`ReimbursementPdf.jsx` — kolom ACTIVITIES NAME sekarang menampilkan baris kedua berisi detail item, diambil sesuai kategori dokumen (fungsi baru `getItemDetailText`, meniru pola yang sudah dipakai `DetailRbs.jsx` untuk kolom Item/Kebutuhan):
- **GA/Umum** → field `item.item`
- **Operasional** → field `item.kebutuhan`
- **BBM** (dokumen kategori BBM, ATAU baris BBM di dalam Operasional/GA-Umum yang dikenali dari prefix `"BBM "` pada `item.jenis` — sama seperti logika `aggregateBbm`) → gabungan `item.lokasi` (Lokasi Pertamina) + `Plat {item.plat}` + `{item.liter} L`, hanya bagian yang terisi yang ditampilkan.

Detail ditampilkan di baris kedua, font lebih kecil (7pt, abu-abu), di bawah baris tanggal+jenis yang sudah ada — kolom KETERANGAN (catatan bebas terpisah) tidak diubah.

## 19.3 Task Development — Bagian I

- [x] Tambah `getItemDetailText()` di `ReimbursementPdf.jsx`, sadar kategori (GA/Umum/Operasional/BBM + baris BBM campuran)
- [x] Render detail item sebagai baris kedua di kolom ACTIVITIES NAME
- [x] `CI=true npm run build` sukses (0 warning/error)
- [ ] Verifikasi visual PDF asli di browser — butuh cetak ulang dokumen sungguhan oleh user (tidak ada kredensial untuk generate PDF asli di sesi ini)

---

# BAGIAN J — Detail Item (khusus BBM) di PDF/Print LPJ, Tanpa Ubah Format (2026-09-01)

**Status: SUDAH DIPERBAIKI & DI-DEPLOY.**

## 20.1 Masalah

Sama seperti RBS (Bagian I), PDF LPJ (`generateLpjPDF` di `src/utils/LpjPdf.jsx`) cuma menampilkan `item.namaItem` di kolom URAIAN tanpa detail tambahan. Untuk item BBM masalahnya lebih besar dari RBS: LPJ BBM **bervariasi** -- ada LPJ yang seluruh isinya BBM ("khusus BBM"), dan ada yang isinya campuran BBM + item non-BBM dalam satu dokumen ("campur", lihat Bagian 15.6). Tidak ada info **Plat Nomor** sama sekali di PDF LPJ, padahal field ini wajib diisi untuk tiap item BBM.

**Kendala tambahan:** user secara eksplisit minta TIDAK mengubah/merusak format PDF yang sudah ada (kolom, lebar, header tabel LPJ ini custom dan sudah dipakai sebagai dokumen resmi).

## 20.2 Solusi (tanpa mengubah format)

Karena item BBM bisa muncul di LPJ mana pun (khusus BBM ATAU campur), perbaikan dilakukan **per-baris** (bukan per-dokumen) -- setiap item dicek sendiri-sendiri lewat prefix `"BBM "` pada `namaItem` (pola yang sama dengan `aggregateBbm`/`getItemDetailText` di Bagian I), sehingga otomatis benar untuk kedua kasus tanpa perlu tahu "jenis LPJ" di level dokumen:

- **Kolom URAIAN** (lebar tidak berubah): baris kedua ditambahkan di bawah `namaItem`, menampilkan `Plat {item.plat}` -- HANYA muncul kalau item itu BBM. Item non-BBM di LPJ campur sama sekali tidak berubah tampilannya.
- **Kolom "SATUAN BOX/SHIFT/JAM"**: kolom ini SUDAH ADA di format asli tapi selalu kosong (tidak pernah diisi apa pun sebelumnya) -- dimanfaatkan untuk menampilkan teks "Liter" khusus baris BBM, sesuai maksud aslinya (kolom ini memang untuk satuan per-baris). Baris non-BBM tetap kosong seperti semula.
- Header tabel, jumlah kolom, lebar kolom, dan seluruh baris kosong/total di bawahnya **tidak disentuh sama sekali**.

## 20.3 Task Development — Bagian J

- [x] Tambah deteksi item BBM per-baris (`namaItem.startsWith('BBM ')`) di `LpjPdf.jsx`
- [x] Tampilkan Plat Nomor sebagai baris kedua di kolom URAIAN untuk item BBM
- [x] Isi kolom "SATUAN" (sebelumnya selalu kosong) dengan "Liter" untuk item BBM
- [x] Pastikan item non-BBM (termasuk di LPJ campur) tidak berubah tampilannya
- [x] `CI=true npm run build` sukses (0 warning/error), format tabel/kolom tidak diubah
- [ ] Verifikasi visual PDF asli di browser — butuh cetak ulang LPJ BBM sungguhan (khusus BBM & campur) oleh user

---

# BAGIAN K — Eksekusi 2 Temuan Keamanan Tertunda dari Bagian H (2026-09-02)

**Status: DI-DEPLOY KE PRODUKSI 2026-09-02** (`samudera-web-cbf2f`, bersama Bagian L — satu `firebase deploy` mencakup `firestore.rules`, `storage.rules`, seluruh Cloud Functions, dan Hosting). **Belum divalidasi end-to-end oleh user** — sesi ini tidak punya kredensial login asli, jadi verifikasi terbatas pada `CI=true npm run build`, `firebase deploy --dry-run` (rules compile, functions ter-load), dan hasil deploy sungguhan (13 functions semua Successful, termasuk retry 1x untuk `sendBsFinanceReminder` yang sempat gagal transient di percobaan pertama — root cause: `Unable to parse JSON: SyntaxError: Unexpected token '<'` dari Cloud Functions API, bukan error kode; retry langsung sukses). **WAJIB dijalankan segera oleh user** (lihat 21.4 & 21.5): klik tombol "Sinkronkan Direktori Pengguna" & "Sinkronkan Kepemilikan Dokumen" di Manage Users, lalu jalankan checklist tes manual — perubahan menyentuh alur inti (submit form, cetak PDF, halaman Detail) yang aktif dipakai untuk approval finansial.

## 21.1 Konteks

Dua temuan di Bagian H/18.4 ("Belum Diperbaiki, Perlu Keputusan User") diminta dieksekusi: (a) `storage.rules` yang mengizinkan siapa pun login menimpa lampiran di path manapun asal tahu/menebak path-nya, dan (b) rule `/users/{uid}` yang mengizinkan siapa pun login membaca profil LENGKAP user lain termasuk `bankName`/`accountNumber`. Riset kode saat eksekusi menemukan cakupan (b) jauh lebih besar dari dugaan awal di 18.4 — bukan cuma dipakai dropdown plat BBM, tapi juga PDF generator (`BsPdf.jsx`/`ReimbursementPdf.jsx`/`LpjPdf.jsx`) dan halaman Detail (`DetailBs/Rbs/Lpj.jsx`) yang membaca profil approver lain untuk menampilkan nama — dipakai Employee biasa saat lihat/cetak pengajuan miliknya sendiri, bukan cuma Admin.

## 21.2 Perbaikan (a): Storage Ownership

**Sebelumnya:** `storage.rules` mengizinkan `allow write: if signedIn()` tanpa syarat kepemilikan — siapa pun yang login bisa upload/menimpa file di path `Reimbursement/`, `BonSementara/`, `LPJ/`, `lampiran_lpj/` MANAPUN, asal tahu/menebak `displayId`-nya (nomor dokumen, formatnya cukup predictable: `RBS.BBM.{unitCode}.{YYMMDD}.{sequence}`).

**Perbaikan:**
- Koleksi Firestore baru `/displayIdOwners/{displayId}` — indeks kepemilikan `{uid}`, ditulis ATOMIK di transaksi yang sama saat `displayId` digenerate (`generateDisplayId()` di `FormRbsBbm.jsx`/`FormRbsOperasional.jsx`/`FormRbsUmum.jsx`/`FormLpjUmum.jsx`/`FormLpjMarketing.jsx`, dan transaksi nomor BS di `FormBs.jsx`) — tidak ada celah antara nomor dibuat & kepemilikannya tercatat. Rule-nya di `firestore.rules`: hanya bisa `create` oleh pemilik sendiri, tidak pernah bisa dibaca langsung oleh client (`allow get, list: if false`), tidak pernah bisa diubah/dihapus.
- `storage.rules` ditulis ulang: fungsi `isOwnerOfDisplayId(displayId)` & `isElevatedRole()` memakai `firestore.get()`/`firestore.exists()` (cross-service rules, otomatis bypass firestore.rules) untuk mengecek Firestore dari dalam Storage Rules. `displayId` diambil dari path (`Reimbursement/{category}/{displayId}/{fileName}` dst.) via Storage Rules wildcard, kecuali `lampiran_lpj/{fileName}` yang flat (`{displayId}_{namaFile}`) — diambil dari `fileName.split('_')[0]`.
- Write sekarang butuh: pemilik dokumen (`isOwnerOfDisplayId`) ATAU role elevated (Reviewer/Validator/Admin/Super Admin — dipakai saat Super Admin mengedit pengajuan lama & saat approver men-generate ulang PDF pengajuan orang lain).
- **Koreksi (ditemukan saat mengerjakan Bagian L di bawah):** klaim awal "aman tanpa backfill" HANYA benar untuk alur edit (Super-Admin-only, selalu lolos lewat `isElevatedRole()`). Ternyata ada alur LAIN yang menimpa/menulis ke path bertanda displayId dan bisa dipicu pemilik dokumen biasa (non-elevated) untuk dokumen LAMA: tombol **Print** di `DetailBs.jsx`/`DetailRbs.jsx`/`DetailLpj.jsx` dan **Cetak** di `ReimbursementTable.jsx` (keduanya meng-generate ulang PDF & upload ke Storage tiap kali diklik, bukan cuma sekali saat submit) — untuk dokumen yang dibuat SEBELUM Bagian K deploy, `displayIdOwners` belum punya entrinya, jadi pemilik sendiri akan gagal `permission-denied` saat mencetak dokumen approved miliknya sendiri. **Diperbaiki:** ditambahkan Cloud Function `backfillDisplayIdOwners` (Super Admin-only, idempotent, sama pola dengan `backfillUserDirectory`) + tombol **"Sinkronkan Kepemilikan Dokumen"** di halaman Manage Users — **WAJIB diklik sekali setelah deploy**, sebelum ada user yang mencoba mencetak dokumen lama (lihat 21.5 & 21.6 yang sudah diupdate).
- Dry-run compile berhasil (`firebase deploy --only firestore:rules,storage,functions --dry-run`).

## 21.3 Perbaikan (b): Proteksi Data Bank User — Koleksi `/userDirectory`

**Sebelumnya:** `allow read: if signedIn()` di `/users/{uid}` — siapa pun yang login bisa baca profil lengkap user LAIN, termasuk `bankName`/`accountNumber` (nomor rekening bank asli), lewat query langsung ke Firestore (bypass UI resmi).

**Perbaikan:**
- Koleksi mirror baru `/userDirectory/{uid}` — HANYA berisi field aman (`nama`, `role`, `unit`, `platKendaraan`), tidak pernah `bankName`/`accountNumber`. Disinkron otomatis oleh Cloud Function trigger `syncUserDirectoryOnWrite` (`onDocumentWritten('users/{uid}', ...)`) setiap kali dokumen `/users/{uid}` ditulis (baik lewat `createManagedUser`, update langsung client Super Admin di `FormEditUser.jsx`, maupun `deleteManagedUser`). Dibaca bebas oleh siapa pun yang login (`allow get, list: if signedIn()`), tidak pernah bisa ditulis client (`allow write: if false` — hanya Admin SDK).
- `/users/{uid}` diperketat: `get` hanya pemilik profil sendiri atau Super Admin; `list` hanya Super Admin, ATAU query yang provably discope ke email milik requester sendiri (`resource.data.email == request.auth.token.email` — dipakai fallback migrasi akun lama di `Login.jsx`).
- **Field-level protection makanya butuh koleksi terpisah** (bukan cukup ubah rule saja): Firestore Security Rules tidak bisa meredaksi field tertentu saat `read` — hanya bisa mengizinkan/menolak SELURUH dokumen. Karena banyak role (termasuk Employee biasa) butuh baca profil orang LAIN untuk kebutuhan legit (dropdown Reviewer/Validator, dropdown plat BBM lintas user, nama approver di PDF/Detail), me-restrict `/users/{uid}` langsung ke "pemilik atau Super Admin" akan MERUSAK semua fitur itu untuk Employee — makanya field aman dipisah ke koleksi baru yang boleh dibaca semua orang.
- **File client yang diubah** supaya baca dari `/userDirectory`, bukan `/users`, untuk kebutuhan lintas-user (self-lookup profil sendiri TETAP di `/users`, tidak diubah): `FormBs.jsx`, `FormRbsBbm.jsx`, `FormRbsOperasional.jsx`, `FormRbsUmum.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx` (dropdown Reviewer/Validator/plat), `BsPdf.jsx`, `ReimbursementPdf.jsx`, `LpjPdf.jsx` (nama approver di PDF), `DetailBs.jsx`, `DetailRbs.jsx`, `DetailLpj.jsx` (nama approver di halaman Detail).
- **File yang SENGAJA TIDAK diubah** (tetap baca `/users` langsung) karena sudah Super-Admin-only lewat `ProtectedRoute` (`allowedRoles={['Super Admin']}` di `App.jsx`) dan karena itu tetap lolos rule `isSuperAdmin()`: `ManageUser.jsx`, `ManageUserPage.jsx`, `FormAddUser.jsx`, `FormEditUser.jsx`, `ReportExport.jsx`. Mode edit Super Admin di 5 form RBS/LPJ (`getDoc(doc(db,'users', editData.user.uid))`) juga sengaja tidak diubah dengan alasan sama.

## 21.4 Migrasi Data Lama — Wajib Dijalankan Sekali Setelah Deploy

Trigger `syncUserDirectoryOnWrite` HANYA jalan untuk write BARU ke `/users` — tidak retroaktif ke user yang sudah ada sebelum fitur ini live. Ditambahkan Cloud Function `backfillUserDirectory` (`onCall`, Super Admin-only, idempotent/aman diklik berkali-kali) yang mengisi `/userDirectory` untuk SEMUA user existing sekaligus.

**Cara pakai:** dua tombol baru di halaman Manage Users (`ManageUser.jsx`, pojok kanan judul halaman) — **WAJIB diklik SEKALI oleh Super Admin setelah `firestore.rules`, `storage.rules`, dan `functions` di-deploy**:
1. **"Sinkronkan Direktori Pengguna"** (`backfillUserDirectory`) — isi `/userDirectory` untuk semua user existing. Tanpa ini, dropdown Reviewer/Validator/plat BBM & nama approver di PDF/Detail kosong/gagal untuk user yang belum pernah di-edit ulang sejak deploy.
2. **"Sinkronkan Kepemilikan Dokumen"** (`backfillDisplayIdOwners`) — isi `/displayIdOwners` untuk semua dokumen `bonSementara`/`reimbursement`/`lpj` existing. Tanpa ini, pemilik dokumen LAMA akan gagal `permission-denied` saat mencetak ulang PDF miliknya sendiri (lihat koreksi di 21.2).

## 21.5 Yang WAJIB Ditest Manual Sebelum Deploy ke Produksi

Sesi ini tidak punya kredensial login asli (sama seperti keterbatasan di semua bagian sebelumnya) — jadi TIDAK ADA satupun perubahan di bagian ini yang sudah dites end-to-end di browser. Sebelum deploy, tes minimal:
- [ ] Submit pengajuan baru (RBS BBM/Operasional/Umum, LPJ Umum/Marketing, BS) sebagai Employee biasa — pastikan dropdown Reviewer/Validator & plat BBM tetap terisi (setelah klik "Sinkronkan Direktori Pengguna" di Manage Users pasca-deploy), dan upload lampiran tetap berhasil.
- [ ] Lihat halaman Detail (DetailBs/Rbs/Lpj) untuk pengajuan yang sudah ada approval — pastikan nama Reviewer/Validator tetap tampil (bukan kosong/error).
- [ ] Cetak PDF (RBS Form, LPJ, & BS) untuk pengajuan LAMA yang sudah Disetujui (dibuat SEBELUM deploy Bagian K) — pastikan nama approver tetap muncul di PDF, dan proses cetak (yang re-upload PDF ke Storage) TIDAK gagal permission-denied setelah klik "Sinkronkan Kepemilikan Dokumen".
- [ ] Super Admin: edit pengajuan RBS/LPJ lama (re-upload lampiran) — pastikan tetap berhasil (jalur elevated-role di storage.rules).
- [ ] Super Admin: buka Manage Users → Tambah/Edit Pengguna — pastikan masih berfungsi normal (tidak disentuh, tapi baca `/users` langsung jadi perlu dipastikan rule `isSuperAdmin()` tidak ikut kena dampak).
- [ ] Klik kedua tombol sinkronisasi setelah deploy, konfirmasi toast sukses & jumlah tersinkron sesuai jumlah user/dokumen aktif.
- [ ] (Lihat juga 22.5 di Bagian L untuk tes fitur "Send Reminder to Finance".)

## 21.6 Task Development — Bagian K

- [x] `firestore.rules`: koleksi baru `/displayIdOwners/{displayId}` (indeks kepemilikan, create-only oleh pemilik)
- [x] `storage.rules`: ditulis ulang, write butuh `isOwnerOfDisplayId()` atau `isElevatedRole()` (cross-service `firestore.get()`), bukan `signedIn()` polos
- [x] 6 form (`FormBs.jsx` + 5 form RBS/LPJ): tulis `displayIdOwners/{displayId}` atomik di transaksi yang sama dengan generate nomor dokumen
- [x] `firestore.rules`: `/users/{uid}` diperketat (`get`: pemilik/Super Admin; `list`: Super Admin atau self-email-scoped)
- [x] `firestore.rules`: koleksi baru `/userDirectory/{uid}` (field aman saja, `write: if false`)
- [x] `functions/index.js`: trigger `syncUserDirectoryOnWrite` (auto-mirror `/users` → `/userDirectory`) + callable `backfillUserDirectory` (migrasi satu-kali, Super Admin-only, idempotent)
- [x] 11 file client dipindah baca dari `/users` ke `/userDirectory` untuk lookup lintas-user (form picker, PDF generator, halaman Detail) — self-lookup & halaman Super-Admin-only sengaja tidak disentuh
- [x] Tombol "Sinkronkan Direktori Pengguna" di `ManageUser.jsx`
- [x] **(Koreksi)** `functions/index.js`: callable `backfillDisplayIdOwners` (migrasi satu-kali dokumen BS/RBS/LPJ lama ke `/displayIdOwners`, Super Admin-only, idempotent) + tombol "Sinkronkan Kepemilikan Dokumen" di `ManageUser.jsx`
- [x] `CI=true npm run build` sukses (0 warning/error)
- [x] `firebase deploy --only firestore:rules,storage,functions --dry-run` sukses (rules compile, functions ter-load tanpa error)
- [x] **DEPLOY KE PRODUKSI selesai 2026-09-02** (`firestore.rules`, `storage.rules`, 13 Cloud Functions, Hosting)
- [ ] **Tes manual oleh user (lihat 21.5) — WAJIB, dijalankan setelah deploy**
- [ ] Klik KEDUA tombol sinkronisasi di Manage Users sekali untuk backfill user & dokumen lama

## 21.7 Perbaikan Tambahan: Upload Gambar Pengumuman Selalu Gagal (ditemukan & diperbaiki 2026-09-02, setelah deploy awal)

Saat diminta cek "hal lain yang perlu diperhatikan" pasca-deploy, ditemukan bug pra-eksisting (BUKAN regresi dari perubahan di atas — sudah begini sebelum sesi ini dimulai): `AnnouncementManager.jsx` (halaman "Manage Announcements", Super Admin-only) upload gambar pengumuman ke path Storage `announcements/{fileName}`, tapi `storage.rules` **tidak pernah punya rule untuk path ini** — jatuh ke `allow read, write: if false` di paling bawah. Artinya upload/hapus gambar pengumuman kemungkinan besar SELALU gagal `permission-denied` sejak fitur ini dibuat, terlepas dari role.

**Perbaikan:** ditambahkan match block `announcements/{fileName}` di `storage.rules` — `read` untuk siapa saja yang login (dipakai `AnnouncementPopup.jsx` menampilkan ke semua user), `create`/`update` khusus Super Admin (`isSuperAdminRole()`, cross-service `firestore.get()` seperti fungsi lain di file ini) + validasi `validImageUpload()` (harus `image/*`, maks 5MB — disamakan dengan validasi client `MAX_FILE_SIZE_MB` di `AnnouncementManager.jsx`), dan `delete` dipisah dari `create`/`update` (Storage Rules tidak mengirim `request.resource` saat delete, jadi kalau digabung ke satu `allow write` yang mensyaratkan `validImageUpload()`, delete akan SELALU gagal — detail teknis yang perlu diingat kalau menambah pola serupa lagi nanti).

**Deploy:** sudah di-deploy terpisah (`firebase deploy --only storage`), dry-run compile sukses lebih dulu. Tidak menyentuh `firestore.rules`/`functions`/hosting, jadi risikonya kecil & terisolasi dari perubahan Bagian K/L lainnya.

- [x] Tambah rule `announcements/{fileName}` di `storage.rules` (read: signedIn, create/update: Super Admin + validasi gambar, delete: Super Admin terpisah)
- [x] Dry-run compile sukses, deploy ke produksi sukses
- [ ] Tes manual: Super Admin upload & hapus gambar pengumuman di Manage Announcements, konfirmasi tidak lagi permission-denied

## 21.8 INSIDEN KRITIS: Rollback `storage.rules` — Cross-Service `firestore.get()` Terbukti Tidak Bekerja di Produksi (2026-09-02)

**Ditemukan lewat laporan user:** setelah deploy Bagian K/L & backfill dijalankan, tombol "Send Reminder to Finance" tetap gagal 403 (`storage/unauthorized`) saat generate PDF BS.

**Proses diagnosa:** dibuat Cloud Function debug sementara (`debugCheckDisplayIdOwnership`, sudah dihapus dari kode — TAPI **masih ter-deploy di produksi**, lihat catatan di 21.9) yang membaca langsung via Admin SDK (bypass rules). Hasilnya: `requesterUid`, `ownerDocUid` (dari `/displayIdOwners`), dan `bsUserUid` (dari dokumen `bonSementara`) **ketiganya cocok persis** — data 100% benar. Sebagai tes lanjutan, rule `allow get, list` untuk `/displayIdOwners` di `firestore.rules` sempat dibuka sementara jadi `true` (data di koleksi ini tidak sensitif — cuma pemetaan nomor dokumen→uid) untuk menyingkirkan kemungkinan Firestore Rules-nya sendiri yang menghalangi pembacaan cross-service. **Hasilnya TETAP 403** — membuktikan masalahnya BUKAN di data maupun di Firestore Rules, melainkan mekanisme `firestore.get()`/`firestore.exists()` (cross-service rules dari Storage Rules ke Firestore, dipakai `isOwnerOfDisplayId()` & `isElevatedRole()`/`isSuperAdminRole()` di `storage.rules`) **tidak berfungsi sama sekali di proyek ini**, walau terdokumentasi resmi oleh Firebase dan berhasil `dry-run`/lolos compile setiap kali dideploy.

**Dampak yang BARU disadari:** karena `isElevatedRole()` memakai mekanisme cross-service yang SAMA, ini berarti bukan cuma fitur baru (Reminder Finance) yang terdampak — **tombol Print/Cetak PDF di semua halaman Detail BS/RBS/LPJ dan ReimbursementTable.jsx kemungkinan besar gagal untuk SEMUA user, termasuk Super Admin**, sejak Bagian K di-deploy. Rule `announcements/{fileName}` dari 21.7 (pakai `isSuperAdminRole()`, mekanisme sama) kemungkinan besar juga tidak pernah benar-benar berfungsi walau sempat "berhasil" di-deploy.

**Rollback yang dilakukan:** `storage.rules` ditulis ulang total, SELURUH fungsi `firestore.get()`/`firestore.exists()` cross-service dihapus. Write untuk `Reimbursement/`, `BonSementara/`, `LPJ/`, `lampiran_lpj/` kembali ke `allow write: if signedIn() && validPdfUpload()` (persis seperti sebelum Bagian K — kepemilikan per-displayId TIDAK divalidasi lagi di level Storage Rules untuk sementara). `announcements/{fileName}` juga disederhanakan jadi `signedIn() && validImageUpload()` (tanpa syarat Super Admin di level Storage — Firestore Rules `/announcements` tetap membatasi siapa yang bisa membuat entri metadata-nya). Validasi tipe/ukuran file (`validPdfUpload()`, `validImageUpload()`) TETAP dipertahankan karena terbukti bekerja (murni `request.resource`, tidak butuh cross-service).

`firestore.rules`: rule `/displayIdOwners` dikembalikan ke `allow get, list: if false` (percobaan diagnosa selesai). Koleksi ini & penulisannya di 6 form (FormBs.jsx dkk, lihat 21.2) TIDAK dihapus — datanya tetap valid & berguna kalau desain ownership storage diperbaiki nanti pakai mekanisme lain.

**PENTING — status keamanan setelah rollback:** perlindungan "siapa boleh timpa lampiran/PDF di path Storage" untuk SEMENTARA kembali ke level SEBELUM Bagian K (siapa pun yang login bisa upload ke path manapun asal tahu/menebak `displayId`-nya — celah yang sama seperti dilaporkan di Bagian H/18.4). Proteksi PII di `/users` vs `/userDirectory` (Bagian K bagian lain, murni Firestore Rules biasa — BUKAN cross-service, jadi TIDAK terdampak isu ini) **tetap aktif dan aman**.

**Rencana perbaikan proper (belum dikerjakan, untuk sesi berikutnya):** ganti mekanisme ownership check yang tidak butuh `firestore.get()` dari Storage Rules — dua opsi utama:
1. **Firebase Auth custom claims** (mis. `role` di-set sebagai custom claim lewat Cloud Function tiap kali dokumen `/users/{uid}` berubah, lalu di Storage Rules cukup baca `request.auth.token.role` — tidak perlu baca Firestore sama sekali). Kepemilikan per-displayId lebih sulit lewat custom claims (terlalu dinamis untuk taruh di token), jadi mungkin perlu digabung opsi 2.
2. **Upload lewat Cloud Function (Admin SDK)** alih-alih langsung dari client ke Storage — Cloud Function bisa validasi kepemilikan via Firestore (query biasa, BUKAN cross-service, terbukti selalu bekerja di seluruh `functions/index.js`) sebelum menulis ke Storage pakai Admin SDK yang otomatis bypass semua rules.

## 21.9 Belum Dibersihkan — Perlu Deploy Susulan

- [x] **Deploy ROLLBACK ini** (`storage.rules` & `firestore.rules`) — **dikonfirmasi & dieksekusi 2026-09-03 pagi**. Ternyata `firestore.rules` sudah ter-deploy duluan (CLI: "latest version already up to date, skipping upload"), TAPI **`storage.rules` — file yang justru berisi rules bermasalah — belum pernah ter-upload ke produksi sebelumnya** (CLI baru menunjukkan "uploading rules storage.rules... released" saat dijalankan pagi ini). Artinya rollback storage rules baru benar-benar live mulai 2026-09-03, bukan 2026-09-02 seperti diasumsikan sebelumnya — ini kemungkinan besar penjelasan kendala yang masih dilaporkan user pagi harinya.
- [x] Function `debugCheckDisplayIdOwnership` — dicek via `firebase functions:list` (2026-09-03), TIDAK ada lagi di produksi. Sudah bersih (kemungkinan terbersihkan otomatis lewat deploy `--only functions` sebelumnya).
- [ ] Setelah rollback storage.rules dikonfirmasi jalan (Print PDF & Reminder Finance berhasil lagi untuk user biasa), verifikasi ULANG bahwa Super Admin juga masih bisa Print PDF & edit pengajuan lama (fitur yang tadinya mengandalkan `isElevatedRole()` yang ternyata rusak sejak awal deploy Bagian K).

---

# BAGIAN L — Aksi "Send Reminder to Finance" di Tabel BS (2026-09-02)

**Status: DI-DEPLOY KE PRODUKSI 2026-09-02** bersama Bagian K (satu `firebase deploy`, sesuai kebutuhan — fitur ini bergantung pada `displayIdOwners`/`userDirectory` dari Bagian K). **Belum divalidasi end-to-end oleh user** — lihat catatan keterbatasan di Bagian K, dan checklist tes wajib di 22.5.

## 22.1 Permintaan User

Di kolom Aksi tabel "Bon Sementara Diajukan" (`BsTable.jsx`), untuk BS yang sudah berstatus Disetujui, tambahkan tombol **"Send Reminder to Finance"**. Finance = user dengan role Validator. Saat diklik, kirim email ke Finance dengan narasi "Mohon dibantu maker atas BS berikut" + detail BS (format tabel sama seperti email notifikasi yang sudah ada) + lampiran PDF BS (format sama seperti hasil "Print").

Kompleksitas tambahan: sebagian karyawan terdaftar di lebih dari satu Unit Bisnis (perusahaan) di profilnya, sebagian cuma satu.
- **Terdaftar di 1 Unit Bisnis saja** → email otomatis terkirim ke Finance (Validator) yang ditugaskan di unit itu, tanpa perlu memilih.
- **Terdaftar di lebih dari 1 Unit Bisnis** → tampilkan pilihan (semua Validator yang ditugaskan di salah satu Unit Bisnis milik karyawan tsb), user memilih satu untuk dikirimi reminder.

## 22.2 Implementasi

**Sumber data kandidat Finance (client, `BsTable.jsx`):**
- Unit Bisnis milik user yang login: `getDoc(doc(db,'users', uid))` (self-read, field `unit` array) — sama seperti field yang sudah dipakai `FormAddUser.jsx`/`FormEditUser.jsx` untuk assignment Validator-per-unit.
- Semua user role Validator: query `userDirectory` (BUKAN `users` langsung — mengikuti pola Bagian K, cukup field aman nama/role/unit) `where('role','==','Validator')`.
- Kandidat = Validator yang `unit`-nya beririsan dengan Unit Bisnis milik submitter.

**Alur klik tombol (`handleSendFinanceReminder`):**
- 0 kandidat → toast error "Tidak ada Finance terdaftar untuk Unit Bisnis Anda. Hubungi Admin."
- Submitter cuma terdaftar di 1 Unit Bisnis → langsung kirim ke SEMUA kandidat (Firestore biasanya cuma 1 Validator per unit, tapi kalau lebih dari 1 sengaja dikirim ke semua supaya tidak ada yang terlewat, bukan menebak salah satu).
- Submitter terdaftar di 2+ Unit Bisnis → modal custom (portal, pola sama seperti `actionMenu` di `ReimbursementTable.jsx`) menampilkan daftar kandidat (nama + unit), user klik satu untuk kirim.

**Kirim reminder (`sendFinanceReminder`):**
1. Client generate PDF BS via `generateBsPDF(item)` (fungsi yang SAMA dipakai tombol Print di `DetailBs.jsx` — tidak ada logic baru, upload ke Storage `BonSementara/{kategori}/{displayId}/{displayId}.pdf`, return `downloadURL`).
2. Client panggil Cloud Function baru `sendBsFinanceReminder({ bsId, validatorUid, pdfUrl })`.
3. Cloud Function (`functions/index.js`):
   - Validasi: caller harus login, harus pemilik BS tsb (`bsData.user.uid === request.auth.uid`), BS harus berstatus Disetujui.
   - Ambil data Validator (Admin SDK, akses penuh termasuk email) & submitter, validasi Validator memang role `Validator` dan **defense-in-depth**: unit Validator harus beririsan dengan unit submitter (supaya `validatorUid` yang direkayasa dari client tidak bisa dipakai kirim ke Validator unit lain).
   - `fetch(pdfUrl)` (downloadURL Storage sudah bawa token akses sendiri, tidak butuh Admin SDK Storage) → buffer → lampirkan ke email sebagai PDF asli hasil generate, bukan link.
   - Kirim email lewat `sendEmail()` (diperluas terima parameter `attachments`) memakai `createEmailTemplate()` yang SAMA dipakai notifikasi lain (kasus baru `status: 'financeReminder'`, header "Reminder untuk Finance") — tabel detail BS (Nomor BS, Jumlah BS) otomatis konsisten dengan format notifikasi existing karena fungsi ini dipakai ulang, bukan dibuat baru.

## 22.3 Kenapa Bergantung pada Bagian K

Fitur ini butuh dua hal yang baru ada setelah Bagian K:
- `userDirectory` untuk cari daftar Validator tanpa membuka akses baca `bankName`/`accountNumber` semua user ke setiap karyawan yang buka tabel BS-nya sendiri.
- `displayIdOwners` (+ tombol "Sinkronkan Kepemilikan Dokumen") supaya `generateBsPDF` (dipanggil ulang di sini, sama seperti tombol Print) tidak gagal `permission-denied` untuk BS lama.

Karena itu Bagian K & L **harus di-deploy bersamaan** — men-deploy L tanpa K (atau sebaliknya) akan membuat fitur reminder gagal total (userDirectory/displayIdOwners belum ada).

## 22.4 Keterbatasan & Keputusan Desain

- Tidak ada penanda persisten "reminder sudah dikirim" (beda dengan pola "Reported"/"Transferred" di Bagian F) — user tidak memintanya, jadi tidak ditambahkan supaya tidak over-engineering. Kalau dibutuhkan nanti, tinggal tambah field `financeReminderSentAt` di dokumen BS + label serupa.
- Kalau 1 Unit Bisnis punya lebih dari 1 Validator, mode "otomatis" (submitter cuma 1 unit) mengirim ke SEMUA Validator unit itu sekaligus (bukan cuma 1) — belum dikonfirmasi ke user apakah ini perilaku yang diinginkan atau harusnya cuma ke 1 Validator tertentu; kalau ternyata harus 1 orang spesifik, perlu field tambahan (mis. "Validator utama") di profil user/unit.
- Narasi email persis mengikuti permintaan ("Mohon dibantu maker atas BS berikut") — kalau "maker" ternyata typo/istilah yang dimaksud berbeda (mis. "mohon dibantu proses"), tinggal ubah satu baris `emailContent` di `sendBsFinanceReminder` (`functions/index.js`).

## 22.5 Yang WAJIB Ditest Manual Sebelum Deploy

- [ ] Login sebagai Employee yang HANYA terdaftar di 1 Unit Bisnis, BS Disetujui → klik "Send Reminder to Finance" → email harus langsung terkirim TANPA modal pilihan, ke Validator unit tsb, dengan PDF BS terlampir & narasi benar.
- [ ] Login sebagai Employee yang terdaftar di 2+ Unit Bisnis → klik tombol yang sama → modal pilihan Finance harus muncul, daftar Validator sesuai unit-unit yang terdaftar di profil, pilih satu → email cuma terkirim ke yang dipilih.
- [ ] BS yang belum Disetujui → tombol "Send Reminder to Finance" tidak muncul (tetap "Batalkan" seperti biasa).
- [ ] Cek inbox Validator penerima: subjek, narasi "Mohon dibantu maker atas BS berikut", tabel detail (Nomor BS, Jumlah BS) tampil benar, dan lampiran PDF bisa dibuka & isinya sama seperti hasil "Print" di Detail BS.
- [ ] Coba BS yang dibuat SEBELUM deploy Bagian K/L (setelah klik "Sinkronkan Kepemilikan Dokumen") — pastikan generate PDF untuk reminder tidak gagal permission-denied.

## 22.6 Task Development — Bagian L

- [x] `functions/index.js`: `sendEmail()` diperluas terima `attachments`
- [x] `functions/index.js`: `createEmailTemplate()` tambah case `'financeReminder'`
- [x] `functions/index.js`: callable baru `sendBsFinanceReminder` (validasi pemilik+status, defense-in-depth unit match, fetch PDF dari Storage URL, kirim email+lampiran)
- [x] `BsTable.jsx`: fetch unit submitter (self) + daftar Validator (`userDirectory`)
- [x] `BsTable.jsx`: tombol "Send Reminder to Finance" di kolom Aksi (khusus status Disetujui), auto-send (1 unit) vs modal pilihan (2+ unit)
- [x] `CI=true npm run build` sukses (0 warning/error)
- [x] `firebase deploy --only functions --dry-run` sukses (function ter-load tanpa error)
- [ ] **Tes manual oleh user (lihat 22.5) — WAJIB sebelum deploy ke produksi**
- [ ] Deploy BERSAMAAN dengan Bagian K (rules + functions + hosting satu paket)

---

# BAGIAN M — Bug Kritis: Field `uid` Hilang di `/userDirectory`, Blokir Semua Pengajuan RBS/LPJ/BS (ditemukan & diperbaiki 2026-09-03)

## 23.1 Laporan User

Setelah rollback `storage.rules` di Bagian K/21.8 dikonfirmasi & dideploy (Print PDF berhasil kembali), user melaporkan error baru saat submit pengajuan RBS: toast **"Reviewer 1 dan Reviewer 2 tidak boleh sama"** muncul terus-menerus walau Reviewer 1 (Bernard Hutagaol) dan Reviewer 2 (Joko Susilo) jelas berbeda orang.

## 23.2 Root Cause

`buildUserDirectoryEntry()` di `functions/index.js` (dibuat saat Bagian K, lihat 21.6) — fungsi yang membentuk isi dokumen `/userDirectory/{uid}` — **tidak menyertakan field `uid`** sama sekali, hanya `nama`, `role`, `unit`, `platKendaraan`. Semua form (`FormBs.jsx`, `FormRbsBbm/Operasional/Umum.jsx`, `FormLpjUmum/Marketing.jsx`) membangun opsi dropdown Reviewer/Validator dengan `value: userData.uid` (pola yang sama dipakai untuk `/users`, yang memang selalu punya field `uid` — lihat `createManagedUser` di `functions/index.js`). Karena `/userDirectory` tidak punya field itu, **setiap opsi dropdown Reviewer/Validator punya `value: undefined`** — apa pun yang dipilih user.

Dampaknya: perbandingan `selectedReviewer1.value === selectedReviewer2.value` (`undefined === undefined`) SELALU `true`, sehingga validasi "tidak boleh sama" salah nyala setiap kali Reviewer 1 DAN Reviewer 2 sama-sama sudah dipilih — **memblokir SEMUA submit RBS/LPJ/BS baru** sejak Bagian K live (2026-09-02), terlepas dari kombinasi reviewer yang dipilih. Bug ini murni di sisi Cloud Function (bukan di 6 form client), jadi 1 titik perbaikan menyelesaikan semua form sekaligus.

## 23.3 Perbaikan

`functions/index.js`: `buildUserDirectoryEntry` diubah jadi menerima parameter `uid` eksplisit dan menyertakannya di dokumen yang ditulis:
- `syncUserDirectoryOnWrite` (trigger otomatis): `buildUserDirectoryEntry(uid, event.data.after.data())` — `uid` diambil dari `event.params.uid` (path trigger), bukan dari field di data (lebih aman, tidak bergantung ke `data.uid` yang bisa saja hilang/salah).
- `backfillUserDirectory` (migrasi manual): `buildUserDirectoryEntry(userDoc.id, userDoc.data())`.

**Deploy:** `firebase deploy --only functions:syncUserDirectoryOnWrite,functions:backfillUserDirectory` — sukses 2026-09-03 (percobaan pertama & kedua sempat gagal `Timeout after 10000` saat firebase-tools memuat kode, tampaknya flaky lokal karena cold-load module besar di Windows — percobaan ketiga berhasil tanpa perubahan apa pun).

## 23.4 WAJIB Dilakukan Setelah Deploy Ini

Trigger yang sudah diperbaiki hanya berlaku untuk write BARU ke `/users` ke depannya. **Dokumen `/userDirectory` yang SUDAH ADA sebelum fix ini tetap tidak punya field `uid`** sampai di-backfill ulang.

- [x] **Super Admin klik tombol "Sinkronkan Direktori Pengguna" di halaman Manage Users SEKALI LAGI** — **dikonfirmasi berhasil 2026-09-03** ("Direktori pengguna disinkronkan (55 pengguna)"), mengisi field `uid` yang tadinya hilang di SEMUA dokumen `/userDirectory` existing.
- [x] Setelah backfill, tes submit RBS baru dengan Reviewer 1 & Reviewer 2 berbeda — **dikonfirmasi user, toast "tidak boleh sama" tidak muncul lagi**.
- [ ] Cek juga: dropdown Validator, dropdown plat BBM lintas user, dan nama approver di PDF/Detail — semuanya sama-sama bergantung pada `userData.uid` dari `/userDirectory`, jadi kemungkinan juga ikut terdampak bug ini (misal approval routing `currentApproverUid` tersimpan `undefined` untuk dokumen yang sempat coba disubmit saat bug ini aktif — perlu dicek apakah ada dokumen "nyasar" yang perlu dibersihkan manual).

## 23.5 Task Development — Bagian M

- [x] `functions/index.js`: `buildUserDirectoryEntry` menerima & menyertakan `uid`
- [x] Update 2 call site (`syncUserDirectoryOnWrite`, `backfillUserDirectory`)
- [x] `node -c` syntax check & isolated `require()` test sukses
- [x] `CI=true npm run build` sukses (0 warning/error, tidak ada perubahan client)
- [x] Deploy `functions:syncUserDirectoryOnWrite,functions:backfillUserDirectory` ke produksi sukses (2026-09-03)
- [x] Super Admin klik ulang "Sinkronkan Direktori Pengguna" — selesai, lihat 23.4
- [x] Tes manual submit RBS/LPJ/BS baru pasca-backfill — berhasil, dikonfirmasi user

---

# BAGIAN N — Rapikan Kolom Aksi: Tombol Reminder Jadi Icon, Tambah Icon di Menu Transferred (2026-09-03)

## 24.1 Permintaan User

Kolom Aksi di `BsTable.jsx` terasa penuh karena tulisan "Send Reminder to Finance" berulang di tiap baris. User minta diganti icon saja (hemat tempat). User juga minta item "Transferred" di dropdown "Cetak" (`ReimbursementTable.jsx`) dirapikan — bebas bentuk icon atau tulisan, asal rapi & bersih.

## 24.2 Perubahan (Iterasi 1)

- `BsTable.jsx`: tombol "Send Reminder to Finance" (kolom Aksi, BS berstatus Disetujui) diganti icon-only `faEnvelope` (FontAwesome), dengan `title="Send Reminder to Finance"` untuk tooltip/aksesibilitas. State loading tetap `faSpinner` seperti sebelumnya.
- `ReimbursementTable.jsx`: item "Transferred" di dropdown "Cetak" (`actionMenu`) ditambah icon — `faMoneyBillWave` untuk aksi yang belum di-Transferred, `faCheckCircle` untuk status yang sudah Transferred (menggantikan karakter `&#10003;` manual).

## 24.3 Revisi (Iterasi 2, 2026-09-03) — Dropdown "Cetak" Dihapus Total di `ReimbursementTable.jsx`

Setelah lihat hasil, user klarifikasi maksudnya lebih jauh: dropdown "Cetak" (Print RBS Form/Print Lampiran/Print Both) di kolom Aksi tabel Reimbursement/RBS dianggap tidak perlu — cukup sisakan aksi **Transferred** saja, langsung sebagai icon tanpa dropdown.

**Verifikasi sebelum eksekusi:** dicek dulu apakah 3 opsi Print itu satu-satunya jalan cetak PDF RBS — ternyata TIDAK, `DetailRbs.jsx` (halaman Detail RBS, dibuka lewat klik nomor dokumen) sudah punya tombol "Print" sendiri (baris ~660, pakai `generateReimbursementPDF` yang sama). Jadi dropdown Cetak di tabel murni shortcut duplikat, aman dihapus tanpa menghilangkan fitur cetak dari aplikasi (pola sama seperti `DetailBs.jsx` untuk BS).

**Perubahan:**
- `ReimbursementTable.jsx`: dihapus total — `actionMenu` state, `printLoadingId` state, fungsi `openActionMenu`/`closeActionMenu`/`handlePrintRbsForm`/`handlePrintLampiran`/`handlePrintBoth`, portal dropdown (`ReactDOM.createPortal`), dan import `generateReimbursementPDF`/`ReactDOM`/`faSpinner` yang jadi tidak terpakai.
- Kolom Aksi (baris berstatus Disetujui) sekarang langsung tombol icon `faMoneyBillWave` (klik = `handleMarkTransferred`), berubah jadi icon `faCheckCircle` non-aktif setelah sudah ditandai Transferred — tanpa dropdown, konsisten dengan gaya icon-only "Send Reminder to Finance" di `BsTable.jsx`.
- `utils/ReimbursementPdf.jsx` (`generateReimbursementPDF`) TIDAK dihapus — masih dipakai `DetailRbs.jsx` untuk tombol Print di halaman Detail.

## 24.4 Task Development — Bagian N

- [x] `BsTable.jsx`: import `faEnvelope`, ganti label tombol reminder jadi icon
- [x] `ReimbursementTable.jsx`: tambah icon di dropdown Transferred (iterasi 1)
- [x] `ReimbursementTable.jsx`: hapus dropdown Cetak & 3 opsi Print, ganti Aksi jadi icon Transferred langsung (iterasi 2, setelah verifikasi Print masih ada di `DetailRbs.jsx`)
- [x] `CI=true npm run build` sukses (0 warning/error, bundle size turun ~750B karena dead code print handler & portal dropdown terhapus)
- [x] Deploy hosting ke produksi (iterasi 2) — sukses 2026-09-03
- [ ] Tes visual & fungsional: kolom Aksi RBS tampil icon Transferred langsung tanpa dropdown, klik berhasil menandai transferred, icon berubah jadi centang & non-klik setelahnya; pastikan Print RBS Form/Lampiran/Both masih bisa diakses lewat halaman Detail RBS

---

# BAGIAN O — Icon Badge, Multi-Lampiran Digabung, & Validasi Bukti Pengembalian LPJ (2026-09-05)

## 25.1 Permintaan User

Tiga permintaan terpisah dalam satu sesi:
1. Badge kecil "Transferred" (RBS, dekat nomor dokumen) & "Reported" (BS) diganti icon saja, tulisan baru muncul saat disorot (tooltip).
2. Lampiran RBS/LPJ bisa upload lebih dari 1 file, bebas PDF/JPG/PNG, tapi saat dibuka di Detail tetap tampil sebagai 1 file (digabung).
3. LPJ: kalau BS ada pengembalian ke perusahaan (`sisaLebih > 0`), muncul upload bukti pengembalian (opsional, PDF/JPG/PNG) yang divalidasi otomatis (baca isi file, cocokkan nominal). Kalau di-skip atau tidak sesuai, sistem kirim reminder email tiap 2 hari (mulai 2 hari setelah submit) sampai bukti valid diupload, ke pengaju, mengarahkan ke Detail LPJ untuk upload.

Dua keputusan teknis dikonfirmasi user sebelum eksekusi: OCR pakai **Google Cloud Vision API** (bukan Tesseract.js gratis atau validasi manual), reminder **setiap 2 hari sejak submit**.

## 25.2 Icon Badge (Item 1)

- `ReimbursementTable.jsx`: badge "Transferred" (dekat nomor dokumen) jadi `faMoneyBillWave` + `title="Transferred"` (tooltip native browser saat hover).
- `BsTable.jsx`: badge "Reported" jadi `faFileCircleCheck` + `title="Reported"`.

## 25.3 Multi-Lampiran Digabung Jadi 1 PDF (Item 2)

**Temuan saat investigasi:** kode lama sudah punya multi-file upload di 3 form RBS (BBM/Operasional/Umum) tapi menyimpan `lampiranUrl` sebagai ARRAY berisi banyak URL terpisah — sementara `DetailRbs.jsx`/`DetailLpj.jsx` (`handleViewAttachment`) selalu mengasumsikan `lampiranUrl` STRING tunggal. Artinya submit RBS dengan 2+ lampiran sebenarnya **sudah lama rusak** (tombol "Lihat Lampiran" gagal terbuka) — bug ini baru kesentuh sekarang lewat permintaan user. `FormLpjUmum.jsx`/`FormLpjMarketing.jsx` malah sebaliknya: UI kelihatan multi-select tapi `handleFileUpload` cuma ambil `files[0]` dan SELALU replace (bukan multi beneran).

**Solusi:** `src/utils/attachmentUpload.js` (baru) — `mergeAttachmentsToPdf()` pakai `pdf-lib` (sudah jadi dependency, belum pernah dipakai untuk ini): PDF disalin apa adanya per halaman, JPG/PNG dikonversi jadi 1 halaman PDF ukuran A4 (di-scale proporsional). Semua lampiran yang dipilih user digabung jadi SATU file PDF SEBELUM diupload, jadi `lampiranUrl` tetap string tunggal seperti yang diharapkan Detail — tidak perlu ubah apapun di `DetailRbs.jsx`/`DetailLpj.jsx`.

Diterapkan konsisten di 5 form: `FormRbsBbm.jsx`, `FormRbsOperasional.jsx`, `FormRbsUmum.jsx`, `FormLpjUmum.jsx`, `FormLpjMarketing.jsx` — `accept` diperluas ke `.pdf,.jpg,.jpeg,.png`, validasi file (`isValidAttachmentFile`, cek signature byte pertama seperti pola `isValidPdfFile` yang sudah ada) juga menerima gambar, dan 2 form LPJ yang tadinya single-file sekarang benar-benar multi (append, bukan replace) dengan `removeAttachment` per-index yang benar.

## 25.4 Validasi Bukti Pengembalian LPJ (Item 3)

**Skema baru di dokumen `lpj`:** `pengembalianBuktiUrl`, `pengembalianStatus` (`valid` / `tidak_sesuai` / `gagal_baca` / kosong = belum upload), `pengembalianValidationNote` (teks OCR, untuk audit manual kalau perlu), `pengembalianUploadedAt`, `pengembalianLastReminderAt`, `pengembalianReminderCount`. `sisaLebih` (sudah ada sejak dulu lewat `calculatedCosts`) dipakai sebagai penentu apakah fitur ini aktif untuk LPJ tsb.

**Upload & validasi (`src/utils/pengembalianUpload.js`, baru):** file bukti diupload APA ADANYA ke Storage path baru `lpj_pengembalian/{displayId}/...` (BUKAN digabung/dikonversi seperti lampiran biasa — Cloud Vision perlu baca file aslinya), lalu client panggil Cloud Function `validatePengembalianBukti` (onCall).

**`functions/index.js`:**
- `extractTextFromBuktiFile()`: gambar pakai `visionClient.textDetection()`, PDF pakai `visionClient.batchAnnotateFiles()` (`DOCUMENT_TEXT_DETECTION`, maks 5 halaman) — API Vision berbeda untuk 2 tipe file ini.
- `textContainsAmount()`: bersihkan titik/koma pemisah ribuan dari angka yang kebaca OCR, cocokkan exact match dengan `Math.round(sisaLebih)`.
- `validatePengembalianBukti` (onCall): validasi caller = pemilik LPJ atau Super Admin, `sisaLebih > 0`, fetch file dari Storage URL, OCR, update dokumen `lpj` dengan hasil (`valid`/`tidak_sesuai`/`gagal_baca` kalau fetch/OCR error). Dipanggil SETELAH dokumen LPJ tersimpan (butuh `lpjId` yang sudah ada).
- `sendPengembalianReminders` (onSchedule baru, `"30 9 * * *"` Asia/Makassar, terpisah dari `sendApprovalReminders` yang jalan jam 09:00 — beda concern): query `lpj` where `sisaLebih > 0`, skip yang `pengembalianStatus === 'valid'`, kirim reminder kalau sudah lewat 2 hari sejak `pengembalianLastReminderAt` (atau sejak `tanggalPengajuan` untuk reminder pertama). Reuse `createEmailTemplate` (case baru `'pengembalianReminder'`) yang otomatis include Nomor Dokumen LPJ, Nomor BS, Jumlah BS, Sisa Lebih BS -- sesuai permintaan user.
- `functions/package.json`: tambah dependency `@google-cloud/vision`.

**Client:** `FormLpjUmum.jsx` & `FormLpjMarketing.jsx` — kotak upload opsional muncul menggantikan catatan teks lama saat `sisaLebih > 0`, upload+validasi jalan setelah LPJ tersimpan (create maupun edit), toast sukses/warning sesuai hasil OCR. `DetailLpj.jsx` — section baru menampilkan status (badge tervalidasi/tidak sesuai/gagal baca) + tombol upload/re-upload untuk kasus yang di-skip saat submit atau butuh perbaikan, supaya reminder email yang mengarahkan ke Detail LPJ punya tempat nyata untuk ditindaklanjuti.

**`storage.rules`:** fungsi baru `validPdfOrImageUpload()` (PDF ATAU gambar, beda dari `validPdfUpload()` yang PDF-only) + path baru `match /lpj_pengembalian/{allPaths=**}`.

**Keterbatasan yang diketahui (didokumentasikan, belum divalidasi manual):**
- Akurasi OCR tergantung kualitas foto/scan struk transfer -- kalau nominal tidak konsisten format (mis. ada desimal, spasi tidak biasa), `textContainsAmount()` bisa false-negative (dianggap "tidak_sesuai" padahal sebenarnya benar). User perlu tes dengan struk transfer nyata dari bank yang biasa dipakai.
- Cloud Vision API BELUM TENTU otomatis aktif di project `samudera-web-cbf2f` -- `firebase deploy --only functions` cuma otomatis meng-enable API infra Cloud Functions (cloudfunctions/cloudbuild/scheduler/dst), BUKAN `vision.googleapis.com`. Kalau `validatePengembalianBukti` gagal dengan galat terkait API/permission, perlu aktifkan manual di Google Cloud Console > APIs & Services (project sudah Blaze, jadi billing bukan penghalang).
- Reminder pertama baru terkirim setelah scheduled function `sendPengembalianReminders` jalan jam 09:30 WITA H+2 dari submit -- belum ada cara trigger manual/test cepat selain menunggu jadwal atau mengubah `pengembalianLastReminderAt` manual di Firestore untuk simulasi.

## 25.5 Task Development — Bagian O

- [x] `BsTable.jsx`, `ReimbursementTable.jsx`: badge Transferred/Reported jadi icon + tooltip
- [x] `src/utils/attachmentUpload.js` (baru): validasi PDF/JPG/PNG + `mergeAttachmentsToPdf()`
- [x] 5 form (RbsBbm/RbsOperasional/RbsUmum/LpjUmum/LpjMarketing): multi-upload PDF/JPG/PNG digabung 1 PDF sebelum upload
- [x] `src/utils/pengembalianUpload.js` (baru): upload bukti apa adanya + panggil validasi
- [x] `functions/index.js`: `validatePengembalianBukti` (onCall, OCR Cloud Vision) + `sendPengembalianReminders` (onSchedule, tiap 2 hari)
- [x] `functions/package.json`: tambah `@google-cloud/vision`, `npm install` sukses
- [x] `FormLpjUmum.jsx`, `FormLpjMarketing.jsx`: UI upload bukti pengembalian opsional + hook ke submit
- [x] `DetailLpj.jsx`: section status + upload/re-upload bukti pengembalian
- [x] `storage.rules`: `validPdfOrImageUpload()` + path `lpj_pengembalian/`
- [x] `node -c` + isolated `require()` test functions sukses
- [x] `firebase deploy --only functions --dry-run` sukses
- [x] `CI=true npm run build` sukses (0 warning/error)
- [x] Deploy ke produksi — storage rules, functions (`validatePengembalianBukti` & `sendPengembalianReminders` berhasil `Successful create operation`), hosting — semua sukses 2026-09-05
- [x] Cek Cloud Vision API aktif di project — **dikonfirmasi user, diaktifkan manual 2026-09-05** lewat Google Cloud Console > APIs & Services
- [ ] Tes upload bukti pengembalian dengan struk transfer asli (belum divalidasi end-to-end)
- [ ] Tes manual: multi-upload lampiran RBS/LPJ dengan campuran PDF+JPG, pastikan "Lihat Lampiran" di Detail terbuka 1 file gabungan lengkap
- [ ] Tes manual: badge icon Transferred/Reported muncul tooltip saat hover

---

# BAGIAN P — PWA: Aplikasi Bisa Di-Install di Android/iOS (2026-09-05)

## 26.1 Permintaan User

User tanya cara supaya aplikasi web ini bisa "diinstall" di HP (Android & iOS). Direkomendasikan PWA (Progressive Web App) dulu (gratis, tidak perlu App Store/Play Store & akun developer) ketimbang bungkus native (Capacitor, butuh Xcode/Android Studio & akun developer berbayar) — user setuju & minta langsung dikerjakan + deploy.

## 26.2 Temuan

Project sudah punya `public/manifest.json` dasar (1 icon 192x192) tapi **tidak pernah benar-benar aktif** — `public/index.html` tidak ada `<link rel="manifest">` sama sekali, dan tidak ada service worker/registrasi apapun (`src/index.js` polos, tidak ada `src/service-worker.js`). Jadi PWA di app ini belum pernah berfungsi walau file dasarnya sudah ada dari awal.

`react-scripts` (react-scripts v5, sudah jadi dependency, TIDAK di-eject) ternyata sudah punya dukungan bawaan: `config/webpack.config.js` otomatis pasang `WorkboxWebpackPlugin.InjectManifest` KALAU `src/service-worker.js` ada. Artinya PWA bisa diaktifkan tanpa eject/craco, cukup tambah file-file standar `cra-template-pwa`. Paket `workbox-*` yang dibutuhkan runtime ternyata sudah ke-hoist di `node_modules` (dependency transitif react-scripts) — tetap ditambahkan eksplisit ke `package.json` (bukan cuma mengandalkan hoisting) supaya `npm install` di mesin lain tetap konsisten.

## 26.3 Implementasi

- `src/service-worker.js` (baru): precache asset build (`self.__WB_MANIFEST`, diisi otomatis saat build), fallback navigasi ke `index.html` (SPA routing tetap jalan offline), `StaleWhileRevalidate` untuk gambar same-origin. **`clientsClaim()` + `self.skipWaiting()` dipanggil unconditional** — pertimbangan khusus: app ini sering di-hotfix/deploy (lihat riwayat sesi ini), jadi service worker baru langsung aktif begitu selesai install (tab yang sedang terbuka tidak dipaksa reload, tapi navigasi/refresh berikutnya pasti dapat build terbaru) — tidak perlu tunggu user tutup SEMUA tab dulu (perilaku default workbox tanpa skipWaiting).
- `src/serviceWorkerRegistration.js` (baru): adaptasi boilerplate resmi CRA (`register()`/`unregister()`), dipanggil dari `src/index.js`.
- `public/manifest.json`: tambah icon 512x512 (kriteria minimum Chrome untuk install banner), `theme_color` diganti ke merah brand (`#ED1C24`, dipakai luas di email/tombol) dari default hitam bawaan CRA.
- `public/index.html`: tambah `<link rel="manifest">`, `<link rel="apple-touch-icon">`, meta `apple-mobile-web-app-*` (iOS baca ini untuk Add to Home Screen, BUKAN manifest.json seperti Android/Chrome).
- Icon baru (`logo192.png`, `logo512.png`, `apple-touch-icon.png` 180x180): di-generate dari `logo-tanpa-tulisan.png` (sumber asli cuma 192x192, satu-satunya aset persegi yang ada — 2 logo lain di `src/assets/images/` berupa wordmark horizontal 7898x1211, tidak cocok jadi icon) pakai `sharp` yang diinstall SEMENTARA (`npm install --no-save`, langsung di-uninstall lagi setelah generate) supaya tidak menambah dependency permanen cuma untuk tugas one-off ini.
- `firebase.json`: header `Cache-Control: no-cache` khusus untuk `/service-worker.js` (nama file tetap/tidak di-hash, browser wajib re-check tiap saat, bukan ikut cache default Hosting).
- `package.json`: tambah `workbox-core/expiration/precaching/routing/strategies` (versi dipin sama seperti yang sudah ke-hoist dari react-scripts, 6.6.0) sebagai dependency eksplisit.

## 26.4 Kenapa TIDAK Bungkus Native (Capacitor) Dulu

Ditawarkan ke user sebagai opsi lanjutan kalau butuh app "resmi" di Play Store/App Store — belum dikerjakan karena user pilih mulai dari PWA. Kalau nanti dibutuhkan, kode React yang sama bisa dipakai ulang (tidak perlu rewrite), tinggal tambah wrapper Capacitor.

## 26.5 Keterbatasan yang Diketahui

- Instalasi di iOS Safari tetap manual lewat menu Share > "Add to Home Screen" — Apple tidak punya install-prompt otomatis seperti Chrome/Android.
- Tab yang SUDAH terbuka saat deploy baru tidak otomatis reload paksa (sengaja, lihat 26.3) — kalau user butuh notifikasi "versi baru tersedia" yang lebih eksplisit, perlu tambahan UI (toast + tombol refresh), belum dikerjakan supaya tidak mengganggu user yang sedang isi form.
- Icon di-upscale dari sumber 192x192 (bukan didesain ulang di resolusi tinggi) — cukup tajam untuk logo sederhana ini (dicek visual), tapi kalau ada source vector/resolusi tinggi asli, sebaiknya dipakai untuk hasil lebih optimal.

## 26.6 Task Development — Bagian P

- [x] `src/service-worker.js`, `src/serviceWorkerRegistration.js` (baru)
- [x] `src/index.js`: panggil `serviceWorkerRegistration.register()`
- [x] `public/manifest.json`: icon 192+512, theme_color brand
- [x] `public/index.html`: link manifest, apple-touch-icon, meta iOS
- [x] Generate `logo192.png`, `logo512.png`, `apple-touch-icon.png` dari source yang ada (sharp sementara, langsung dihapus)
- [x] `package.json`: tambah 5 dependency workbox eksplisit, `npm install` sukses
- [x] `firebase.json`: header no-cache untuk `/service-worker.js`
- [x] `CI=true npm run build` sukses (0 warning/error) — dicek `build/service-worker.js` benar berisi precache manifest asset hasil build (nama file hash JS/CSS terbaru ketemu di dalamnya)
- [x] Cek visual icon 512x512 & apple-touch-icon hasil generate — tajam & jelas
- [ ] Deploy hosting ke produksi
- [ ] Tes manual: buka di Chrome Android → muncul prompt "Install app" atau lewat menu ⋮ > Install; buka di Safari iOS → Share > Add to Home Screen → ikon & nama muncul benar, buka fullscreen tanpa address bar
