# Summary Pengembangan Fin Samudera

Tanggal update: 06 Juli 2026

## Status Terbaru

Project sudah diperbarui melalui branch `dev`, dideploy ke Firebase, dan siap digabungkan kembali ke `main`.

Status produksi:

- Firebase project: `samudera-web-cbf2f`
- Hosting URL: `https://samudera-web-cbf2f.web.app`
- Custom domain: `https://smdr-mks.com`
- Cloud Functions aktif: `asia-southeast2`
- Runtime Cloud Functions aktif: Node.js 22
- Credential email runtime: Firebase Secret Manager `EMAIL` dan `EMAIL_PASSWORD`

Catatan deploy 06 Juli 2026:

- Deploy pertama ke `asia-southeast2` sempat gagal sebagian karena error internal Firebase saat membuat function di region baru.
- Function parsial di `asia-southeast2` sudah dibersihkan.
- Deploy ulang berhasil penuh.
- Semua function lama di `us-central1` sudah dihapus agar tidak ada trigger ganda.
- Firebase Hosting sudah release versi baru.

## Ringkasan Yang Sudah Dikerjakan

1. Mengecek ulang log `sendApprovalReminders`.
   Scheduler terbukti berjalan pada 05 Juli 2026 dan 06 Juli 2026 pukul 09:00 WITA, tetapi saat itu email reminder masih gagal karena credential email belum tersedia di runtime function.

2. Memigrasikan credential email dari Firebase Runtime Config lama ke Firebase Secret Manager.
   Function sekarang membaca `EMAIL` dan `EMAIL_PASSWORD` sebagai secret v2, dengan fallback ke config lama untuk kompatibilitas sementara.

3. Memverifikasi credential SMTP secara lokal.
   Hasil verifikasi: koneksi SMTP valid tanpa mengirim email percobaan ke user.

4. Upgrade runtime Cloud Functions.
   Semua function produksi sekarang berjalan dengan Node.js 22.

5. Upgrade package Functions.
   `firebase-functions` sudah naik ke versi terbaru `7.2.5`.
   `firebase-functions-test` sudah naik ke `3.5.0`.
   `firebase-admin` ditahan di `13.10.0` karena `firebase-functions@7.2.5` belum kompatibel dengan peer dependency `firebase-admin@14.x`.

6. Merapikan region Cloud Functions.
   Semua callable, Firestore trigger, dan scheduler sudah dipindahkan ke `asia-southeast2`.

7. Menyesuaikan frontend callable Functions.
   Frontend sekarang memakai region `asia-southeast2` melalui `getFunctions(app, region)`.

8. Refactor helper upload PDF.
   Semua upload PDF utama sekarang memakai helper bersama `src/utils/uploadPdfFile.js` agar metadata `application/pdf`, batas 250MB, validasi PDF, dan pola download URL konsisten.

9. Deploy production.
   Firebase Functions dan Hosting sudah dideploy ulang sampai selesai.

## Checklist Telah Dikerjakan

- [x] Cek log reminder scheduler 05 Juli 2026 pukul 09:00 WITA.
- [x] Cek log reminder scheduler 06 Juli 2026 pukul 09:00 WITA.
- [x] Identifikasi penyebab reminder gagal: credential email tidak tersedia di runtime function.
- [x] Buat Secret Manager `EMAIL` dan `EMAIL_PASSWORD`.
- [x] Update helper email Cloud Functions agar membaca Secret Manager v2.
- [x] Verifikasi SMTP credential tanpa mengirim email user.
- [x] Upgrade runtime Cloud Functions ke Node.js 22.
- [x] Upgrade `firebase-functions` ke versi terbaru.
- [x] Uji breaking compatibility dependency dan menahan `firebase-admin` di versi kompatibel.
- [x] Pindahkan Cloud Functions ke `asia-southeast2`.
- [x] Hapus function lama `us-central1` setelah deploy baru berhasil.
- [x] Update frontend agar callable Functions memakai `asia-southeast2`.
- [x] Refactor helper upload PDF untuk form LPJ, RBS, dan generator PDF.
- [x] Validasi syntax Cloud Functions dengan `node --check`.
- [x] Validasi load package Functions v7.
- [x] Build production React berhasil.
- [x] Deploy Firebase Functions berhasil.
- [x] Deploy Firebase Hosting berhasil.
- [x] Update dokumentasi summary project.

## Checklist Belum Dikerjakan

- [ ] Verifikasi log reminder setelah scheduler baru berjalan berikutnya pada 07 Juli 2026 pukul 09:00 WITA.
- [ ] Buat automated test untuk rules Firestore dan Storage.
- [ ] Buat automated test untuk form LPJ, reimbursement, BS, upload lampiran, dan approval.
- [ ] Audit dan perbaiki vulnerability dependency. Saat install Functions masih terdeteksi 31 vulnerability.
- [ ] Refactor logic approval menjadi state machine yang konsisten.
- [ ] Buat environment staging Firebase terpisah.
- [ ] Tambahkan monitoring error dan alert otomatis.
- [ ] Tambahkan backup berkala Firestore dan Storage.

## Catatan Teknis Penting

- Reminder email 05 dan 06 Juli 2026 gagal sebelum migrasi secret. Setelah deploy 06 Juli 2026, function sudah memiliki Secret Manager dan SMTP credential sudah valid, tetapi pengiriman reminder aktual perlu dicek pada jadwal berikutnya.
- Jangan trigger scheduler manual tanpa koordinasi, karena dapat mengirim email reminder sungguhan ke validator atau reviewer di luar jam 09:00.
- Region Functions sekarang sudah dekat dengan Firestore `asia-southeast2`, sehingga latency dan risiko lintas region lebih baik dibanding sebelumnya.
- `firebase-functions@7.2.5` belum menerima `firebase-admin@14.x`, jadi admin SDK dipilih versi tertinggi yang kompatibel di seri 13.
- Bundle frontend masih sekitar 901 kB gzip. Aplikasi berjalan, tetapi masih perlu code splitting untuk performa jangka panjang.
- Firebase Runtime Config lama masih ada sebagai fallback sementara, tetapi sebaiknya dipensiunkan setelah semua function stabil memakai Secret Manager.

## Rekomendasi Pengembangan Untuk Seluruh Karyawan

1. Dashboard personal karyawan.
   Tampilkan pengajuan aktif, tugas approval, status dokumen, riwayat, dan dokumen yang tertunda.

2. Notification center di aplikasi.
   Selain email, user perlu pusat notifikasi internal agar approval, revisi, penolakan, dan dokumen selesai tidak terlewat.

3. SLA approval dan eskalasi.
   Tambahkan batas waktu approval per tahap, indikator terlambat, dan eskalasi otomatis ke atasan atau Super Admin.

4. Delegasi approval.
   User yang cuti, dinas, atau tidak tersedia bisa mendelegasikan approval sementara dengan periode tertentu.

5. PWA atau mobile friendly.
   Approval dari ponsel akan mempercepat proses untuk karyawan lapangan dan approver yang sering mobile.

6. Timeline dokumen end-to-end.
   Setiap BS, RBS, dan LPJ sebaiknya punya timeline: dibuat, divalidasi, direview, disetujui, ditolak, direvisi, dan selesai.

7. Revisi dokumen terstruktur.
   Dokumen yang ditolak bisa diperbaiki dan submit ulang tanpa membuat dokumen baru, lengkap dengan catatan perubahan.

8. Template biaya dan kategori standar.
   Form akan lebih cepat dan laporan lebih rapi jika item biaya umum, kategori, dan validasi nominal distandarkan.

9. OCR lampiran.
   Bukti PDF atau scan dapat dibaca otomatis untuk membantu validasi tanggal, nominal, dan vendor.

10. Export laporan fleksibel.
    Tambahkan filter tanggal, unit, departemen, status, kategori, karyawan, dan approver dengan export Excel/PDF.

11. Arsip dokumen digital.
    Buat pencarian arsip untuk Finance, GA, dan auditor internal agar dokumen lama mudah ditemukan.

12. Profil karyawan mandiri.
    Karyawan bisa memperbarui data bank, kontak, unit, lokasi, dan data dasar dengan approval bila diperlukan.

13. Help center dan SOP digital.
    Tambahkan panduan pengajuan, contoh lampiran, aturan reimbursement, dan FAQ.

14. Role dan permission berbasis custom claims.
    Role penting seperti Super Admin, Admin, Validator, dan Reviewer sebaiknya diperkuat dengan Firebase Auth custom claims.

15. Audit trail lengkap.
    Catat field yang berubah, nilai lama, nilai baru, aktor, timestamp, dan alasan perubahan untuk semua aksi penting.

16. Monitoring operasional.
    Tambahkan alert untuk error Functions, kegagalan email, kegagalan upload, login bermasalah, dan dokumen stuck.

17. Backup berkala.
    Siapkan backup Firestore dan Storage dengan bucket khusus, retensi jelas, dan uji restore berkala.

18. Environment staging.
    Buat project Firebase staging terpisah agar perubahan besar dapat diuji tanpa menyentuh data produksi.

19. Integrasi HR atau payroll.
    Sinkronkan data user, unit, posisi, dan status aktif karyawan agar tidak perlu input manual berulang.

20. Laporan manajemen.
    Buat dashboard tren pengeluaran, rata-rata waktu approval, outstanding, dokumen terlambat, dan volume pengajuan per unit.

## Prioritas Pengembangan Berikutnya

1. Cek log `sendApprovalReminders` pada 07 Juli 2026 setelah pukul 09:00 WITA.
2. Implementasikan monitoring error dan alert otomatis untuk kegagalan email atau Functions.
3. Siapkan backup berkala Firestore dan Storage.
4. Buat environment staging Firebase sebelum perubahan workflow besar.
5. Refactor approval menjadi state machine bersama untuk BS, RBS, dan LPJ.
6. Tambahkan automated test untuk rules, form, upload, dan approval.
7. Audit vulnerability dependency dan lakukan upgrade bertahap.
