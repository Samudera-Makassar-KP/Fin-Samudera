const { textContainsAmount } = require('../lib/pengembalianMatcher')

describe('textContainsAmount', () => {
    test('cocok dengan nominal berformat titik ribuan', () => {
        expect(textContainsAmount('Total transfer Rp150.000,- berhasil', 150000)).toBe(true)
    })

    test('cocok dengan nominal tanpa pemisah ribuan', () => {
        expect(textContainsAmount('Nominal 150000', 150000)).toBe(true)
    })

    test('tidak cocok kalau nominal di teks beda dari target', () => {
        expect(textContainsAmount('Total transfer Rp200.000,- berhasil', 150000)).toBe(false)
    })

    test('cocok salah satu dari beberapa angka di teks OCR', () => {
        const text = 'No Ref: 88213 \n Tanggal: 05092026 \n Jumlah: Rp150.000 \n Saldo: Rp2.450.000'
        expect(textContainsAmount(text, 150000)).toBe(true)
    })

    test('membulatkan target sebelum dibandingkan', () => {
        expect(textContainsAmount('Nominal 150000', 149999.6)).toBe(true)
    })

    test('false kalau teks kosong/tidak ada angka', () => {
        expect(textContainsAmount('', 150000)).toBe(false)
        expect(textContainsAmount('Tidak ada angka di sini', 150000)).toBe(false)
    })

    test('false kalau target 0 atau tidak valid', () => {
        expect(textContainsAmount('Nominal 150000', 0)).toBe(false)
        expect(textContainsAmount('Nominal 150000', NaN)).toBe(false)
    })

    test('false kalau text null/undefined (dipanggil setelah OCR gagal)', () => {
        expect(textContainsAmount(null, 150000)).toBe(false)
        expect(textContainsAmount(undefined, 150000)).toBe(false)
    })

    // Bagian AR: bukti transfer format Inggris (mis. email OCTO CIMB Niaga)
    // pakai koma sebagai pemisah ribuan & titik sebagai desimal, SELALU
    // menyertakan ".00" di akhir -- kasus nyata yang dilaporkan user.
    test('cocok dengan nominal format Inggris + desimal ".00" (bukti transfer OCTO)', () => {
        const text = 'Transfer Amount: IDR 190,200.00\nFee: IDR 0.00'
        expect(textContainsAmount(text, 190200)).toBe(true)
    })

    test('cocok dengan nominal format Indonesia + sen ",00" di akhir', () => {
        expect(textContainsAmount('Jumlah Transfer: Rp190.200,00', 190200)).toBe(true)
    })

    test('tidak cocok kalau nominal format Inggris+desimal beda dari target', () => {
        const text = 'Transfer Amount: IDR 190,200.00'
        expect(textContainsAmount(text, 150000)).toBe(false)
    })

    test('tetap cocok salah satu dari beberapa angka campuran format Inggris & Indonesia', () => {
        const text = 'Reference: MB10090373337727\nTransfer Amount: IDR 190,200.00\nFee: IDR 0.00'
        expect(textContainsAmount(text, 190200)).toBe(true)
    })

    // Bagian BM: kasus nyata dari data produksi -- Vision OCR kehilangan
    // separator desimal/sen PERSIS sebelum "00" terakhir (karakternya kecil
    // di screenshot bukti transfer bank), jadi "274.692,00" terbaca
    // "274,69200" (tanpa separator sebelum "00"), bukan "274,692.00" atau
    // "274,692,00" yang sudah ditangani Bagian AR. Lihat Bagian BL/BM di
    // SUMMARY_PENGEMBANGAN.md untuk detail investigasinya.
    test('cocok meski separator sen hilang total (OCTO CIMB Niaga, LPJ.MRO.KEJS.260917.0006)', () => {
        const text = 'Transfer ke\nSukses!\nTransaksi Anda telah berhasil\nOCTO\nBY CIMB NIAGA\nNOMINAL\nIDR 274,69200\nKENDARI JAYA SAMUDERA\n800174855900'
        expect(textContainsAmount(text, 274692)).toBe(true)
    })

    test('cocok meski separator sen hilang total, format Inggris (LPJ.MRO.SKEL.261003.0017)', () => {
        const text = 'Successful!\nYour transaction is successful\nОСТО\nBY CIMB NIAGA\nAMOUNT\nIDR 180,00000\nTransfer to\nSAMUDERA KENDARI LOGISTIK\n800150176800'
        expect(textContainsAmount(text, 180000)).toBe(true)
    })

    test('cocok meski separator sen hilang total, nominal kecil (LPJ.GAU.MJS.260928.0006)', () => {
        const text = 'Sukses!\nTransaksi Anda telah berhasil\nTransfer ke\nOCTO\nBY CIMB NIAGA\nNOMINAL\nIDR 36,00000\nSITI MULIANA'
        expect(textContainsAmount(text, 36000)).toBe(true)
    })

    test('cocok meski separator sen hilang total, dua pemisah ribuan (LPJ.GAU.KEJS.260918.0002)', () => {
        const text = 'Successful!\nAMOUNT\nIDR 1,768,90000\nTransaction Time\n18 Sep 2026 15:53\nKENDARI JAYA SAMUDERA\n800174879700'
        expect(textContainsAmount(text, 1768900)).toBe(true)
    })

    test('nomor rekening yang kebetulan berakhir 00 tidak cocok dengan target tidak berelasi', () => {
        // Nomor rekening (mis. 800174855900 di kasus nyata di atas) ikut
        // kena pola "berakhir 00, >=5 digit" -- pastikan itu tidak membuat
        // cocok target LPJ yang sungguhan tidak berelasi sama sekali.
        const text = 'Rekening: 800174855900'
        expect(textContainsAmount(text, 180000)).toBe(false)
    })
})
