import { describePengembalianStatus } from './pengembalianUpload'

describe('describePengembalianStatus', () => {
    test('status valid -> tone success', () => {
        expect(describePengembalianStatus('valid')).toEqual({
            label: 'Bukti pengembalian tervalidasi',
            tone: 'success'
        })
    })

    test('status tidak_sesuai -> tone warning', () => {
        expect(describePengembalianStatus('tidak_sesuai').tone).toBe('warning')
    })

    test('status gagal_baca -> tone warning', () => {
        expect(describePengembalianStatus('gagal_baca').tone).toBe('warning')
    })

    test('status tidak dikenal/kosong -> fallback neutral', () => {
        expect(describePengembalianStatus(undefined).tone).toBe('neutral')
        expect(describePengembalianStatus('status-aneh').tone).toBe('neutral')
    })
})
