// Util agregasi untuk menu Rekapan (lihat SUMMARY_PENGEMBANGAN.md Bagian A).
// Fungsi murni, tidak menyentuh Firestore -- data mentah diambil di komponen
// (RekapanUnitBisnis.jsx), lalu diagregasi di sini.

import { MJS_UNIT_NAME, applySharingToBbmTotals } from '../constants/rekapanSharing'

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

// Total BBM Rupiah per bulan milik PT Makassar Jaya Samudera SAJA, TANPA filter
// `units` -- dipakai aggregateBbm() untuk hitung pool sharing yang utuh walau
// filter unit sedang aktif menyembunyikan dokumen MJS dari tampilan utama.
const sumMjsBbmUnfiltered = (reimbursementDocs, lpjDocs, year) => {
    const months = emptyMonths()

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui' || doc.user?.unit !== MJS_UNIT_NAME) return
        ;(doc.reimbursements || []).forEach((item) => {
            if (!isBbmValue(item.jenis)) return
            const dateParts = resolveReimbursementItemDate(item, doc)
            if (!dateParts || dateParts.year !== year) return
            months[dateParts.month] += item.biaya || 0
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui' || doc.user?.unit !== MJS_UNIT_NAME) return
        const dateParts = resolveLpjDocDate(doc)
        if (!dateParts || dateParts.year !== year) return
        ;(doc.lpj || []).forEach((item) => {
            if (!isBbmValue(item.namaItem)) return
            const liter = Number(item.jumlah) || 0
            const biayaTotal = item.jumlahBiaya ?? (Number(item.biaya) || 0) * liter
            months[dateParts.month] += biayaTotal
        })
    })

    return months
}

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

// Nomor plat yang sama sering diketik beda-beda (spasi lebih/kurang) di
// keterangan -- dinormalisasi (huruf besar, semua spasi dibuang) supaya jadi
// SATU baris rekap, bukan tercecer. Hasil normalisasi juga dipakai sebagai
// label tampilan (diformat ulang jadi "AB 1234 CD" kalau cocok pola plat
// Indonesia umum, kalau tidak cocok ditampilkan apa adanya tanpa spasi).
export const normalizePlatKey = (rawPlat) => {
    if (!rawPlat) return null
    return rawPlat.toString().trim().toUpperCase().replace(/\s+/g, '')
}

export const formatPlatDisplay = (normalizedKey) => {
    if (!normalizedKey) return normalizedKey
    const match = normalizedKey.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/)
    if (!match) return normalizedKey
    return [match[1], match[2], match[3]].filter(Boolean).join(' ')
}

/**
 * Rekap khusus BBM: total Rupiah per unit per bulan, breakdown per jenis BBM
 * (Pertalite/Pertamax/Pertamax Turbo/Solar/Dexlite), plus drill-down per plat
 * nomor (liter & Rupiah, plat dinormalisasi -- lihat normalizePlatKey). Menarik
 * item BBM dari SEMUA sumber -- `reimbursement` (RBS BBM, RBS Operasional, RBS
 * Umum) dan `lpj` (LPJ Umum, LPJ Marketing) -- dikenali dari prefix "BBM " pada
 * `item.jenis`/`item.namaItem`, bukan cuma dokumen dengan `kategori === 'BBM'`.
 *
 * Di LPJ, `item.biaya` adalah harga satuan (per liter) & `item.jumlah` adalah kuantitas
 * (liter) -- total Rupiah aktualnya `item.jumlahBiaya` (biaya x jumlah), BUKAN `item.biaya`
 * itu sendiri. Di `reimbursement`, `item.biaya` sudah berupa total Rupiah & `item.liter`
 * sudah berupa liter langsung -- keduanya tidak perlu dihitung ulang.
 *
 * `sharingShares` (opsional): { [unitName]: persen } dari
 * computeAllEmployeeShares() (lihat src/constants/rekapanSharing.js) -- kalau
 * diisi, total BBM PT Makassar Jaya Samudera diredistribusi ke semua unit
 * sharing (termasuk PPNP, bukan Unit Bisnis resmi aplikasi) SEBELUM di-return.
 * `byPlat`/`byJenis` TIDAK ikut diredistribusi (tetap murni data submission asli).
 *
 * @returns {{ totals: object, byJenis: object, byPlat: { [plat: string]: { liter: number[], biaya: number[] } } }}
 */
export function aggregateBbm(reimbursementDocs, lpjDocs, { year, units, sharingShares } = {}) {
    const totals = {}
    const byPlat = {}
    const byJenis = {}

    const addEntry = (unit, month, jenis, plat, liter, biayaTotal) => {
        if (!totals[unit]) totals[unit] = emptyMonths()
        totals[unit][month] += biayaTotal

        const jenisLabel = jenis || 'BBM Lainnya'
        if (!byJenis[jenisLabel]) byJenis[jenisLabel] = {}
        if (!byJenis[jenisLabel][unit]) byJenis[jenisLabel][unit] = emptyMonths()
        byJenis[jenisLabel][unit][month] += biayaTotal

        const platKey = formatPlatDisplay(normalizePlatKey(plat)) || 'Tidak diketahui'
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
            addEntry(unit, dateParts.month, item.jenis, item.plat, item.liter || 0, item.biaya || 0)
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
            addEntry(unit, dateParts.month, item.namaItem, item.plat, liter, biayaTotal)
        })
    })

    if (sharingShares) {
        // Redistribusi butuh pool BBM MJS yang UTUH, terlepas dari filter `units`
        // yang sedang aktif (mis. sedang lihat cuma KEJS -- unit itu tetap berhak
        // lihat porsi share-nya dari MJS, walau dokumen MJS sendiri difilter dari
        // totals/byPlat/byJenis di atas). Dihitung ulang unfiltered khusus untuk ini.
        const mjsRawTotals = matchesUnitFilter(MJS_UNIT_NAME, units)
            ? (totals[MJS_UNIT_NAME] || emptyMonths())
            : sumMjsBbmUnfiltered(reimbursementDocs, lpjDocs, year)

        const workingTotals = { ...totals, [MJS_UNIT_NAME]: mjsRawTotals }
        applySharingToBbmTotals(workingTotals, sharingShares)

        Object.keys(workingTotals).forEach((unitName) => {
            if (matchesUnitFilter(unitName, units)) {
                totals[unitName] = workingTotals[unitName]
            } else {
                delete totals[unitName]
            }
        })
    }

    return { totals, byJenis, byPlat }
}
