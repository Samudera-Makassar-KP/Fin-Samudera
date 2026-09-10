// Bagian AN: helper untuk menyaring entri "edit" dari statusHistory workflow
// (bonSementara/reimbursement/lpj). Entri edit ditandai lewat prefix status
// 'Data Diubah oleh ' -- ditulis oleh FormBs.jsx/FormRbsBbm.jsx/
// FormRbsOperasional.jsx/FormRbsUmum.jsx/FormLpjUmum.jsx/FormLpjMarketing.jsx
// saat admin/reviewer/validator mengedit pengajuan orang lain (lihat isEditMode
// di form-form itu). TIDAK butuh field baru di Firestore -- statusHistory yang
// sudah ada dari awal sudah cukup, cuma belum pernah difilter/ditampilkan
// sebagai "riwayat edit" ke user.

const EDIT_STATUS_PREFIX = 'Data Diubah oleh '

export function isEditHistoryEntry(entry) {
    return typeof entry?.status === 'string' && entry.status.startsWith(EDIT_STATUS_PREFIX)
}

// Kembalikan HANYA entri statusHistory yang merupakan riwayat edit, urut dari
// yang PALING BARU dulu (kebalikan urutan penyimpanan arrayUnion yang selalu
// menambah di akhir) supaya edit terbaru muncul di atas.
export function getEditHistoryEntries(statusHistory) {
    if (!Array.isArray(statusHistory)) return []
    return statusHistory.filter(isEditHistoryEntry).slice().reverse()
}

export function getEditCount(statusHistory) {
    return getEditHistoryEntries(statusHistory).length
}

// Ambil label peran editor dari status entry, mis. "Data Diubah oleh Admin" -> "Admin".
export function getEditorRoleLabel(entry) {
    if (!isEditHistoryEntry(entry)) return null
    return entry.status.slice(EDIT_STATUS_PREFIX.length).trim() || null
}
