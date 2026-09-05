const { formatCurrency, formatDateIndonesia } = require('../lib/format')

describe('formatCurrency', () => {
    test('memformat angka jadi Rupiah tanpa desimal dan tanpa spasi', () => {
        expect(formatCurrency(150000)).toBe('Rp150.000')
    })

    test('membulatkan/menangani nol', () => {
        expect(formatCurrency(0)).toBe('Rp0')
    })

    test('menangani angka besar dengan pemisah ribuan', () => {
        expect(formatCurrency(12500000)).toBe('Rp12.500.000')
    })
})

describe('formatDateIndonesia', () => {
    test('memformat tanggal ISO ke format Indonesia', () => {
        expect(formatDateIndonesia('2026-09-05')).toBe('5 September 2026')
    })

    test('memformat bulan Januari (index 0) dengan benar', () => {
        expect(formatDateIndonesia('2026-01-15')).toBe('15 Januari 2026')
    })

    test('memformat bulan Desember (index 11) dengan benar', () => {
        expect(formatDateIndonesia('2026-12-31')).toBe('31 Desember 2026')
    })
})
