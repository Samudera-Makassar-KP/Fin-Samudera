import { normalizePlatKey, formatPlatDisplay, aggregateBbm, buildBbmItemKey, aggregateByCategory, listCategoryRawLabels } from './rekapanAggregation'

const MJS = 'PT Makassar Jaya Samudera'
const SAG = 'PT Samudera Agencies Indonesia'

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

describe('buildBbmItemKey', () => {
    test('menghasilkan key unik per docType+docId+itemIndex', () => {
        expect(buildBbmItemKey('reimbursement', 'abc', 0)).toBe('reimbursement_abc_0')
        expect(buildBbmItemKey('lpj', 'abc', 0)).not.toBe(buildBbmItemKey('reimbursement', 'abc', 0))
        expect(buildBbmItemKey('reimbursement', 'abc', 0)).not.toBe(buildBbmItemKey('reimbursement', 'abc', 1))
    })
})

describe('aggregateBbm - default (belum diklasifikasi)', () => {
    const makeReimbursement = (id, unit, biaya, jenis = 'BBM Pertalite', plat = 'DD 1234 AB') => ({
        id,
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis, biaya, liter: 10, plat, tanggal: '2026-03-15' }
        ]
    })

    test('baris BBM yang BELUM ada di sharingClassification tetap 100% ke unit pengaju (default aman)', () => {
        const docs = [makeReimbursement('doc1', MJS, 1000000)]
        const result = aggregateBbm(docs, [], { year: 2026 })

        expect(result.totals[MJS][2]).toBe(1000000)
        expect(result.totals[SAG]).toBeUndefined()
    })

    test('baris yang classification-nya dibagi:false tetap 100% ke unit pengaju', () => {
        const docs = [makeReimbursement('doc1', MJS, 1000000)]
        const classification = { [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dibagi: false } }

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification })

        expect(result.totals[MJS][2]).toBe(1000000)
    })

    test('byJenis & byPlat tidak pernah kena redistribusi, selalu data submission asli', () => {
        const docs = [makeReimbursement('doc1', MJS, 1000000)]
        const classification = {
            [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dibagi: true, splitMode: 'pool' }
        }
        const defaultPoolShares = { [MJS]: 50, [SAG]: 50 }

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification, defaultPoolShares })

        expect(result.byJenis['BBM Pertalite'][MJS][2]).toBe(1000000)
        expect(result.byPlat['DD 1234 AB'].biaya[2]).toBe(1000000)
    })
})

describe('aggregateBbm - baris ditandai dibagi (pool default)', () => {
    const makeReimbursement = (id, unit, biaya) => ({
        id,
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis: 'BBM Pertalite', biaya, liter: 10, plat: 'DD 1234 AB', tanggal: '2026-03-15' }
        ]
    })

    test('baris dibagi:true splitMode pool -> displit sesuai defaultPoolShares', () => {
        const docs = [makeReimbursement('doc1', MJS, 1000000)]
        const classification = { [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dibagi: true, splitMode: 'pool' } }
        const defaultPoolShares = { [MJS]: 20, [SAG]: 80 }

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification, defaultPoolShares })

        expect(result.totals[MJS][2]).toBe(200000)
        expect(result.totals[SAG][2]).toBe(800000)
    })
})

describe('aggregateBbm - baris ditandai dibagi (custom split)', () => {
    const makeReimbursement = (id, unit, biaya) => ({
        id,
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis: 'BBM Pertalite', biaya, liter: 10, plat: 'DD 1234 AB', tanggal: '2026-03-15' }
        ]
    })

    test('customShares dipakai, MENGABAIKAN defaultPoolShares', () => {
        const docs = [makeReimbursement('doc1', MJS, 1000000)]
        const classification = {
            [buildBbmItemKey('reimbursement', 'doc1', 0)]: {
                dibagi: true,
                splitMode: 'custom',
                customShares: { [MJS]: 70, [SAG]: 30 }
            }
        }
        const defaultPoolShares = { [MJS]: 20, [SAG]: 80 } // sengaja beda, harus DIABAIKAN

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification, defaultPoolShares })

        expect(result.totals[MJS][2]).toBe(700000)
        expect(result.totals[SAG][2]).toBe(300000)
    })
})

describe('aggregateBbm - filter unit + sharing', () => {
    const makeReimbursement = (id, unit, biaya) => ({
        id,
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis: 'BBM Pertalite', biaya, liter: 10, plat: 'DD 1234 AB', tanggal: '2026-03-15' }
        ]
    })

    test('unit yang difilter tetap dapat porsi share dari baris dibagi milik unit lain', () => {
        const docs = [makeReimbursement('doc1', MJS, 1000000)]
        const classification = { [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dibagi: true, splitMode: 'pool' } }
        const defaultPoolShares = { [MJS]: 50, [SAG]: 50 }

        const result = aggregateBbm(docs, [], {
            year: 2026,
            units: [SAG],
            sharingClassification: classification,
            defaultPoolShares
        })

        expect(result.totals[SAG][2]).toBe(500000)
        expect(result.totals[MJS]).toBeUndefined()
        expect(result.byPlat).toEqual({}) // dokumen MJS sendiri tetap tersembunyi dari drill-down
    })

    test('baris yang TIDAK dibagi tidak bocor ke unit lain walau difilter', () => {
        const docs = [makeReimbursement('doc1', MJS, 1000000)]

        const result = aggregateBbm(docs, [], { year: 2026, units: [SAG] })

        expect(result.totals[SAG]).toBeUndefined()
        expect(result.totals[MJS]).toBeUndefined() // MJS difilter dari tampilan & tidak dibagi ke SAG
    })
})

describe('aggregateBbm - baris dikecualikan (Bagian V)', () => {
    const MKT = 'PT Masaji Kargosentra Tama'
    const makeReimbursement = (id, unit, biaya, jenis = 'BBM Solar', plat = 'CDE') => ({
        id,
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis, biaya, liter: 10, plat, tanggal: '2026-03-15' }
        ]
    })

    test('baris dikecualikan:true tidak muncul di totals sama sekali (tidak juga di unit pengajunya sendiri)', () => {
        const docs = [makeReimbursement('doc1', MKT, 1000000)]
        const classification = { [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dikecualikan: true } }

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification })

        expect(result.totals[MKT]).toBeUndefined()
    })

    test('baris dikecualikan:true tidak muncul di byPlat/byJenis', () => {
        const docs = [makeReimbursement('doc1', MKT, 1000000)]
        const classification = { [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dikecualikan: true } }

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification })

        expect(result.byPlat).toEqual({})
        expect(result.byJenis).toEqual({})
    })

    test('dikecualikan diprioritaskan di atas dibagi -- kalau keduanya true, tetap tidak muncul', () => {
        const docs = [makeReimbursement('doc1', MKT, 1000000)]
        const classification = {
            [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dikecualikan: true, dibagi: true, splitMode: 'pool' }
        }
        const defaultPoolShares = { [MKT]: 50, [SAG]: 50 }

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification, defaultPoolShares })

        expect(result.totals[MKT]).toBeUndefined()
        expect(result.totals[SAG]).toBeUndefined()
    })

    test('baris lain (tidak dikecualikan) di dokumen/unit yang sama tetap tampil normal', () => {
        const docs = [{
            id: 'doc1',
            status: 'Disetujui',
            user: { unit: MKT },
            reimbursements: [
                { jenis: 'BBM Solar', biaya: 1000000, liter: 10, plat: 'CDE', tanggal: '2026-03-15' },
                { jenis: 'BBM Pertalite', biaya: 200000, liter: 5, plat: 'FGH', tanggal: '2026-03-15' }
            ]
        }]
        const classification = { [buildBbmItemKey('reimbursement', 'doc1', 0)]: { dikecualikan: true } }

        const result = aggregateBbm(docs, [], { year: 2026, sharingClassification: classification })

        expect(result.totals[MKT][2]).toBe(200000)
        expect(result.byPlat['CDE']).toBeUndefined()
        expect(result.byPlat['FGH'].biaya[2]).toBe(200000)
    })
})

describe('aggregateBbm - byJenis dikanonisasi (data lama diisi bebas)', () => {
    const MKT = 'PT Masaji Kargosentra Tama'
    const makeReimbursement = (id, unit, biaya, jenis, plat) => ({
        id,
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis, biaya, liter: 10, plat, tanggal: '2026-03-15' }
        ]
    })

    test('jenis baku (ada di BBM_PRICE_PER_LITER) dipakai apa adanya sebagai bucket', () => {
        const docs = [makeReimbursement('doc1', MKT, 100000, 'BBM Solar', 'CDE')]
        const result = aggregateBbm(docs, [], { year: 2026 })

        expect(Object.keys(result.byJenis)).toEqual(['BBM Solar'])
    })

    test('jenis bebas/tidak baku (mis. "BBM 1273 XBO 04/07/26") digabung jadi 1 bucket "BBM Lainnya", TIDAK jadi bucket sendiri-sendiri', () => {
        const docs = [
            makeReimbursement('doc1', MKT, 100000, 'BBM 1273 XBO 04/07/26', '1273 XBO'),
            makeReimbursement('doc2', MKT, 200000, 'BBM 1273 XBO 12/07/26', '1273 XBO'),
            makeReimbursement('doc3', MKT, 300000, 'BBM & OPS', 'FGH')
        ]
        const result = aggregateBbm(docs, [], { year: 2026 })

        expect(Object.keys(result.byJenis)).toEqual(['BBM Lainnya'])
        expect(result.byJenis['BBM Lainnya'][MKT][2]).toBe(600000)
    })

    test('bucket "BBM Lainnya" tetap kena totals seperti jenis biasa (cuma byJenis yang digabung)', () => {
        const docs = [makeReimbursement('doc1', MKT, 100000, 'BBM 1273 XBO 04/07/26', '1273 XBO')]
        const result = aggregateBbm(docs, [], { year: 2026 })

        expect(result.totals[MKT][2]).toBe(100000)
    })
})

describe('aggregateByCategory - categoryGroups (Bagian AA)', () => {
    const makeReimbursement = (id, unit, biaya, jenis) => ({
        id,
        status: 'Disetujui',
        user: { unit },
        reimbursements: [
            { jenis, biaya, tanggal: '2026-03-15' }
        ]
    })

    const makeLpj = (id, unit, jumlahBiaya, namaItem) => ({
        id,
        status: 'Disetujui',
        user: { unit },
        tanggalPengajuan: '2026-04-10',
        lpj: [{ namaItem, jumlahBiaya }]
    })

    const MEETING_GROUP = {
        label: 'Meeting',
        members: ['Meals Meeting', 'Meeting', 'Biaya Meeting']
    }

    test('tanpa categoryGroups, tiap label mentah tetap jadi kategori sendiri (perilaku lama)', () => {
        const docs = [
            makeReimbursement('doc1', MJS, 100000, 'Meals Meeting'),
            makeReimbursement('doc2', MJS, 200000, 'Biaya Meeting')
        ]
        const result = aggregateByCategory(docs, [], { year: 2026 })

        expect(Object.keys(result).sort()).toEqual(['Biaya Meeting', 'Meals Meeting'])
    })

    test('dengan categoryGroups, label anggota grup digabung jadi 1 kategori & angkanya dijumlah per unit', () => {
        const docs = [
            makeReimbursement('doc1', MJS, 100000, 'Meals Meeting'),
            makeReimbursement('doc2', MJS, 200000, 'Biaya Meeting')
        ]
        const result = aggregateByCategory(docs, [], { year: 2026, categoryGroups: [MEETING_GROUP] })

        expect(Object.keys(result)).toEqual(['Meeting'])
        expect(result.Meeting[MJS][2]).toBe(300000)
    })

    test('label baru yang mengandung anggota grup (substring) otomatis ikut tergabung', () => {
        const docs = [makeReimbursement('doc1', MJS, 150000, 'Cemilan kue ruang meeting')]
        const result = aggregateByCategory(docs, [], { year: 2026, categoryGroups: [MEETING_GROUP] })

        expect(Object.keys(result)).toEqual(['Meeting'])
        expect(result.Meeting[MJS][2]).toBe(150000)
    })

    test('grup berlaku juga untuk item.namaItem dari LPJ, digabung dengan reimbursement di kategori sama', () => {
        const reimbursementDocs = [makeReimbursement('doc1', MJS, 100000, 'Meeting')]
        const lpjDocs = [makeLpj('doc2', MJS, 250000, 'Biaya Meeting')]
        const result = aggregateByCategory(reimbursementDocs, lpjDocs, { year: 2026, categoryGroups: [MEETING_GROUP] })

        expect(Object.keys(result)).toEqual(['Meeting'])
        expect(result.Meeting[MJS][2]).toBe(100000)
        expect(result.Meeting[MJS][3]).toBe(250000)
    })

    test('kategori yang tidak cocok grup mana pun tetap tampil sebagai kategori sendiri', () => {
        const docs = [
            makeReimbursement('doc1', MJS, 100000, 'Meeting'),
            makeReimbursement('doc2', MJS, 50000, 'ATK')
        ]
        const result = aggregateByCategory(docs, [], { year: 2026, categoryGroups: [MEETING_GROUP] })

        expect(Object.keys(result).sort()).toEqual(['ATK', 'Meeting'])
    })
})

describe('listCategoryRawLabels', () => {
    test('mengumpulkan label unik dari reimbursement & lpj, item BBM & yang Disetujui saja', () => {
        const reimbursementDocs = [
            { id: 'r1', status: 'Disetujui', reimbursements: [{ jenis: 'Meeting' }, { jenis: 'BBM Pertalite' }] },
            { id: 'r2', status: 'Disetujui', reimbursements: [{ jenis: 'Meeting' }, { jenis: 'ATK' }] },
            { id: 'r3', status: 'Diproses', reimbursements: [{ jenis: 'Harus Diabaikan' }] }
        ]
        const lpjDocs = [
            { id: 'l1', status: 'Disetujui', lpj: [{ namaItem: 'Biaya Meeting' }, { namaItem: 'BBM Solar' }] }
        ]

        const result = listCategoryRawLabels(reimbursementDocs, lpjDocs)

        expect(result).toEqual(['ATK', 'Biaya Meeting', 'Meeting'])
    })

    test('kosong kalau tidak ada dokumen', () => {
        expect(listCategoryRawLabels([], [])).toEqual([])
        expect(listCategoryRawLabels(undefined, undefined)).toEqual([])
    })
})
