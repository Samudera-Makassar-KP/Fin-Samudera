import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { storage, functions } from '../firebaseConfig'
import { isValidAttachmentFile, ATTACHMENT_ACCEPT, ATTACHMENT_MAX_SIZE_BYTES } from './attachmentUpload'
import { describePengembalianStatus } from './pengembalianStatus'

export { describePengembalianStatus }

export const PENGEMBALIAN_ACCEPT = ATTACHMENT_ACCEPT
export const PENGEMBALIAN_MAX_SIZE_BYTES = ATTACHMENT_MAX_SIZE_BYTES
export const isValidPengembalianFile = isValidAttachmentFile

// Upload bukti pengembalian APA ADANYA (bukan digabung/dikonversi jadi PDF seperti
// lampiran biasa) supaya Cloud Vision OCR (validatePengembalianBukti) bisa baca
// isi file aslinya, lalu panggil validasi server-side yang membandingkan nominal
// sisaLebih LPJ dengan angka yang kebaca dari file.
export const uploadAndValidatePengembalian = async (lpjId, displayId, file) => {
    const storageRef = ref(storage, `lpj_pengembalian/${displayId}/${file.name}`)
    const snapshot = await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' })
    const fileUrl = await getDownloadURL(snapshot.ref)

    const validate = httpsCallable(functions, 'validatePengembalianBukti')
    const result = await validate({ lpjId, fileUrl })
    return { ...result.data, fileUrl }
}
