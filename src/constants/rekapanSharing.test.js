import { SHARING_UNITS, MJS_UNIT_NAME, computeAllEmployeeShares, computeProportionalSplit } from './rekapanSharing'

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

describe('computeProportionalSplit', () => {
    const defaultPoolShares = computeAllEmployeeShares({
        MKT: Array(11).fill('x'),
        SAG: Array(12).fill('x'),
        SP: Array(12).fill('x'),
        SKI: Array(12).fill('x'),
        MJS: Array(13).fill('x'),
        SML: Array(14).fill('x'),
        KEJS: Array(11).fill('x'),
        SKEL: Array(11).fill('x'),
        PPNP: Array(11).fill('x')
    })

    test('unit yang dicentang displit proporsional sesuai bobot pool, dinormalisasi ke 100%', () => {
        // MJS(12) & SML(13) dari pool -- proporsi 12:13 dinormalisasi jadi 100%
        const result = computeProportionalSplit({ MJS: true, SML: true }, defaultPoolShares)
        expect(result.MJS + result.SML).toBe(100)
        expect(result.SML).toBeGreaterThan(result.MJS) // SML bobot pool lebih besar
    })

    test('unit yang TIDAK dicentang selalu 0', () => {
        const result = computeProportionalSplit({ MJS: true }, defaultPoolShares)
        expect(result.MJS).toBe(100)
        SHARING_UNITS.filter((u) => u.code !== 'MJS').forEach((u) => {
            expect(result[u.code]).toBe(0)
        })
    })

    test('tidak ada unit dicentang -> semua 0', () => {
        const result = computeProportionalSplit({}, defaultPoolShares)
        SHARING_UNITS.forEach((u) => expect(result[u.code]).toBe(0))
    })

    test('fallback bagi rata kalau unit yang dicentang bobot pool-nya 0', () => {
        const result = computeProportionalSplit({ MJS: true, SML: true }, {})
        expect(result.MJS).toBe(50)
        expect(result.SML).toBe(50)
    })

    test('centang 1 unit saja -> unit itu dapat 100%', () => {
        const result = computeProportionalSplit({ [SHARING_UNITS[0].code]: true }, defaultPoolShares)
        expect(result[SHARING_UNITS[0].code]).toBe(100)
    })
})

