import { normalizePlatKey, formatPlatDisplay, aggregateBbm } from './rekapanAggregation'
import { MJS_UNIT_NAME } from '../constants/rekapanSharing'

describe('normalizePlatKey', () => {
    test('menyatukan plat yang beda cuma di spasi', () => {
        expect(normalizePlatKey('DD 1234 AB')).toBe(normalizePlatKey('DD1234AB'))
        expect(normalizePlatKey('DD  1234   AB')).toBe(normalizePlatKey('DD 1234 AB'))
    })

    test('case-insensitive', () => {
        expect(normalizePlatKey('dd 1234 ab')).toBe(normalizePlatKey('DD 1234 AB'))
    })

    test('null/kosong -> null', () => {
        expect(normalizePlatKey('')).toBeNull()
        expect(normalizePlatKey(null)).toBeNull()
    })
})

describe('formatPlatDisplay', () => {
    test('memformat ulang jadi "AB 1234 CD" untuk pola plat Indonesia umum', () => {
        expect(formatPlatDisplay(normalizePlatKey('dd 1234 ab'))).toBe('DD 1234 AB')
        expect(formatPlatDisplay(normalizePlatKey('D1234A'))).toBe('D 1234 A')
    })

    test('dua entri beda format spasi menghasilkan display yang sama', () => {
        const a = formatPlatDisplay(normalizePlatKey('DD 1234 AB'))
        const b = formatPlatDisplay(normalizePlatKey('DD1234AB'))
        const c = formatPlatDisplay(normalizePlatKey('DD  1234  AB'))
        expect(a).toBe(b)
        expect(b).toBe(c)
    })

    test('tidak cocok pola -> ditampilkan apa adanya (tanpa spasi)', () => {
        expect(formatPlatDisplay('TIDAKDIKETAHUI123XYZ')).toBe('TIDAKDIKETAHUI123XYZ')
    })
})

describe('aggregateBbm dengan sharing', () => {
    const makeReimbursement = (unit, biaya, jenis = 'BBM Pertalite', plat = 'DD 1234 AB') => ({
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis, biaya, liter: 10, plat, tanggal: '2026-03-15' }
        ]
    })

    test('total MJS diredistribusi ke unit lain sesuai sharingShares', () => {
        const docs = [makeReimbursement(MJS_UNIT_NAME, 1000000)]
        const shares = { [MJS_UNIT_NAME]: 50, 'PT Samudera Agencies Indonesia': 50 }

        const result = aggregateBbm(docs, [], { year: 2026, sharingShares: shares })

        expect(result.totals[MJS_UNIT_NAME][2]).toBe(500000)
        expect(result.totals['PT Samudera Agencies Indonesia'][2]).toBe(500000)
    })

    test('tanpa sharingShares, total MJS tetap 100% di MJS (perilaku lama tidak berubah)', () => {
        const docs = [makeReimbursement(MJS_UNIT_NAME, 1000000)]
        const result = aggregateBbm(docs, [], { year: 2026 })

        expect(result.totals[MJS_UNIT_NAME][2]).toBe(1000000)
        expect(result.totals['PT Samudera Agencies Indonesia']).toBeUndefined()
    })

    test('byJenis memisahkan breakdown per jenis BBM', () => {
        const docs = [
            makeReimbursement(MJS_UNIT_NAME, 300000, 'BBM Solar'),
            makeReimbursement(MJS_UNIT_NAME, 200000, 'BBM Pertalite')
        ]
        const result = aggregateBbm(docs, [], { year: 2026 })

        expect(result.byJenis['BBM Solar'][MJS_UNIT_NAME][2]).toBe(300000)
        expect(result.byJenis['BBM Pertalite'][MJS_UNIT_NAME][2]).toBe(200000)
    })

    test('plat dengan format spasi berbeda digabung jadi satu baris di byPlat', () => {
        const docs = [
            makeReimbursement(MJS_UNIT_NAME, 100000, 'BBM Pertalite', 'DD 1234 AB'),
            makeReimbursement(MJS_UNIT_NAME, 100000, 'BBM Pertalite', 'DD1234AB')
        ]
        const result = aggregateBbm(docs, [], { year: 2026 })

        expect(Object.keys(result.byPlat)).toEqual(['DD 1234 AB'])
        expect(result.byPlat['DD 1234 AB'].biaya[2]).toBe(200000)
    })

    test('unit yang difilter tetap dapat porsi share dari MJS walau dokumen MJS sendiri disembunyikan', () => {
        const docs = [makeReimbursement(MJS_UNIT_NAME, 1000000)]
        const shares = { [MJS_UNIT_NAME]: 50, 'PT Samudera Agencies Indonesia': 50 }

        // Filter cuma tampilkan PT Samudera Agencies Indonesia -- MJS sendiri tidak ikut
        const result = aggregateBbm(docs, [], {
            year: 2026,
            units: ['PT Samudera Agencies Indonesia'],
            sharingShares: shares
        })

        expect(result.totals['PT Samudera Agencies Indonesia'][2]).toBe(500000)
        expect(result.totals[MJS_UNIT_NAME]).toBeUndefined()
        expect(result.byPlat).toEqual({}) // dokumen MJS sendiri tetap tersembunyi dari drill-down plat
    })
})
