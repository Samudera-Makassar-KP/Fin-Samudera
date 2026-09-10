import { isEditHistoryEntry, getEditHistoryEntries, getEditCount, getEditorRoleLabel } from './editHistory'

describe('editHistory (Bagian AN)', () => {
    const statusHistory = [
        { status: 'Diajukan', timestamp: '2026-09-01T00:00:00.000Z', actor: 'uid-owner' },
        { status: 'Ditolak oleh Reviewer 1', timestamp: '2026-09-02T00:00:00.000Z', actor: 'uid-rev1', reason: 'Nominal salah' },
        { status: 'Data Diubah oleh Admin', timestamp: '2026-09-03T00:00:00.000Z', actor: 'uid-admin', reason: 'Perbaiki nominal sesuai kuitansi' },
        { status: 'Diajukan', timestamp: '2026-09-03T00:05:00.000Z', actor: 'uid-owner' },
        { status: 'Data Diubah oleh Super Admin', timestamp: '2026-09-05T00:00:00.000Z', actor: 'uid-superadmin', reason: 'Ganti plat' }
    ]

    test('isEditHistoryEntry mendeteksi entri dengan prefix "Data Diubah oleh "', () => {
        expect(isEditHistoryEntry({ status: 'Data Diubah oleh Admin' })).toBe(true)
        expect(isEditHistoryEntry({ status: 'Diajukan' })).toBe(false)
        expect(isEditHistoryEntry({})).toBe(false)
        expect(isEditHistoryEntry(null)).toBe(false)
    })

    test('getEditHistoryEntries hanya mengembalikan entri edit, terbaru duluan', () => {
        const entries = getEditHistoryEntries(statusHistory)
        expect(entries).toHaveLength(2)
        expect(entries[0].reason).toBe('Ganti plat')
        expect(entries[1].reason).toBe('Perbaiki nominal sesuai kuitansi')
    })

    test('getEditHistoryEntries mengembalikan array kosong kalau tidak ada edit atau input tidak valid', () => {
        expect(getEditHistoryEntries([{ status: 'Diajukan' }])).toEqual([])
        expect(getEditHistoryEntries(undefined)).toEqual([])
        expect(getEditHistoryEntries(null)).toEqual([])
    })

    test('getEditCount menghitung jumlah entri edit', () => {
        expect(getEditCount(statusHistory)).toBe(2)
        expect(getEditCount([])).toBe(0)
    })

    test('getEditorRoleLabel mengambil label peran dari status entry', () => {
        expect(getEditorRoleLabel({ status: 'Data Diubah oleh Admin' })).toBe('Admin')
        expect(getEditorRoleLabel({ status: 'Data Diubah oleh Super Admin' })).toBe('Super Admin')
        expect(getEditorRoleLabel({ status: 'Diajukan' })).toBe(null)
    })
})
