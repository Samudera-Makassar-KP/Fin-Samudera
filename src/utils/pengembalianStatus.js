// Dipisah dari pengembalianUpload.js supaya jadi modul murni (tidak import
// firebaseConfig sama sekali) -- describePengembalianStatus() dites langsung
// tanpa menyeret inisialisasi Firebase App/Auth (yang butuh env var API key
// asli dan gagal di lingkungan tanpa itu, mis. CI). Lihat pengembalianUpload.test.js.
export const describePengembalianStatus = (status) => {
    switch (status) {
        case 'valid':
            return { label: 'Bukti pengembalian tervalidasi', tone: 'success' }
        case 'tidak_sesuai':
            return { label: 'Nominal di bukti tidak sesuai, silakan upload ulang', tone: 'warning' }
        case 'gagal_baca':
            return { label: 'Bukti tidak dapat dibaca sistem, silakan upload ulang dengan foto/scan lebih jelas', tone: 'warning' }
        default:
            return { label: 'Bukti pengembalian belum diupload', tone: 'neutral' }
    }
}
