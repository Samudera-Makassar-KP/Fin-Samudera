import { SHARING_UNITS, MJS_UNIT_NAME, computeAllEmployeeShares, applySharingToBbmTotals } from './rekapanSharing'

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

describe('applySharingToBbmTotals', () => {
    test('meredistribusi total MJS ke semua unit sesuai persentase, MJS sendiri jadi porsinya saja', () => {
        const totals = {
            [MJS_UNIT_NAME]: [1000000, 2000000, ...Array(10).fill(0)]
        }
        const shares = { [MJS_UNIT_NAME]: 20, 'PT Samudera Agencies Indonesia': 80 }

        applySharingToBbmTotals(totals, shares)

        expect(totals[MJS_UNIT_NAME][0]).toBe(200000)
        expect(totals[MJS_UNIT_NAME][1]).toBe(400000)
        expect(totals['PT Samudera Agencies Indonesia'][0]).toBe(800000)
        expect(totals['PT Samudera Agencies Indonesia'][1]).toBe(1600000)
    })

    test('ditambahkan ke total yang sudah ada (bukan menimpa) untuk unit selain MJS', () => {
        const totals = {
            [MJS_UNIT_NAME]: [1000000, ...Array(11).fill(0)],
            'PT Samudera Agencies Indonesia': [500000, ...Array(11).fill(0)]
        }
        const shares = { [MJS_UNIT_NAME]: 50, 'PT Samudera Agencies Indonesia': 50 }

        applySharingToBbmTotals(totals, shares)

        expect(totals['PT Samudera Agencies Indonesia'][0]).toBe(500000 + 500000)
    })

    test('tidak melakukan apa-apa kalau MJS tidak punya data', () => {
        const totals = { 'PT Samudera Agencies Indonesia': [100, ...Array(11).fill(0)] }
        const result = applySharingToBbmTotals(totals, { [MJS_UNIT_NAME]: 50 })
        expect(result).toBe(totals)
        expect(totals['PT Samudera Agencies Indonesia'][0]).toBe(100)
    })

    test('tidak melakukan apa-apa kalau shares kosong/tidak diisi', () => {
        const totals = { [MJS_UNIT_NAME]: [1000, ...Array(11).fill(0)] }
        applySharingToBbmTotals(totals, {})
        expect(totals[MJS_UNIT_NAME][0]).toBe(1000)
    })
})
