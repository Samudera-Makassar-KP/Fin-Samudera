// Util agregasi untuk menu Rekapan (lihat SUMMARY_PENGEMBANGAN.md Bagian A).
// Fungsi murni, tidak menyentuh Firestore -- data mentah diambil di komponen
// (RekapanUnitBisnis.jsx), lalu diagregasi di sini.

export const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

const MONTH_COUNT = 12

export const formatRupiah = (value) => `Rp${Math.round(value || 0).toLocaleString('id-ID')}`

export const emptyMonths = () => Array(MONTH_COUNT).fill(0)

export const sumMonths = (months) => (months || []).reduce((total, value) => total + (value || 0), 0)

const parseDateParts = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return null
    return { month: date.getMonth(), year: date.getFullYear() }
}

// Item reimbursement punya field `tanggal` (tanggal aktivitas) per item -- itu basis
// tanggal yang dipakai. `doc.tanggalPengajuan` cuma fallback kalau `tanggal` kosong/rusak.
export const resolveReimbursementItemDate = (item, doc) =>
    parseDateParts(item?.tanggal) || parseDateParts(doc?.tanggalPengajuan)

// PENTING: item `lpj` TIDAK PUNYA field tanggal per item sama sekali (dikonfirmasi dari
// struktur FormLpjUmum.jsx & FormLpjMarketing.jsx) -- satu-satunya basis tanggal yang
// tersedia untuk LPJ adalah `tanggalPengajuan` di level dokumen. Ini keterbatasan data,
// bukan bug: rekap LPJ dikelompokkan per tanggal submit, bukan tanggal aktivitas asli.
export const resolveLpjDocDate = (doc) => parseDateParts(doc?.tanggalPengajuan)

const matchesUnitFilter = (unit, units) => !units || units.length === 0 || units.includes(unit)

// Semua jenis/namaItem BBM (RBS BBM, RBS Operasional, RBS Umum, LPJ Umum, LPJ Marketing)
// selalu diberi prefix "BBM " di form-nya masing-masing -- dipakai untuk mengecualikan
// item BBM dari rekap kategori umum (`aggregateByCategory`) dan menariknya semua ke
// rekap khusus BBM (`aggregateBbm`), TERLEPAS dari `kategori` di level dokumen (dokumen
// Operasional/GA-Umum/LPJ bisa berisi campuran item BBM & non-BBM dalam satu pengajuan).
const isBbmValue = (value) => typeof value === 'string' && value.startsWith('BBM ')

/**
 * Rekap per kategori (ATK, RTG, RTK, Entertaint, Parkir, Meals Lembur, Meals Meeting, Toll,
 * Lainnya, dst) dari `reimbursement` dan `lpj` -- item berjenis BBM dikecualikan di sini,
 * ditangani `aggregateBbm` supaya tidak dihitung dua kali. Kategori Entertaint/Meals Lembur/
 * Parkir digabung lintas RBS Operasional & RBS Umum/LPJ (bukan dipisah per asal form) --
 * lihat catatan asumsi di rencana pengembangan.
 *
 * @returns {{ [kategori: string]: { [unit: string]: number[] } }}
 */
export function aggregateByCategory(reimbursementDocs, lpjDocs, { year, units } = {}) {
    const result = {}

    const addToResult = (category, unit, month, amount) => {
        if (!category || !unit || month == null || !amount) return
        if (!result[category]) result[category] = {}
        if (!result[category][unit]) result[category][unit] = emptyMonths()
        result[category][unit][month] += amount
    }

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        if (!matchesUnitFilter(unit, units)) return

        ;(doc.reimbursements || []).forEach((item) => {
            if (isBbmValue(item.jenis)) return
            const dateParts = resolveReimbursementItemDate(item, doc)
            if (!dateParts || dateParts.year !== year) return
            addToResult(item.jenis, unit, dateParts.month, item.biaya || 0)
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        if (!matchesUnitFilter(unit, units)) return

        const dateParts = resolveLpjDocDate(doc)
        if (!dateParts || dateParts.year !== year) return

        ;(doc.lpj || []).forEach((item) => {
            if (isBbmValue(item.namaItem)) return
            const jumlahBiaya = item.jumlahBiaya ?? (Number(item.biaya) || 0) * (Number(item.jumlah) || 0)
            addToResult(item.namaItem, unit, dateParts.month, jumlahBiaya)
        })
    })

    return result
}

/**
 * Rekap khusus BBM: total Rupiah per unit per bulan, plus drill-down per plat nomor
 * (liter & Rupiah). Menarik item BBM dari SEMUA sumber -- `reimbursement` (RBS BBM, RBS
 * Operasional, RBS Umum) dan `lpj` (LPJ Umum, LPJ Marketing) -- dikenali dari prefix "BBM "
 * pada `item.jenis`/`item.namaItem`, bukan cuma dokumen dengan `kategori === 'BBM'`.
 *
 * Di LPJ, `item.biaya` adalah harga satuan (per liter) & `item.jumlah` adalah kuantitas
 * (liter) -- total Rupiah aktualnya `item.jumlahBiaya` (biaya x jumlah), BUKAN `item.biaya`
 * itu sendiri. Di `reimbursement`, `item.biaya` sudah berupa total Rupiah & `item.liter`
 * sudah berupa liter langsung -- keduanya tidak perlu dihitung ulang.
 *
 * @returns {{ totals: { [unit: string]: number[] }, byPlat: { [plat: string]: { liter: number[], biaya: number[] } } }}
 */
export function aggregateBbm(reimbursementDocs, lpjDocs, { year, units } = {}) {
    const totals = {}
    const byPlat = {}

    const addEntry = (unit, month, plat, liter, biayaTotal) => {
        if (!totals[unit]) totals[unit] = emptyMonths()
        totals[unit][month] += biayaTotal

        const platKey = plat || 'Tidak diketahui'
        if (!byPlat[platKey]) byPlat[platKey] = { liter: emptyMonths(), biaya: emptyMonths() }
        byPlat[platKey].liter[month] += liter
        byPlat[platKey].biaya[month] += biayaTotal
    }

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        if (!matchesUnitFilter(unit, units)) return

        ;(doc.reimbursements || []).forEach((item) => {
            if (!isBbmValue(item.jenis)) return
            const dateParts = resolveReimbursementItemDate(item, doc)
            if (!dateParts || dateParts.year !== year) return
            addEntry(unit, dateParts.month, item.plat, item.liter || 0, item.biaya || 0)
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        if (!matchesUnitFilter(unit, units)) return

        const dateParts = resolveLpjDocDate(doc)
        if (!dateParts || dateParts.year !== year) return

        ;(doc.lpj || []).forEach((item) => {
            if (!isBbmValue(item.namaItem)) return
            const liter = Number(item.jumlah) || 0
            const biayaTotal = item.jumlahBiaya ?? (Number(item.biaya) || 0) * liter
            addEntry(unit, dateParts.month, item.plat, liter, biayaTotal)
        })
    })

    return { totals, byPlat }
}
