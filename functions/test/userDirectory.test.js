const { buildUserDirectoryEntry } = require('../lib/userDirectory')

describe('buildUserDirectoryEntry', () => {
    // Regresi Bagian M (2026-09-03): field `uid` sempat hilang total dari sini,
    // membuat SEMUA dropdown Reviewer/Validator di form RBS/LPJ/BS dapat
    // `value: undefined` dan memblokir semua submit baru di produksi selama
    // beberapa hari sebelum ketahuan. Test ini menjaga supaya `uid` SELALU ada.
    test('menyertakan uid yang diberikan secara eksplisit', () => {
        const entry = buildUserDirectoryEntry('user-123', { nama: 'Budi', role: 'Employee' })
        expect(entry.uid).toBe('user-123')
    })

    test('mengambil nama, role, unit, platKendaraan dari data user', () => {
        const entry = buildUserDirectoryEntry('user-1', {
            nama: 'Siti',
            role: 'Validator',
            unit: ['PT A', 'PT B'],
            platKendaraan: ['B 1234 XY']
        })

        expect(entry).toEqual({
            uid: 'user-1',
            nama: 'Siti',
            role: 'Validator',
            unit: ['PT A', 'PT B'],
            platKendaraan: ['B 1234 XY']
        })
    })

    test('field yang hilang/salah tipe di-default ke string kosong/array kosong, bukan undefined', () => {
        const entry = buildUserDirectoryEntry('user-2', {})

        expect(entry).toEqual({
            uid: 'user-2',
            nama: '',
            role: '',
            unit: [],
            platKendaraan: []
        })
    })

    test('tidak crash kalau data user null/undefined', () => {
        expect(buildUserDirectoryEntry('user-3', null)).toEqual({
            uid: 'user-3',
            nama: '',
            role: '',
            unit: [],
            platKendaraan: []
        })
        expect(buildUserDirectoryEntry('user-4', undefined)).toEqual({
            uid: 'user-4',
            nama: '',
            role: '',
            unit: [],
            platKendaraan: []
        })
    })

    test('mengabaikan unit/platKendaraan yang bukan array (data korup)', () => {
        const entry = buildUserDirectoryEntry('user-5', { unit: 'bukan-array', platKendaraan: 123 })
        expect(entry.unit).toEqual([])
        expect(entry.platKendaraan).toEqual([])
    })
})
