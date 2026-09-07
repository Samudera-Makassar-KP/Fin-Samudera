import { SHARING_UNITS, MJS_UNIT_NAME, computeAllEmployeeShares } from './rekapanSharing'

// Angka headcount dari contoh perhitungan user (tabel screenshot) --
// totalnya 107 orang, dipakai untuk verifikasi computeAllEmployeeShares
// menghasilkan persentase pool "All Employee" yang sama persis.
const SAMPLE_HEADCOUNT = {
    MKT: Array(11).fill('x'),
    SAG: Array(12).fill('x'),
    SP: Array(12).fill('x'),
    SKI: Array(12).fill('x'),
    MJS: Array(13).fill('x'),
    SML: Array(14).fill('x'),
    KEJS: Array(11).fill('x'),
    SKEL: Array(11).fill('x'),
    PPNP: Array(11).fill('x')
}

describe('computeAllEmployeeShares', () => {
    test('menghasilkan persentase yang sama persis dengan contoh perhitungan user', () => {
        const shares = computeAllEmployeeShares(SAMPLE_HEADCOUNT)

        expect(shares['PT Masaji Kargosentra Tama']).toBe(10)
        expect(shares['PT Samudera Agencies Indonesia']).toBe(11)
        expect(shares['PT PAD Samudera Perdana']).toBe(11)
        expect(shares['PT SILKargo Indonesia']).toBe(11)
        expect(shares[MJS_UNIT_NAME]).toBe(12)
        expect(shares['PT Samudera Makassar Logistik']).toBe(13)
        expect(shares['PT Kendari Jaya Samudera']).toBe(10)
        expect(shares['PT Samudera Kendari Logistik']).toBe(10)
        expect(shares['Perusahaan Pelayaran Nusantara Panurjwan']).toBe(10)
    })

    test('semua unit di SHARING_UNITS punya entry di hasil', () => {
        const shares = computeAllEmployeeShares(SAMPLE_HEADCOUNT)
        SHARING_UNITS.forEach((u) => {
            expect(shares[u.name]).toBeDefined()
        })
    })

    test('object kosong kalau total headcount 0', () => {
        expect(computeAllEmployeeShares({})).toEqual({})
    })

    test('unit tanpa data headcount dianggap 0 orang, tidak error', () => {
        const shares = computeAllEmployeeShares({ MJS: Array(10).fill('x') })
        expect(shares[MJS_UNIT_NAME]).toBe(100)
        expect(shares['PT Samudera Agencies Indonesia']).toBe(0)
    })
})

