import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export const PDF_CONTENT_TYPE = 'application/pdf'
export const PDF_MAX_SIZE_BYTES = 250 * 1024 * 1024

export const isPdfFile = (file) => {
    if (!file) return false

    return file.type === PDF_CONTENT_TYPE || file.name?.toLowerCase().endsWith('.pdf')
}

export const getUploadablePdfFiles = (files = []) => {
    return files.filter(file => file?.size > 0)
}

export const uploadPdfFile = async (storage, path, file) => {
    const storageRef = ref(storage, path)
    const snapshot = await uploadBytes(storageRef, file, { contentType: PDF_CONTENT_TYPE })

    return getDownloadURL(snapshot.ref || storageRef)
}
