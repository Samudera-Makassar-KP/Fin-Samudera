import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { WORKFLOW_TYPES, buildApprovalUpdate, buildRejectionUpdate } from './approvalRules'

const getCurrentActor = () => ({
    uid: localStorage.getItem('userUid'),
    role: localStorage.getItem('userRole')
})

const fetchUpdated = async (ref) => {
    const snapshot = await getDoc(ref)
    return { id: snapshot.id, ...snapshot.data() }
}

// Menyetujui satu tahap. Mengembalikan { updatedData, newStatus } atau null
// kalau user tidak berhak menyetujui dokumen ini pada tahap saat ini.
//
// Dulu, saat RBS/LPJ mencapai "Disetujui" penuh, proses ini juga men-generate
// PDF di browser lalu memanggil Cloud Function untuk email ke Finance --
// approver harus menunggu semuanya selesai sehingga approval terasa lama.
// Sekarang dihapus: kirim ke Finance cukup manual lewat tombol email
// ("Send Reminder to Finance") di tabel RBS/BS/LPJ.
export const approveWorkflowDoc = async (docType, item) => {
    const { uid, role } = getCurrentActor()
    const built = buildApprovalUpdate(docType, item, uid, role)
    if (!built) return null

    const ref = doc(db, WORKFLOW_TYPES[docType].collection, item.id)
    await updateDoc(ref, { ...built.updateData, statusHistory: arrayUnion(built.historyEntry) })
    const updatedData = await fetchUpdated(ref)

    return { updatedData, newStatus: built.updateData.status }
}

export const rejectWorkflowDoc = async (docType, item, reason) => {
    const { uid, role } = getCurrentActor()
    const built = buildRejectionUpdate(docType, item, uid, role, reason)

    const ref = doc(db, WORKFLOW_TYPES[docType].collection, item.id)
    await updateDoc(ref, { ...built.updateData, statusHistory: arrayUnion(built.historyEntry) })
    return fetchUpdated(ref)
}
