import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebaseConfig'
import { WORKFLOW_TYPES, buildApprovalUpdate, buildRejectionUpdate } from './approvalRules'

const getCurrentActor = () => ({
    uid: localStorage.getItem('userUid'),
    role: localStorage.getItem('userRole')
})

const fetchUpdated = async (ref) => {
    const snapshot = await getDoc(ref)
    return { id: snapshot.id, ...snapshot.data() }
}

// Bagian BO (permintaan SMDR-Finance): begitu RBS/LPJ Disetujui penuh, SEMUA
// Validator (Finance) di Unit Bisnis dokumen tsb dikirimi email berisi SATU
// PDF gabungan -- form resmi + lampiran. Form resmi hanya bisa dirender di
// client (@react-pdf/renderer), jadi client yang men-generate & mengunggahnya
// (generate*PDF, sama seperti tombol Print), lalu Cloud Function
// `sendApprovedDocToValidators` yang mengambil form + lampiran, menggabungkan,
// dan mengirim email. Function itu idempoten (dicatat `approvedNotifSentAt`),
// jadi aman kalau terpanggil dua kali.
export const notifyValidatorsOnApproved = async (docType, approvedDoc) => {
    const workflow = WORKFLOW_TYPES[docType]
    if (!workflow?.hasValidator || approvedDoc?.status !== 'Disetujui') return null

    const pdfModule = docType === 'lpj'
        ? await import('./LpjPdf')
        : await import('./ReimbursementPdf')
    const generatePdf = docType === 'lpj' ? pdfModule.generateLpjPDF : pdfModule.generateReimbursementPDF
    const pdfUrl = await generatePdf(approvedDoc)

    const sendApprovedDocToValidators = httpsCallable(functions, 'sendApprovedDocToValidators')
    const result = await sendApprovedDocToValidators({
        collectionName: workflow.collection,
        docId: approvedDoc.id,
        pdfUrl: pdfUrl || ''
    })
    return result.data
}

// Menyetujui satu tahap. Mengembalikan { updatedData, newStatus, notifyError }
// atau null kalau user tidak berhak menyetujui dokumen ini pada tahap saat ini.
// Kegagalan kirim email ke Finance TIDAK membatalkan approval (approval-nya
// sudah tersimpan) -- dikembalikan sebagai notifyError supaya UI bisa memberi
// peringatan.
export const approveWorkflowDoc = async (docType, item) => {
    const { uid, role } = getCurrentActor()
    const built = buildApprovalUpdate(docType, item, uid, role)
    if (!built) return null

    const ref = doc(db, WORKFLOW_TYPES[docType].collection, item.id)
    await updateDoc(ref, { ...built.updateData, statusHistory: arrayUnion(built.historyEntry) })
    const updatedData = await fetchUpdated(ref)

    let notifyError = null
    if (updatedData.status === 'Disetujui' && WORKFLOW_TYPES[docType].hasValidator) {
        try {
            await notifyValidatorsOnApproved(docType, updatedData)
        } catch (error) {
            console.error('Gagal mengirim dokumen Disetujui ke Finance:', error?.code, error?.message, error)
            notifyError = error
        }
    }

    return { updatedData, newStatus: built.updateData.status, notifyError }
}

export const rejectWorkflowDoc = async (docType, item, reason) => {
    const { uid, role } = getCurrentActor()
    const built = buildRejectionUpdate(docType, item, uid, role, reason)

    const ref = doc(db, WORKFLOW_TYPES[docType].collection, item.id)
    await updateDoc(ref, { ...built.updateData, statusHistory: arrayUnion(built.historyEntry) })
    return fetchUpdated(ref)
}
