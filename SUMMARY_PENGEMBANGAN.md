# Summary Pengembangan Fin Samudera

Tanggal update: 04 Juli 2026

## Status Terbaru

Project sudah diperbaiki melalui alur branch `dev` lalu digabungkan ke `main`. Perubahan penting juga sudah dipush ke remote repository.

Status produksi:

- Firebase project: `samudera-web-cbf2f`
- Hosting URL: `https://samudera-web-cbf2f.web.app`
- Custom domain yang digunakan user: `https://smdr-mks.com`
- Commit function reminder terbaru yang sudah dideploy: `6516dc1 Fix approval reminder email delivery`

Catatan deploy:

- Perubahan aplikasi frontend terakhir sudah dideploy ke Firebase Hosting.
- Perubahan Cloud Functions untuk user management dan reminder email sudah dideploy.
- Update dokumen `SUMMARY_PENGEMBANGAN.md` ini hanya dokumentasi repo, sehingga tidak memerlukan deploy Hosting atau Functions.

## Ringkasan Yang Sudah Dikerjakan

1. Menggunakan branch `dev` sebagai jalur kerja sebelum perubahan digabungkan ke `main`.
2. Menambahkan dan mengaktifkan `firestore.rules` serta `storage.rules` melalui `firebase.json`.
3. Memperketat akses Firestore dan Storage agar data workflow dan file PDF tidak terbuka bebas.
4. Memindahkan pembuatan dan penghapusan user ke Cloud Functions:
   - `createManagedUser`
   - `deleteManagedUser`
5. Memperbaiki masalah tambah user Super Admin akibat mismatch antara Firebase Auth UID dan dokumen `users`.
6. Menambahkan `syncCurrentUserProfile` agar profil user lama dapat disinkronkan ke UID Auth yang benar.
7. Memperbaiki error edit LPJ Super Admin yang disebabkan lampiran lama berupa file kosong ikut diupload ulang.
8. Memastikan upload PDF mengirim metadata `contentType: application/pdf`.
9. Memperbaiki reminder email approval:
   - scheduler membaca credential email dari config Firebase
   - scheduler memakai timezone `Asia/Makassar`
   - reminder berjalan pada jam 09:00 WITA
   - jika email gagal dikirim, sistem tidak lagi menandai `lastReminderSent`
   - dokumen lama tanpa `currentApproverUid` tetap bisa diproses berdasarkan status workflow
10. Mengecek log Firebase Functions:
    - email notifikasi pengajuan/status terbukti terkirim untuk BS, RBS, dan LPJ
    - reminder sebelumnya gagal karena credential SMTP tidak terbaca
    - fix reminder sudah dideploy

## Checklist Telah Dikerjakan

- [x] Review struktur project dan alur kerja utama.
- [x] Pindah ke branch `dev` untuk pengerjaan yang lebih aman.
- [x] Push perubahan ke `dev`.
- [x] Merge perubahan stabil ke `main`.
- [x] Push `main`.
- [x] Deploy Firebase Hosting setelah perubahan frontend.
- [x] Deploy Cloud Functions untuk user management.
- [x] Deploy Cloud Functions untuk reminder email.
- [x] Perbaiki rules Firestore dan Storage.
- [x] Perbaiki fungsi tambah/hapus user agar lewat backend.
- [x] Perbaiki akses tambah user Super Admin.
- [x] Perbaiki edit LPJ Super Admin dengan lampiran lama.
- [x] Validasi build production React.
- [x] Validasi syntax Cloud Functions dengan `node --check`.
- [x] Cek log email notifikasi pengajuan dan approval.
- [x] Cek log scheduler reminder.
- [x] Update dokumentasi summary project.

## Checklist Belum Dikerjakan

- [ ] Verifikasi log reminder berikutnya setelah scheduler berjalan pada 05 Juli 2026 pukul 09:00 WITA.
- [ ] Buat automated test untuk rules Firestore dan Storage.
- [ ] Buat automated test untuk form LPJ, reimbursement, BS, upload lampiran, dan approval.
- [ ] Audit dependency vulnerability dari GitHub Dependabot.
- [ ] Upgrade runtime Cloud Functions sebelum Node.js 20 decommissioned.
- [ ] Upgrade package `firebase-functions` ke versi terbaru dan uji breaking changes.
- [ ] Rapikan region Cloud Functions agar dekat dengan trigger Firestore `asia-southeast2`.
- [ ] Refactor helper upload PDF agar semua form memakai pola yang sama.
- [ ] Refactor logic approval menjadi state machine yang konsisten.
- [ ] Buat environment staging Firebase terpisah.
- [ ] Tambahkan monitoring error dan alert otomatis.
- [ ] Tambahkan backup berkala Firestore dan Storage.

## Catatan Teknis Penting

- UI lama banyak bergantung pada `localStorage.userRole`, sedangkan backend dan rules menggunakan Firebase Auth UID. Ini sudah mulai diperbaiki lewat sinkronisasi profil, tetapi idealnya semua guard akses jangka panjang membaca sumber yang lebih aman.
- Beberapa function Firestore berada di `us-central1`, sedangkan trigger Firestore berada di region `asia-southeast2`. Ini masih berjalan, tetapi kurang ideal untuk latency dan biaya lintas region.
- Bundle frontend sekitar 901 kB gzip. Aplikasi masih berjalan, tetapi perlu optimasi agar lebih cepat untuk user dengan jaringan kantor yang kurang stabil.
- GitHub masih melaporkan vulnerability dependency. Ini perlu audit terpisah agar tidak mengganggu stabilitas sistem.
- Reminder email baru diperbaiki dan perlu dicek lagi setelah jadwal berikutnya berjalan.

## Rekomendasi Pengembangan Untuk Seluruh Karyawan

1. Dashboard personal karyawan.
   Setiap user sebaiknya punya halaman ringkas berisi pengajuan aktif, status approval, dokumen yang perlu ditindaklanjuti, riwayat pengajuan, dan reminder pribadi.

2. Notification center di dalam aplikasi.
   Selain email, buat pusat notifikasi internal agar user tetap tahu tugas approval, revisi, penolakan, atau dokumen selesai walaupun email terlewat.

3. SLA approval dan indikator keterlambatan.
   Tambahkan batas waktu approval per tahap, badge terlambat, dan eskalasi otomatis ke atasan atau Super Admin jika tidak diproses.

4. Delegasi approval.
   Karyawan yang cuti, dinas, atau tidak tersedia bisa mendelegasikan approval sementara ke user lain dengan periode waktu tertentu.

5. Mobile friendly atau PWA.
   Banyak approval bisa dilakukan lebih cepat dari ponsel. PWA akan membantu karyawan membuka aplikasi seperti aplikasi mobile tanpa instalasi rumit.

6. Tracking dokumen end-to-end.
   Setiap BS, RBS, dan LPJ perlu timeline visual: dibuat, divalidasi, direview, disetujui, ditolak, direvisi, dan selesai.

7. Revisi dokumen terstruktur.
   Saat dokumen ditolak, pengaju bisa memperbaiki dan submit ulang tanpa membuat dokumen baru, dengan catatan perubahan yang jelas.

8. Template dan kategori biaya yang lebih pintar.
   Sediakan template item biaya umum, validasi nominal, dan kategori standar agar input lebih cepat dan laporan lebih rapi.

9. OCR atau ekstraksi lampiran.
   Untuk jangka panjang, bukti PDF atau scan bisa dibaca otomatis untuk membantu validasi nominal, tanggal, dan nama vendor.

10. Export laporan yang lebih fleksibel.
    Tambahkan filter tanggal, unit bisnis, departemen, status, kategori, karyawan, dan approver. Export sebaiknya tersedia dalam Excel dan PDF.

11. Arsip dokumen digital.
    Buat halaman arsip yang mudah dicari agar Finance, GA, dan auditor internal bisa menemukan dokumen lama tanpa menelusuri manual.

12. Profil karyawan mandiri.
    Karyawan bisa memperbarui data bank, kontak, unit, lokasi, dan informasi dasar tertentu dengan approval bila diperlukan.

13. Help center dan SOP digital.
    Tambahkan panduan pengajuan, aturan reimbursement, contoh lampiran, dan FAQ agar karyawan tidak bergantung pada tanya jawab manual.

14. Role dan permission yang lebih kuat.
    Gunakan Firebase Auth custom claims untuk role penting seperti Super Admin, Admin, Validator, dan Reviewer.

15. Audit trail lengkap.
    Semua perubahan penting perlu mencatat field yang berubah, nilai lama, nilai baru, aktor, timestamp, dan alasan perubahan.

16. Monitoring operasional.
    Tambahkan alert untuk kegagalan email, kegagalan upload, error Cloud Functions, dokumen stuck, dan lonjakan error login.

17. Integrasi data karyawan.
    Jika tersedia sistem HR atau payroll, data user, unit bisnis, posisi, dan status aktif karyawan bisa disinkronkan agar tidak perlu input manual berulang.

18. Laporan manajemen.
    Buat dashboard untuk melihat tren pengeluaran, rata-rata waktu approval, jumlah pengajuan per unit, dokumen terlambat, dan nominal outstanding.

## Prioritas Pengembangan Berikutnya

1. Cek log reminder pada jadwal berikutnya untuk memastikan email reminder benar-benar terkirim.
2. Audit dependency security dari GitHub Dependabot.
3. Upgrade runtime dan dependency Cloud Functions.
4. Tambahkan automated test untuk rules dan workflow approval.
5. Buat dashboard personal dan notification center.
6. Refactor workflow approval menjadi state machine.
7. Siapkan staging environment sebelum perubahan besar berikutnya.

