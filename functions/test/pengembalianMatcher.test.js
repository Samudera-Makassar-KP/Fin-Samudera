const { textContainsAmount } = require('../lib/pengembalianMatcher')

describe('textContainsAmount', () => {
    test('cocok dengan nominal berformat titik ribuan', () => {
        expect(textContainsAmount('Total transfer Rp150.000,- berhasil', 150000)).toBe(true)
    })

    test('cocok dengan nominal tanpa pemisah ribuan', () => {
        expect(textContainsAmount('Nominal 150000', 150000)).toBe(true)
    })

    test('tidak cocok kalau nominal di teks beda dari target', () => {
        expect(textContainsAmount('Total transfer Rp200.000,- berhasil', 150000)).toBe(false)
    })

    test('cocok salah satu dari beberapa angka di teks OCR', () => {
        const text = 'No Ref: 88213 \n Tanggal: 05092026 \n Jumlah: Rp150.000 \n Saldo: Rp2.450.000'
        expect(textContainsAmount(text, 150000)).toBe(true)
    })

    test('membulatkan target sebelum dibandingkan', () => {
        expect(textContainsAmount('Nominal 150000', 149999.6)).toBe(true)
    })

    test('false kalau teks kosong/tidak ada angka', () => {
        expect(textContainsAmount('', 150000)).toBe(false)
        expect(textContainsAmount('Tidak ada angka di sini', 150000)).toBe(false)
    })

    test('false kalau target 0 atau tidak valid', () => {
        expect(textContainsAmount('Nominal 150000', 0)).toBe(false)
        expect(textContainsAmount('Nominal 150000', NaN)).toBe(false)
    })

    test('false kalau text null/undefined (dipanggil setelah OCR gagal)', () => {
        expect(textContainsAmount(null, 150000)).toBe(false)
        expect(textContainsAmount(undefined, 150000)).toBe(false)
    })
})
