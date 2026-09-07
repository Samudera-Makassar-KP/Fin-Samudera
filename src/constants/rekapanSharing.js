// Konfigurasi & logic murni untuk sharing biaya BBM dari PT Makassar Jaya
// Samudera (MJS, "menalangi" BBM lebih dulu) ke unit lain, berbasis persentase
// jumlah karyawan ("pool All Employee") -- lihat SUMMARY_PENGEMBANGAN.md
// Bagian T untuk konteks lengkap & contoh perhitungan dari user.
//
// 9 unit di sini SENGAJA beda dari daftar 10 Unit Bisnis resmi aplikasi
// (src/constants/businessUnits.js): "Samudera Indonesia" & "Panitia" tidak
// ikut pool sharing ini (bukan bagian tabel headcount user), sementara PPNP
// ("Perusahaan Pelayaran Nusantara Panurjwan") BUKAN Unit Bisnis resmi
// aplikasi sama sekali (tidak bisa dipilih di form RBS/BS/LPJ, tidak ada
// karyawan yang login sebagai unit ini) -- PPNP di sini murni penerima porsi
// share, ditampilkan sebagai baris tambahan KHUSUS di tabel BBM Rekapan.
export const SHARING_UNITS = [
    { code: 'MKT', name: 'PT Masaji Kargosentra Tama' },
    { code: 'SAG', name: 'PT Samudera Agencies Indonesia' },
    { code: 'SP', name: 'PT PAD Samudera Perdana' },
    { code: 'SKI', name: 'PT SILKargo Indonesia' },
    { code: 'MJS', name: 'PT Makassar Jaya Samudera' },
    { code: 'SML', name: 'PT Samudera Makassar Logistik' },
    { code: 'KEJS', name: 'PT Kendari Jaya Samudera' },
    { code: 'SKEL', name: 'PT Samudera Kendari Logistik' },
    { code: 'PPNP', name: 'Perusahaan Pelayaran Nusantara Panurjwan' }
]

export const MJS_UNIT_NAME = 'PT Makassar Jaya Samudera'
export const PPNP_UNIT_NAME = 'Perusahaan Pelayaran Nusantara Panurjwan'

// headcountByCode: { [code]: string[] } (daftar nama per unit, dari
// /rekapanHeadcount) -- hitung jumlah orang per unit, lalu persentase pool
// "All Employee" = jumlah_unit / total_semua_unit, dibulatkan ke persen
// terdekat (Math.round, cocok dengan hasil contoh perhitungan user).
export function computeAllEmployeeShares(headcountByCode) {
    const counts = SHARING_UNITS.map((u) => ({
        name: u.name,
        count: Array.isArray(headcountByCode?.[u.code]) ? headcountByCode[u.code].length : 0
    }))

    const total = counts.reduce((sum, u) => sum + u.count, 0)
    if (!total) return {}

    const shares = {}
    counts.forEach((u) => {
        shares[u.name] = Math.round((u.count / total) * 100)
    })
    return shares
}

// Redistribusi total BBM MJS (per bulan) ke semua unit di SHARING_UNITS sesuai
// `shares` (persentase 0-100 per nama unit, dari computeAllEmployeeShares).
// `totals`: { [unitName]: number[12] } hasil aggregateBbm() -- DIUBAH DI TEMPAT
// (mutate totals langsung, dipanggil dari aggregateBbm sebelum return).
// Porsi MJS sendiri (`shares[MJS]`, biasanya <100%) MENGGANTIKAN total asli
// MJS (bukan ditambah) -- total asli itu SENDIRI adalah pool yang dibagi-bagi,
// jadi menjumlahkannya lagi ke MJS akan menghitung dobel.
export function applySharingToBbmTotals(totals, shares) {
    if (!shares || Object.keys(shares).length === 0) return totals
    const mjsMonths = totals[MJS_UNIT_NAME]
    if (!mjsMonths) return totals

    const original = mjsMonths.slice()

    SHARING_UNITS.forEach((u) => {
        const pct = (shares[u.name] || 0) / 100
        if (u.name === MJS_UNIT_NAME) return

        if (!totals[u.name]) totals[u.name] = Array(12).fill(0)
        original.forEach((amount, month) => {
            totals[u.name][month] += amount * pct
        })
    })

    const mjsPct = (shares[MJS_UNIT_NAME] || 0) / 100
    totals[MJS_UNIT_NAME] = original.map((amount) => amount * mjsPct)

    return totals
}
