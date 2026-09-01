import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export const PDF_CONTENT_TYPE = 'application/pdf'
export const PDF_MAX_SIZE_BYTES = 250 * 1024 * 1024

export const isPdfFile = (file) => {
    if (!file) return false

    return file.type === PDF_CONTENT_TYPE || file.name?.toLowerCase().endsWith('.pdf')
}

const PDF_MAGIC_BYTES = '%PDF-'

// uploadPdfFile() SELALU menulis metadata contentType 'application/pdf' ke Storage
// (lihat di bawah), jadi Storage Rules (`validPdfUpload()`) tidak bisa diandalkan untuk
// menolak file non-PDF -- rules itu cuma mengecek metadata yang disetel client sendiri.
// Satu-satunya penjagaan nyata ada di sini: isPdfFile() di atas cuma cek nama/ekstensi
// (gampang dilewati dengan mengganti nama file jadi *.pdf), jadi isValidPdfFile()
// membaca beberapa byte pertama file dan memastikan cocok dengan signature PDF asli
// sebelum file dianggap valid untuk diupload.
const hasPdfSignature = async (file) => {
    try {
        const header = await file.slice(0, PDF_MAGIC_BYTES.length).text()
        return header === PDF_MAGIC_BYTES
    } catch (error) {
        return false
    }
}

export const isValidPdfFile = async (file) => {
    if (!isPdfFile(file)) return false
    return hasPdfSignature(file)
}

export const getUploadablePdfFiles = (files = []) => {
    return files.filter(file => file?.size > 0)
}

export const uploadPdfFile = async (storage, path, file) => {
    const storageRef = ref(storage, path)
    const snapshot = await uploadBytes(storageRef, file, { contentType: PDF_CONTENT_TYPE })

    return getDownloadURL(snapshot.ref || storageRef)
}
