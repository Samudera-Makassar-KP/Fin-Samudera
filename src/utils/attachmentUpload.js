import { PDFDocument } from 'pdf-lib'

export const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png'
export const ATTACHMENT_MAX_SIZE_BYTES = 250 * 1024 * 1024

const PDF_MAGIC_BYTES = '%PDF-'

export const isPdfFile = (file) => {
    if (!file) return false
    return file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
}

export const isImageFile = (file) => {
    if (!file) return false
    const type = file.type?.toLowerCase() || ''
    if (type === 'image/jpeg' || type === 'image/png') return true
    const name = file.name?.toLowerCase() || ''
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')
}

const hasPdfSignature = async (file) => {
    try {
        const header = await file.slice(0, PDF_MAGIC_BYTES.length).text()
        return header === PDF_MAGIC_BYTES
    } catch (error) {
        return false
    }
}

// Sinyal berkas JPEG (FF D8 FF) / PNG (89 50 4E 47) -- sama filosofinya seperti
// hasPdfSignature() di uploadPdfFile.js: nama/ekstensi gampang dipalsukan, jadi
// beberapa byte pertama dicek supaya tidak asal terima file yang diganti nama.
const hasImageSignature = async (file) => {
    try {
        const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer())
        const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        return isJpeg || isPng
    } catch (error) {
        return false
    }
}

export const isValidAttachmentFile = async (file) => {
    if (isPdfFile(file)) return hasPdfSignature(file)
    if (isImageFile(file)) return hasImageSignature(file)
    return false
}

export const getUploadableAttachments = (files = []) => {
    return files.filter(file => file?.size > 0)
}

// Gabungkan beberapa lampiran (PDF dan/atau gambar JPG/PNG) jadi SATU file PDF --
// PDF asli disalin apa adanya per halaman, gambar dikonversi jadi 1 halaman PDF
// ukuran A4 (di-scale proporsional, tidak di-crop) supaya urutan & isi semua
// lampiran tetap utuh dalam satu file yang ditampilkan di tombol "Lihat Lampiran".
export const mergeAttachmentsToPdf = async (files, outputFileName) => {
    const mergedPdf = await PDFDocument.create()
    const A4_WIDTH = 595.28
    const A4_HEIGHT = 841.89
    const MARGIN = 20

    for (const file of files) {
        const bytes = await file.arrayBuffer()

        if (isPdfFile(file)) {
            const srcDoc = await PDFDocument.load(bytes)
            const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices())
            copiedPages.forEach((page) => mergedPdf.addPage(page))
            continue
        }

        const isPng = file.type === 'image/png' || file.name?.toLowerCase().endsWith('.png')
        const image = isPng ? await mergedPdf.embedPng(bytes) : await mergedPdf.embedJpg(bytes)

        const maxWidth = A4_WIDTH - MARGIN * 2
        const maxHeight = A4_HEIGHT - MARGIN * 2
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
        const drawWidth = image.width * scale
        const drawHeight = image.height * scale

        const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])
        page.drawImage(image, {
            x: (A4_WIDTH - drawWidth) / 2,
            y: (A4_HEIGHT - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight
        })
    }

    const mergedBytes = await mergedPdf.save()
    return new File([mergedBytes], outputFileName, { type: 'application/pdf' })
}
