// Konfigurasi & logic murni untuk sharing biaya BBM -- dari unit yang
// menalangi lebih dulu (mis. PT Makassar Jaya Samudera/MJS) ke unit lain,
// berbasis persentase jumlah karyawan ("pool All Employee"). Sejak Bagian U,
// sharing TIDAK lagi otomatis-blanket untuk semua BBM 1 unit -- Admin/Super
// Admin menandai MANUAL per baris/transaksi BBM mana yang benar dibagi (lihat
// src/constants/rekapanBbmSharing.js untuk penentuan per-baris) -- file ini
// cuma menyediakan angka pool DEFAULT (bisa dipakai apa adanya atau di-override
// custom per baris). Lihat SUMMARY_PENGEMBANGAN.md Bagian T & U untuk konteks.
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
//
// Dipakai sebagai split DEFAULT untuk baris BBM yang ditandai "dibagi" tanpa
// custom split sendiri -- lihat rekapanBbmSharing.js untuk penentuan per-baris
// (dibagi/tidak, pool default/custom) yang HANYA bisa diatur Admin/Super Admin.
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
