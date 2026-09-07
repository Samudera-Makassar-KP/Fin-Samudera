// Patokan harga BBM per liter wilayah Sulawesi Selatan (berlaku 1 September
// 2026, Pertamina Patra Niaga). Sebelumnya didefinisikan ulang di 5
// file (FormRbsBbm.jsx, FormRbsOperasional.jsx, FormRbsUmum.jsx,
// FormLpjUmum.jsx, FormLpjMarketing.jsx) sebagai SUBSET berbeda-beda sesuai
// jenis BBM yang relevan untuk form itu (nilainya sendiri selalu sama persis
// tiap file, cuma daftar key yang lebih pendek di beberapa form) -- disatukan
// jadi satu daftar lengkap di sini, aman dipakai semua form karena lookup
// cuma terjadi untuk value yang memang ada di jenisOptions form itu sendiri.
export const BBM_PRICE_PER_LITER = {
    'BBM Pertalite': 10000,
    'BBM Pertamax': 16300,
    'BBM Pertamax Turbo': 19600,
    'BBM Solar': 6800,
    'BBM Dexlite': 23700
}
