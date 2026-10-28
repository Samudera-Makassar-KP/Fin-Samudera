import { buildApprovalUpdate, buildRejectionUpdate, canActOnApproval } from './approvalRules'

const NOW = '2026-10-17T00:00:00.000Z'
const makeItem = (status, extra = {}) => ({
    status,
    user: { uid: 'owner', validator: ['val'], reviewer1: ['rev1'], reviewer2: ['rev2'] },
    ...extra
})

describe('buildApprovalUpdate -- BS', () => {
    it('Reviewer 1 memajukan Diajukan ke Diproses', () => {
        const result = buildApprovalUpdate('bs', makeItem('Diajukan'), 'rev1', 'Reviewer', NOW)
        expect(result.updateData).toEqual({ status: 'Diproses', approvedByReviewer1: true, approvedByReviewer1Status: 'reviewer' })
        expect(result.historyEntry).toEqual({ status: 'Disetujui oleh Reviewer 1', timestamp: NOW, actor: 'rev1' })
    })

    it('Reviewer 2 menyetujui penuh setelah Reviewer 1', () => {
        const item = makeItem('Diproses', { approvedByReviewer1Status: 'reviewer' })
        expect(buildApprovalUpdate('bs', item, 'rev2', 'Reviewer', NOW).updateData.status).toBe('Disetujui')
    })

    it('Reviewer 2 tidak bisa approve di tahap Reviewer 1', () => {
        expect(buildApprovalUpdate('bs', makeItem('Diajukan'), 'rev2', 'Reviewer', NOW)).toBeNull()
    })

    it('Super Admin menggantikan Reviewer 2', () => {
        const result = buildApprovalUpdate('bs', makeItem('Diproses'), 'sa', 'Super Admin', NOW)
        expect(result.historyEntry.status).toBe('Disetujui oleh Super Admin (Pengganti Reviewer 2)')
        expect(result.updateData.status).toBe('Disetujui')
    })
})

describe('buildApprovalUpdate -- RBS/LPJ', () => {
    it.each(['rbs', 'lpj'])('%s: Validator memvalidasi Diajukan', (docType) => {
        const result = buildApprovalUpdate(docType, makeItem('Diajukan'), 'val', 'Validator', NOW)
        expect(result.updateData).toEqual({ status: 'Divalidasi', approvedByValidator: true })
    })

    it('Validator yang sekaligus Reviewer 1 langsung ke Diproses', () => {
        const item = makeItem('Diajukan', { user: { validator: ['x'], reviewer1: ['x'], reviewer2: ['rev2'] } })
        const result = buildApprovalUpdate('rbs', item, 'x', 'Validator', NOW)
        expect(result.updateData.status).toBe('Diproses')
        expect(result.historyEntry.status).toBe('Disetujui oleh Reviewer 1 Sekaligus Validator')
    })

    it('Reviewer 1 tidak bisa approve sebelum divalidasi', () => {
        expect(buildApprovalUpdate('lpj', makeItem('Diajukan'), 'rev1', 'Reviewer', NOW)).toBeNull()
    })

    it('Reviewer 2 menyetujui penuh', () => {
        const item = makeItem('Diproses', { approvedByReviewer1Status: 'reviewer' })
        expect(buildApprovalUpdate('lpj', item, 'rev2', 'Reviewer', NOW).updateData.status).toBe('Disetujui')
    })

    it('dokumen yang sudah Disetujui tidak bisa di-approve lagi, termasuk oleh Super Admin', () => {
        expect(buildApprovalUpdate('rbs', makeItem('Disetujui'), 'sa', 'Super Admin', NOW)).toBeNull()
    })
})

describe('buildRejectionUpdate', () => {
    it('Validator menolak RBS Diajukan dengan alasan', () => {
        const result = buildRejectionUpdate('rbs', makeItem('Diajukan'), 'val', 'Validator', 'Nota buram', NOW)
        expect(result.updateData).toEqual({ status: 'Ditolak', approvedByValidatorStatus: 'validator', rejectReason: 'Nota buram' })
        expect(result.historyEntry).toEqual({ status: 'Ditolak oleh Validator', timestamp: NOW, actor: 'val', reason: 'Nota buram' })
    })

    it('Reviewer 1 tidak bisa menolak LPJ yang belum divalidasi', () => {
        expect(() => buildRejectionUpdate('lpj', makeItem('Diajukan'), 'rev1', 'Reviewer', 'x', NOW)).toThrow('tidak memiliki akses')
    })

    it('Super Admin menolak BS di tahap Reviewer 2', () => {
        const item = makeItem('Diproses', { approvedByReviewer1Status: 'reviewer' })
        const result = buildRejectionUpdate('bs', item, 'sa', 'Super Admin', '', NOW)
        expect(result.historyEntry.status).toBe('Ditolak oleh Super Admin (Pengganti Reviewer 2)')
        expect(result.updateData.rejectReason).toBe('Alasan tidak diberikan')
    })
})

describe('canActOnApproval', () => {
    it('hanya approver tahap aktif yang dapat tombol', () => {
        const item = makeItem('Divalidasi')
        expect(canActOnApproval('rbs', item, 'rev1', 'Reviewer')).toBe(true)
        expect(canActOnApproval('rbs', item, 'val', 'Validator')).toBe(false)
        expect(canActOnApproval('rbs', item, 'owner', 'Employee')).toBe(false)
    })
})
