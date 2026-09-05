// Cocokkan nominal target (mis. sisaLebih LPJ) dengan angka-angka yang kebaca
// OCR (Cloud Vision) dari bukti pengembalian -- dibersihkan dari titik/koma
// pemisah ribuan (format Rupiah) baru dibandingkan exact match.
//
// Dipisah dari index.js supaya bisa dites tanpa mock Vision API/Admin SDK --
// lihat functions/test/pengembalianMatcher.test.js. Logic parsing angka begini
// gampang salah di kasus tepi (nominal tanpa pemisah ribuan, ada teks lain di
// sekitar angka, dst) jadi berharga untuk dites eksplisit.
const textContainsAmount = (text, targetAmount) => {
    const target = Math.round(targetAmount);
    if (!target || !text) return false;

    const matches = text.match(/\d[\d.,]{2,}/g) || [];
    return matches.some((match) => {
        const normalized = parseInt(match.replace(/[.,]/g, ""), 10);
        return normalized === target;
    });
};

module.exports = { textContainsAmount };
