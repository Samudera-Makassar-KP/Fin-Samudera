import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebaseConfig'
import { isValidAttachmentFile, ATTACHMENT_ACCEPT, ATTACHMENT_MAX_SIZE_BYTES } from './attachmentUpload'
import { fileToBase64 } from './uploadPdfFile'
import { describePengembalianStatus } from './pengembalianStatus'

export { describePengembalianStatus }

export const PENGEMBALIAN_ACCEPT = ATTACHMENT_ACCEPT
export const PENGEMBALIAN_MAX_SIZE_BYTES = ATTACHMENT_MAX_SIZE_BYTES
export const isValidPengembalianFile = isValidAttachmentFile

// Bagian AW: upload sekarang lewat Cloud Function `uploadOwnedFile` (bukan
// lagi uploadBytes langsung ke Storage) supaya kepemilikan LPJ-nya divalidasi
// server-side sebelum file ditulis (lihat catatan lengkap di
// functions/index.js & storage.rules). `lpjId` sudah pasti dokumen yang
// SUDAH ADA (bukti pengembalian cuma relevan setelah LPJ diajukan), jadi
// dipakai langsung sebagai ownership mode 'workflowDoc' -- lebih presisi
// daripada mode 'displayIdOwners' karena sekaligus mengizinkan
// validator/reviewer yang tercatat di dokumen itu, bukan cuma pemilik.
export const uploadAndValidatePengembalian = async (lpjId, displayId, file) => {
    if (file.size > PENGEMBALIAN_MAX_SIZE_BYTES) {
        throw new Error(`Ukuran file maksimal ${Math.round(PENGEMBALIAN_MAX_SIZE_BYTES / (1024 * 1024))}MB. File ini ${(file.size / (1024 * 1024)).toFixed(1)}MB.`)
    }

    const fileBase64 = await fileToBase64(file)
    const uploadOwnedFile = httpsCallable(functions, 'uploadOwnedFile')
    const uploadResult = await uploadOwnedFile({
        storagePath: `lpj_pengembalian/${displayId}/${file.name}`,
        contentType: file.type || 'application/octet-stream',
        fileBase64,
        ownership: { mode: 'workflowDoc', collectionName: 'lpj', docId: lpjId }
    })
    const fileUrl = uploadResult.data.downloadURL

    const validate = httpsCallable(functions, 'validatePengembalianBukti')
    const result = await validate({ lpjId, fileUrl })
    return { ...result.data, fileUrl }
}
