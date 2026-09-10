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
const textContainsAmount = (text, targetAmount) => {
    const target = Math.round(targetAmount);
    if (!target || !text) return false;

    const matches = text.match(/\d[\d.,]{2,}/g) || [];
    return matches.some((match) => {
        const decimalSuffix = match.match(/^(.*)[.,](\d{2})$/);
        const integerPart = decimalSuffix ? decimalSuffix[1] : match;
        const normalized = parseInt(integerPart.replace(/[.,]/g, ""), 10);
        return normalized === target;
    });
};

module.exports = { textContainsAmount };
