import { RBS_LPJ_UNIT_CODES, BS_UNIT_CODES, getUnitCode } from './businessUnits'

describe('kode unit bisnis BS vs RBS/LPJ', () => {
    // Regresi: skema kode BS SENGAJA beda dari RBS/LPJ untuk 3 unit ini (sudah
    // dipakai sejak awal masing-masing jenis dokumen) -- kalau test ini gagal,
    // berarti ada yang "menyatukan" kode ini tanpa migrasi eksplisit, JANGAN
    // ubah nilainya untuk membuat test lulus, lihat komentar di businessUnits.js.
    test('BS pakai kode numerik untuk 3 unit tertentu, RBS/LPJ pakai kode huruf', () => {
        expect(BS_UNIT_CODES['PT Makassar Jaya Samudera']).toBe('019')
        expect(BS_UNIT_CODES['PT Samudera Makassar Logistik']).toBe('035')
        expect(BS_UNIT_CODES['PT Kendari Jaya Samudera']).toBe('083')

        expect(RBS_LPJ_UNIT_CODES['PT Makassar Jaya Samudera']).toBe('MJS')
        expect(RBS_LPJ_UNIT_CODES['PT Samudera Makassar Logistik']).toBe('SML')
        expect(RBS_LPJ_UNIT_CODES['PT Kendari Jaya Samudera']).toBe('KEJS')
    })

    test('unit lain di luar 3 itu kodenya SAMA di kedua skema', () => {
        const sharedUnits = [
            'PT Samudera Kendari Logistik',
            'PT Samudera Agencies Indonesia',
            'PT SILKargo Indonesia',
            'PT PAD Samudera Perdana',
            'PT Masaji Kargosentra Tama',
            'Samudera Indonesia',
            'Panitia'
        ]

        sharedUnits.forEach((unit) => {
            expect(BS_UNIT_CODES[unit]).toBe(RBS_LPJ_UNIT_CODES[unit])
        })
    })
})

describe('getUnitCode', () => {
    test('mengembalikan kode RBS/LPJ untuk unit yang dikenal', () => {
        expect(getUnitCode('PT Makassar Jaya Samudera')).toBe('MJS')
    })

    test('fallback ke nama unit apa adanya kalau tidak ketemu di peta', () => {
        expect(getUnitCode('Unit Tidak Dikenal')).toBe('Unit Tidak Dikenal')
    })
})
