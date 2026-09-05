/**
 * @jest-environment node
 */
// Lihat catatan yang sama di attachmentUpload.test.js -- File/Blob jsdom belum
// implementasi text()/arrayBuffer() dengan benar, pakai Node native di sini.
import { File } from 'node:buffer'
import { isPdfFile, isValidPdfFile, getUploadablePdfFiles, PDF_MAX_SIZE_BYTES } from './uploadPdfFile'

const makeFile = (bytes, name, type) => new File([bytes], name, { type })

describe('isPdfFile', () => {
    test('true untuk contentType application/pdf', () => {
        expect(isPdfFile(makeFile('x', 'a.pdf', 'application/pdf'))).toBe(true)
    })

    test('true untuk ekstensi .pdf walau contentType kosong', () => {
        expect(isPdfFile(makeFile('x', 'a.pdf', ''))).toBe(true)
    })

    test('false untuk file non-PDF', () => {
        expect(isPdfFile(makeFile('x', 'a.jpg', 'image/jpeg'))).toBe(false)
    })

    test('false untuk file null/undefined', () => {
        expect(isPdfFile(null)).toBe(false)
        expect(isPdfFile(undefined)).toBe(false)
    })
})

describe('isValidPdfFile', () => {
    test('valid kalau nama .pdf DAN signature %PDF- di awal isi file', async () => {
        await expect(isValidPdfFile(makeFile('%PDF-1.4\n%...', 'a.pdf', 'application/pdf'))).resolves.toBe(true)
    })

    test('tidak valid kalau nama .pdf tapi isi bukan PDF (dipalsukan)', async () => {
        await expect(isValidPdfFile(makeFile('bukan pdf', 'a.pdf', 'application/pdf'))).resolves.toBe(false)
    })

    test('tidak valid kalau bukan file PDF sama sekali', async () => {
        await expect(isValidPdfFile(makeFile('%PDF-1.4', 'a.jpg', 'image/jpeg'))).resolves.toBe(false)
    })
})

describe('getUploadablePdfFiles', () => {
    test('membuang file berukuran 0 (placeholder mock saat edit mode)', () => {
        const real = makeFile('isi', 'nyata.pdf', 'application/pdf')
        const mock = new File([''], 'placeholder.pdf', { type: 'application/pdf' })
        expect(getUploadablePdfFiles([mock, real])).toEqual([real])
    })
})

describe('PDF_MAX_SIZE_BYTES', () => {
    test('batas ukuran adalah 250MB', () => {
        expect(PDF_MAX_SIZE_BYTES).toBe(250 * 1024 * 1024)
    })
})
