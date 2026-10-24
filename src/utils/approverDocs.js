import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebaseConfig'

// Halaman Cek Pengajuan (RBS/BS/LPJ) untuk approver non-Super Admin.
// Dulu tab "Disetujui" mengambil SEMUA dokumen berstatus disetujui di seluruh
// perusahaan lalu menyaringnya di browser -- makin banyak data, makin lambat.
// Sekarang cukup satu query per peran (validator/reviewer1/reviewer2) yang
// hanya mengambil dokumen tempat user ini ditugaskan, dijalankan bersamaan.
// Tab pending/disetujui/dibatalkan lalu dipilah dari hasil yang sama.
export const fetchDocsByApproverRole = async (collectionName, roles, uid) => {
    const snapshots = await Promise.all(
        roles.map((role) =>
            getDocs(query(collection(db, collectionName), where(`user.${role}`, 'array-contains', uid)))
        )
    )

    const byRole = {}
    const all = new Map()
    roles.forEach((role, index) => {
        byRole[role] = snapshots[index].docs.map((docSnap) => {
            const item = { id: docSnap.id, displayId: docSnap.data().displayId, ...docSnap.data() }
            all.set(item.id, item)
            return item
        })
    })

    return { byRole, all: [...all.values()] }
}

// Gabungkan beberapa daftar tanpa duplikat (berdasarkan id).
export const uniqueById = (...lists) => {
    const seen = new Map()
    lists.flat().forEach((item) => {
        if (!seen.has(item.id)) seen.set(item.id, item)
    })
    return [...seen.values()]
}
