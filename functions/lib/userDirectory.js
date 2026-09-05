// /userDirectory adalah mirror read-only dari /users yang HANYA berisi field
// aman (bukan bankName/accountNumber dkk) -- dibaca client manapun yang login
// (lihat firestore.rules) untuk kebutuhan lintas-user yang legit tapi tidak
// butuh data finansial: dropdown Reviewer/Validator, dropdown plat BBM lintas
// user, dan nama approver di PDF/Detail. Sebelumnya semua kebutuhan itu
// query langsung ke /users collection, yang berarti SIAPA PUN yang login bisa
// baca profil lengkap user lain termasuk nomor rekening bank (lihat Bagian
// H/18.4). Mirror ini disinkron otomatis oleh trigger di index.js setiap kali
// /users/{uid} ditulis (baik lewat Cloud Function createManagedUser, maupun
// lewat update langsung client Super Admin di FormEditUser.jsx).
//
// Dipisah ke file sendiri (bukan cuma didefinisikan di index.js) supaya bisa
// dites langsung -- lihat functions/test/userDirectory.test.js. Field `uid`
// sempat hilang total dari fungsi ini (Bagian M, 2026-09-03) dan memblokir
// SEMUA submit RBS/LPJ/BS di produksi selama beberapa hari sebelum ketahuan;
// test ini ada supaya regresi yang sama tidak lolos lagi tanpa ketahuan.
const buildUserDirectoryEntry = (uid, data) => ({
    uid,
    nama: typeof data?.nama === "string" ? data.nama : "",
    role: typeof data?.role === "string" ? data.role : "",
    unit: Array.isArray(data?.unit) ? data.unit : [],
    platKendaraan: Array.isArray(data?.platKendaraan) ? data.platKendaraan : [],
});

module.exports = { buildUserDirectoryEntry };
