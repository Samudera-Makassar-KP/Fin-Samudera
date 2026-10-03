// Mapping warna badge status -- disamakan dengan yang sudah established di
// BsTable.jsx, ReimbursementTable.jsx, LpjBsTable.jsx (masing-masing copy-paste
// inline). Dipakai di tabel "semua status sekaligus" milik Super Admin
// (BsCheck.jsx/ReimbursementCheck.jsx/LpjBsCheck.jsx) supaya konsisten dan
// mencakup status yang sebelumnya tidak pernah ditampilkan di sana (Ditolak,
// Dibatalkan, Divalidasi).
export const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Diajukan':
            return 'bg-blue-200 text-blue-800 border-[1px] border-blue-600'
        case 'Divalidasi':
            return 'bg-purple-200 text-purple-800 border-[1px] border-purple-600'
        case 'Diproses':
            return 'bg-yellow-200 text-yellow-800 border-[1px] border-yellow-600'
        case 'Disetujui':
            return 'bg-green-200 text-green-800 border-[1px] border-green-600'
        case 'Ditolak':
            return 'bg-red-200 text-red-800 border-[1px] border-red-600'
        default:
            return 'bg-gray-300 text-gray-700 border-[1px] border-gray-600'
    }
}
