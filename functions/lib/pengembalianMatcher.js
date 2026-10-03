// Cocokkan nominal target (mis. sisaLebih LPJ) dengan angka-angka yang kebaca
// OCR (Cloud Vision) dari bukti pengembalian -- dibersihkan dari titik/koma
// pemisah ribuan (format Rupiah) baru dibandingkan exact match.
//
// Dipisah dari index.js supaya bisa dites tanpa mock Vision API/Admin SDK --
// lihat functions/test/pengembalianMatcher.test.js. Logic parsing angka begini
// gampang salah di kasus tepi (nominal tanpa pemisah ribuan, ada teks lain di
// sekitar angka, dst) jadi berharga untuk dites eksplisit.
//
// Bagian AR: sebelumnya SEMUA titik/koma di angka hasil OCR dibuang begitu
// saja tanpa dibedakan perannya (pemisah ribuan vs pemisah desimal/sen).
// Bukti transfer bank yang formatnya Inggris (mis. email OCTO CIMB Niaga:
// "IDR 190,200.00" -- koma jadi pemisah ribuan, titik jadi desimal) atau
// format Indonesia dengan sen eksplisit ("Rp190.200,00") SELALU salah baca:
// ".00"/",00" di akhir ikut dianggap 2 digit ribuan tambahan, jadi
// "190,200.00" terbaca 19020000 (kelebihan 100x) dan TIDAK PERNAH cocok
// dengan nominal aslinya (190200) -- pengguna dapat pesan "Nominal di bukti
// tidak sesuai" padahal nominalnya benar. Sekarang: kalau ekor angka hasil
// OCR berupa separator diikuti PERSIS 2 digit (pola sen/desimal, bukan
// pemisah ribuan yang selalu 3 digit), 2 digit ekor itu dibuang dulu sebelum
// pemisah ribuan yang tersisa dilucuti -- sisaLebih LPJ selalu bilangan bulat
// Rupiah, jadi bagian desimal/sen apa pun aman diabaikan begitu saja.
//
// Bagian BM: Bagian AR di atas MENGASUMSIKAN separator desimal/sen itu
// sendiri selalu ikut terbaca OCR -- ternyata TIDAK SELALU demikian. Diamati
// langsung dari data produksi (5 LPJ nyata, semua status "tidak_sesuai"
// walau nominal di foto SUDAH benar): Cloud Vision kadang kehilangan PERSIS
// karakter separator yang ada tepat sebelum "00" sen terakhir di screenshot
// bukti transfer bank (karakternya kecil/tipis, gampang tidak terbaca),
// menghasilkan teks seperti "274,69200" (bukan "274,692.00") atau
// "1,768,90000" (bukan "1.768.900,00") -- pemisah ribuan SEBELUMNYA tetap
// kebaca normal, cuma pemisah PALING AKHIR (persis di depan sen) yang
// hilang. Pola Bagian AR (butuh separator eksplisit sebelum 2 digit
// terakhir) tidak mengenali ini sama sekali -- "00" ikut dianggap bagian
// ribuan, nominal terbaca 100x lebih besar, SELALU gagal cocok.
// Sekarang: kalau pola Bagian AR TIDAK ketemu (tidak ada separator sebelum
// 2 digit terakhir) TAPI angkanya berakhir "00" dan cukup panjang (>=5
// digit setelah pemisah dilucuti -- bukan angka pendek yang kebetulan
// berakhir 00), coba JUGA tafsiran "2 digit terakhir itu sen yang
// separatornya hilang" sebagai tambahan, bukan pengganti, tafsiran biasa.
const textContainsAmount = (text, targetAmount) => {
    const target = Math.round(targetAmount);
    if (!target || !text) return false;

    const matches = text.match(/\d[\d.,]{2,}/g) || [];
    return matches.some((match) => {
        const decimalSuffix = match.match(/^(.*)[.,](\d{2})$/);
        const integerPart = decimalSuffix ? decimalSuffix[1] : match;
        const normalized = parseInt(integerPart.replace(/[.,]/g, ""), 10);
        if (normalized === target) return true;

        if (!decimalSuffix && /00$/.test(match)) {
            const digitsOnly = match.replace(/[.,]/g, "");
            if (digitsOnly.length >= 5) {
                const withMissingSeparator = parseInt(digitsOnly.slice(0, -2), 10);
                if (withMissingSeparator === target) return true;
            }
        }

        return false;
    });
};

module.exports = { textContainsAmount };
