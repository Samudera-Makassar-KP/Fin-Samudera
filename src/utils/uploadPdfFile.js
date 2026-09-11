import { httpsCallable } from 'firebase/functions'

export const PDF_CONTENT_TYPE = 'application/pdf'

// Bagian AW: upload sekarang lewat Cloud Function `uploadOwnedFile`
// (functions/index.js) supaya kepemilikan file bisa divalidasi lewat query
// Firestore biasa (BUKAN cross-service Storage Rules, TERBUKTI tidak bekerja
// di produksi -- lihat catatan "ROLLBACK DARURAT" di storage.rules). File
// dikirim sebagai base64 lewat body Callable Function, yang punya batas
// ukuran request ~32MB (platform Cloud Functions 2nd gen/Cloud Run) --
// base64 menambah ukuran ~33%, jadi batas file MENTAH diperkecil ke sini
// supaya selalu muat dengan aman jauh di bawah batas itu. Turun dari 250MB
// sebelumnya (waktu upload masih langsung ke Storage tanpa lewat sini).
export const PDF_MAX_SIZE_BYTES = 20 * 1024 * 1024

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

// FileReader.readAsDataURL() menghasilkan "data:<mime>;base64,<data>" --
// Callable Function cuma butuh bagian setelah koma (data mentahnya). Dipakai
// bareng pengembalianUpload.js (bukan cuma PDF) makanya diekspor.
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        const commaIndex = result.indexOf(',')
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
})

// Bagian AW: `functionsInstance` (import `functions` dari firebaseConfig.js)
// & `ownership` WAJIB diisi -- lihat komentar `uploadOwnedFile` di
// functions/index.js untuk bentuk objek `ownership` yang valid
// ({mode:'displayIdOwners', displayId} atau
// {mode:'workflowDoc', collectionName, docId}). `storage` (Storage SDK
// client) TIDAK lagi dipakai di sini sama sekali -- storage.rules sekarang
// `allow write: if false` untuk semua path yang dipakai fungsi ini.
export const uploadPdfFile = async (functionsInstance, path, file, ownership) => {
    if (file.size > PDF_MAX_SIZE_BYTES) {
        throw new Error(`Ukuran file maksimal ${Math.round(PDF_MAX_SIZE_BYTES / (1024 * 1024))}MB. File ini ${(file.size / (1024 * 1024)).toFixed(1)}MB.`)
    }

    const fileBase64 = await fileToBase64(file)
    const uploadOwnedFile = httpsCallable(functionsInstance, 'uploadOwnedFile')
    const result = await uploadOwnedFile({
        storagePath: path,
        contentType: PDF_CONTENT_TYPE,
        fileBase64,
        ownership
    })

    return result.data.downloadURL
}
