// Kode Unit Bisnis dipakai untuk generate nomor dokumen (displayId/nomorBS)
// tiap form. Sebelumnya didefinisikan ulang di 6 file (FormBs.jsx,
// FormRbsBbm/Operasional/Umum.jsx, FormLpjUmum/Marketing.jsx) -- disatukan
// di sini.
//
// PENTING: BS pakai skema kode BERBEDA dari RBS/LPJ untuk 3 unit berikut:
//   PT Makassar Jaya Samudera   -> RBS/LPJ: 'MJS'   | BS: '019'
//   PT Samudera Makassar Logistik -> RBS/LPJ: 'SML' | BS: '035'
//   PT Kendari Jaya Samudera    -> RBS/LPJ: 'KEJS'  | BS: '083'
// Ini BUKAN inkonsistensi yang perlu "diperbaiki" -- itu skema penomoran
// historis yang sudah dipakai sejak awal masing-masing jenis dokumen.
// Menyatukannya akan mengubah pola nomor dokumen BARU di tengah jalan untuk
// unit-unit itu (nomor lama tetap pakai kode lama, nomor baru tiba-tiba beda
// format) -- JANGAN disatukan tanpa keputusan eksplisit & migrasi terpisah.
export const RBS_LPJ_UNIT_CODES = {
    'PT Makassar Jaya Samudera': 'MJS',
    'PT Samudera Makassar Logistik': 'SML',
    'PT Kendari Jaya Samudera': 'KEJS',
    'PT Samudera Kendari Logistik': 'SKEL',
    'PT Samudera Agencies Indonesia': 'SAI',
    'PT SILKargo Indonesia': 'SKI',
    'PT PAD Samudera Perdana': 'SP',
    'PT Masaji Kargosentra Tama': 'MKT',
    'Samudera Indonesia': 'SMDR',
    'Panitia': 'PNTA',
}

export const BS_UNIT_CODES = {
    'PT Makassar Jaya Samudera': '019',
    'PT Samudera Makassar Logistik': '035',
    'PT Kendari Jaya Samudera': '083',
    'PT Samudera Kendari Logistik': 'SKEL',
    'PT Samudera Agencies Indonesia': 'SAI',
    'PT SILKargo Indonesia': 'SKI',
    'PT PAD Samudera Perdana': 'SP',
    'PT Masaji Kargosentra Tama': 'MKT',
    'Samudera Indonesia': 'SMDR',
    'Panitia': 'PNTA',
}

// Dipakai 5 form RBS/LPJ (semuanya identik: fallback ke nama unit apa
// adanya kalau tidak ketemu di peta, bukan lempar error).
export const getUnitCode = (unitName) => RBS_LPJ_UNIT_CODES[unitName] || unitName
