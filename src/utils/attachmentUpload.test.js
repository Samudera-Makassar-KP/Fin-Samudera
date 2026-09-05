/**
 * @jest-environment node
 */
// File/Blob bawaan jsdom (default test environment CRA) belum implementasi
// arrayBuffer()/text() dengan benar -- environment node dipakai di sini karena
// modul yang dites murni logic (validasi/merge file), tidak butuh DOM sama
// sekali. jest-environment-node (versi lama, ikut react-scripts 5) tidak
// otomatis expose File/Blob sebagai global walau Node run-time-nya sendiri
// sudah mendukung, jadi diimpor eksplisit dari node:buffer.
import { File } from 'node:buffer'
import { PDFDocument } from 'pdf-lib'

// attachmentUpload.js (kode produksi, jalan di browser asli) memakai `File`
// sebagai global Web API biasa -- disetel manual di sini supaya tersedia juga
// saat modul itu dites di lingkungan Node (lihat catatan @jest-environment di atas).
global.File = File
import {
    isPdfFile,
    isImageFile,
    isValidAttachmentFile,
    getUploadableAttachments,
    mergeAttachmentsToPdf
} from './attachmentUpload'

// PNG 1x1 transparan valid (base64) -- dipakai untuk tes yang butuh gambar
// ASLI yang bisa didekode pdf-lib (bukan cuma byte signature).
const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const makeFile = (bytes, name, type) => new File([bytes], name, { type })

const base64ToUint8Array = (base64) => {
    const binary = Buffer.from(base64, 'base64')
    return new Uint8Array(binary)
}

describe('isPdfFile / isImageFile', () => {
    test('mendeteksi PDF dari contentType', () => {
        expect(isPdfFile(makeFile('%PDF-1.4', 'a.pdf', 'application/pdf'))).toBe(true)
    })

    test('mendeteksi PDF dari ekstensi kalau contentType kosong (mis. dari input file browser lawas)', () => {
        expect(isPdfFile(makeFile('%PDF-1.4', 'a.pdf', ''))).toBe(true)
    })

    test('file JPG bukan PDF', () => {
        expect(isPdfFile(makeFile('x', 'a.jpg', 'image/jpeg'))).toBe(false)
    })

    test('mendeteksi gambar dari contentType maupun ekstensi', () => {
        expect(isImageFile(makeFile('x', 'a.jpg', 'image/jpeg'))).toBe(true)
        expect(isImageFile(makeFile('x', 'a.png', ''))).toBe(true)
        expect(isImageFile(makeFile('x', 'a.pdf', 'application/pdf'))).toBe(false)
    })
})

describe('isValidAttachmentFile', () => {
    test('PDF valid: nama .pdf DAN signature %PDF- di awal file', async () => {
        const file = makeFile('%PDF-1.7\n...', 'lampiran.pdf', 'application/pdf')
        await expect(isValidAttachmentFile(file)).resolves.toBe(true)
    })

    test('menolak file yang cuma di-rename jadi .pdf tapi isinya bukan PDF', async () => {
        const file = makeFile('ini bukan pdf sama sekali', 'palsu.pdf', 'application/pdf')
        await expect(isValidAttachmentFile(file)).resolves.toBe(false)
    })

    test('PNG valid: signature byte PNG asli di awal file', async () => {
        const pngBytes = base64ToUint8Array(TINY_PNG_BASE64)
        const file = makeFile(pngBytes, 'foto.png', 'image/png')
        await expect(isValidAttachmentFile(file)).resolves.toBe(true)
    })

    test('menolak file JPG palsu (bukan signature JPEG asli)', async () => {
        const file = makeFile('bukan jpeg', 'foto.jpg', 'image/jpeg')
        await expect(isValidAttachmentFile(file)).resolves.toBe(false)
    })

    test('menolak tipe file yang tidak didukung sama sekali (mis. .docx)', async () => {
        const file = makeFile('isi apapun', 'dokumen.docx', 'application/vnd.openxmlformats')
        await expect(isValidAttachmentFile(file)).resolves.toBe(false)
    })
})

describe('getUploadableAttachments', () => {
    test('membuang file mock berukuran 0 (placeholder saat edit mode)', () => {
        const realFile = makeFile('isi', 'nyata.pdf', 'application/pdf')
        const mockFile = new File([''], 'placeholder.pdf', { type: 'application/pdf' })

        expect(getUploadableAttachments([mockFile, realFile])).toEqual([realFile])
    })

    test('array kosong kalau semua file mock/kosong', () => {
        const mockFile = new File([''], 'placeholder.pdf', { type: 'application/pdf' })
        expect(getUploadableAttachments([mockFile])).toEqual([])
    })
})

describe('mergeAttachmentsToPdf', () => {
    test('menggabungkan 2 PDF jadi 1 file PDF dengan total halaman gabungan', async () => {
        const pdfA = await PDFDocument.create()
        pdfA.addPage([100, 100])
        pdfA.addPage([100, 100])
        const fileA = makeFile(await pdfA.save(), 'a.pdf', 'application/pdf')

        const pdfB = await PDFDocument.create()
        pdfB.addPage([100, 100])
        const fileB = makeFile(await pdfB.save(), 'b.pdf', 'application/pdf')

        const merged = await mergeAttachmentsToPdf([fileA, fileB], 'gabungan.pdf')

        expect(merged.name).toBe('gabungan.pdf')
        expect(merged.type).toBe('application/pdf')

        const mergedBytes = await merged.arrayBuffer()
        const mergedDoc = await PDFDocument.load(mergedBytes)
        expect(mergedDoc.getPageCount()).toBe(3)
    })

    test('mengonversi gambar jadi 1 halaman PDF tambahan saat digabung dengan PDF', async () => {
        const pdfA = await PDFDocument.create()
        pdfA.addPage([100, 100])
        const fileA = makeFile(await pdfA.save(), 'a.pdf', 'application/pdf')

        const pngBytes = base64ToUint8Array(TINY_PNG_BASE64)
        const fileB = makeFile(pngBytes, 'foto.png', 'image/png')

        const merged = await mergeAttachmentsToPdf([fileA, fileB], 'gabungan.pdf')
        const mergedDoc = await PDFDocument.load(await merged.arrayBuffer())

        expect(mergedDoc.getPageCount()).toBe(2)
    })
})
