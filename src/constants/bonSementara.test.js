import { BS_LAMPIRAN_THRESHOLD, getBsTotal, requiresBsLampiran } from './bonSementara'

describe('getBsTotal', () => {
    it('menjumlahkan jumlahBS berformat Rupiah dari input form', () => {
        expect(getBsTotal([{ jumlahBS: 'Rp1.500.000' }, { jumlahBS: 'Rp2.000.000' }])).toBe(3500000)
    })

    it('menerima jumlahBS numerik (data tersimpan di Firestore)', () => {
        expect(getBsTotal([{ jumlahBS: 2500000 }])).toBe(2500000)
    })

    it('menganggap kosong sebagai 0', () => {
        expect(getBsTotal([{ jumlahBS: '' }, {}])).toBe(0)
    })
})

describe('requiresBsLampiran', () => {
    it('tidak wajib tepat di batas 3 juta', () => {
        expect(requiresBsLampiran([{ jumlahBS: BS_LAMPIRAN_THRESHOLD }])).toBe(false)
    })

    it('wajib kalau melebihi 3 juta', () => {
        expect(requiresBsLampiran([{ jumlahBS: 'Rp3.000.001' }])).toBe(true)
    })
})
