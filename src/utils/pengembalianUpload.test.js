// Import langsung dari pengembalianStatus.js (bukan pengembalianUpload.js) --
// pengembalianUpload.js mengimpor firebaseConfig (butuh env var API key asli,
// gagal di lingkungan tanpa itu seperti CI) padahal fungsi yang dites di sini
// murni logic, tidak menyentuh Firebase sama sekali.
import { describePengembalianStatus } from './pengembalianStatus'

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
