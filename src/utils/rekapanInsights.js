// Bagian BR: ringkasan "Biaya Tahun Lalu / Tahun Berjalan / Target Tahun Depan"
// + analisa & saran penghematan per kategori untuk menu Rekapan (khusus Super
// Admin). Fungsi murni -- input-nya hasil aggregateByCategory/aggregateBbm yang
// SAMA dengan tabel Rekapan, jadi angka di kartu selalu konsisten dengan tabel
// (termasuk sharing antar unit, entri manual, dan filter Unit Bisnis).

import { formatRupiah, formatPlatDisplay } from './rekapanAggregation'

export const BBM_INSIGHT_KEY = 'BBM'
export const DEFAULT_TARGET_REDUCTION_PCT = 10

const sumMonthIndexes = (months, monthIndexes) =>
    monthIndexes.reduce((total, month) => total + (months?.[month] || 0), 0)

const sumUnits = (byUnit, monthIndexes) =>
    Object.values(byUnit || {}).reduce((total, months) => total + sumMonthIndexes(months, monthIndexes), 0)

export const monthRange = (count) => Array.from({ length: count }, (_, index) => index)

// Total per kategori untuk bulan-bulan tertentu. BBM (dari aggregateBbm.totals)
// digabung sebagai satu kategori "BBM" -- kategori non-BBM dari
// aggregateByCategory memang sudah tidak berisi item BBM.
export function totalsByCategory(categoryData, bbmTotals, monthIndexes) {
    const result = {}
    const bbm = sumUnits(bbmTotals, monthIndexes)
    if (bbm) result[BBM_INSIGHT_KEY] = bbm
    Object.entries(categoryData || {}).forEach(([category, byUnit]) => {
        const total = sumUnits(byUnit, monthIndexes)
        if (total) result[category] = (result[category] || 0) + total
    })
    return result
}

export const sumValues = (byCategory) => Object.values(byCategory || {}).reduce((total, value) => total + value, 0)

export const percentChange = (previous, current) => (previous > 0 ? ((current - previous) / previous) * 100 : null)

// Proyeksi setahun penuh dari rata-rata bulanan periode berjalan (linear).
export const projectFullYear = (amount, monthsElapsed) =>
    monthsElapsed > 0 && monthsElapsed < 12 ? (amount / monthsElapsed) * 12 : amount

/**
 * @param prevFullByCat       total per kategori tahun lalu (12 bulan)
 * @param prevSamePeriodByCat total per kategori tahun lalu, bulan yang sama dengan periode berjalan
 * @param currentByCat        total per kategori tahun berjalan (s.d. monthsElapsed)
 * @param monthsElapsed       jumlah bulan periode berjalan (12 kalau tahunnya sudah lewat)
 * @param targetReductionPct  target penurunan biaya tahun depan (%)
 */
export function buildCostOutlook({ prevFullByCat, prevSamePeriodByCat, currentByCat, monthsElapsed, targetReductionPct }) {
    const pct = Number(targetReductionPct) || 0
    const previousYearTotal = sumValues(prevFullByCat)
    const previousSamePeriodTotal = sumValues(prevSamePeriodByCat)
    const currentTotal = sumValues(currentByCat)
    const projectedCurrentYearTotal = projectFullYear(currentTotal, monthsElapsed)
    const targetNextYearTotal = projectedCurrentYearTotal * (1 - pct / 100)

    const categoryNames = new Set([
        ...Object.keys(prevFullByCat || {}),
        ...Object.keys(currentByCat || {})
    ])

    const categories = [...categoryNames].map((category) => {
        const current = currentByCat?.[category] || 0
        const previousSamePeriod = prevSamePeriodByCat?.[category] || 0
        const projected = projectFullYear(current, monthsElapsed)
        const target = projected * (1 - pct / 100)
        return {
            category,
            previousYear: prevFullByCat?.[category] || 0,
            previousSamePeriod,
            current,
            changeAmount: current - previousSamePeriod,
            changePct: percentChange(previousSamePeriod, current),
            share: currentTotal > 0 ? (current / currentTotal) * 100 : 0,
            projected,
            target,
            saving: projected - target
        }
    }).sort((a, b) => b.current - a.current || b.previousYear - a.previousYear)

    const topPreviousCategory = Object.entries(prevFullByCat || {}).sort((a, b) => b[1] - a[1])[0] || null

    return {
        previousYearTotal,
        previousYearMonthlyAverage: previousYearTotal / 12,
        topPreviousCategory: topPreviousCategory ? { category: topPreviousCategory[0], amount: topPreviousCategory[1] } : null,
        previousSamePeriodTotal,
        currentTotal,
        changeAmount: currentTotal - previousSamePeriodTotal,
        changePct: percentChange(previousSamePeriodTotal, currentTotal),
        projectedCurrentYearTotal,
        targetReductionPct: pct,
        targetNextYearTotal,
        targetSaving: projectedCurrentYearTotal - targetNextYearTotal,
        categories
    }
}

// Rincian pendukung analisa: unit penyumbang terbesar (semua kategori) dan,
// khusus BBM, plat & jenis BBM terbesar.
export function buildCategoryDetail(category, { categoryData, bbmData, monthIndexes }) {
    const toRanked = (entries, total) => entries
        .filter(([, amount]) => amount > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({ name, amount, share: total > 0 ? (amount / total) * 100 : 0 }))

    if (category === BBM_INSIGHT_KEY) {
        const unitEntries = Object.entries(bbmData?.totals || {}).map(([unit, months]) => [unit, sumMonthIndexes(months, monthIndexes)])
        const total = unitEntries.reduce((sum, [, amount]) => sum + amount, 0)

        const platEntries = Object.entries(bbmData?.byPlat || {}).map(([plat, data]) => ({
            name: formatPlatDisplay(plat),
            amount: sumMonthIndexes(data.biaya, monthIndexes),
            liter: sumMonthIndexes(data.liter, monthIndexes)
        })).filter((plat) => plat.amount > 0).sort((a, b) => b.amount - a.amount)
        const platTotal = platEntries.reduce((sum, plat) => sum + plat.amount, 0)

        const jenisEntries = Object.entries(bbmData?.byJenis || {}).map(([jenis, byUnit]) => [jenis, sumUnits(byUnit, monthIndexes)])
        const jenisTotal = jenisEntries.reduce((sum, [, amount]) => sum + amount, 0)

        return {
            topUnits: toRanked(unitEntries, total).slice(0, 3),
            topPlats: platEntries.slice(0, 3).map((plat) => ({ ...plat, share: platTotal > 0 ? (plat.amount / platTotal) * 100 : 0 })),
            topJenis: toRanked(jenisEntries, jenisTotal).slice(0, 3)
        }
    }

    const unitEntries = Object.entries(categoryData?.[category] || {}).map(([unit, months]) => [unit, sumMonthIndexes(months, monthIndexes)])
    const total = unitEntries.reduce((sum, [, amount]) => sum + amount, 0)
    return { topUnits: toRanked(unitEntries, total).slice(0, 3) }
}

const formatPct = (value) => `${Math.abs(value).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`

// Saran praktis per jenis biaya -- dicocokkan dari nama kategori (kategori
// custom hasil "Kelola Kategori" tetap kena kalau namanya mengandung kata kunci).
const CATEGORY_TIPS = [
    {
        match: /atk|alat tulis|kertas|tinta|toner/i,
        tips: [
            'Alihkan approval & arsip ke dokumen digital lewat sistem untuk mengurangi pemakaian kertas dan tinta.',
            'Pembelian ATK dipusatkan per kuartal dengan stok minimum, bukan beli satuan per kebutuhan.'
        ]
    },
    {
        match: /rtk|rtg|rumah tangga|kebersihan|cleaning/i,
        tips: [
            'Buat kontrak harga dengan vendor tetap atau beli grosir terjadwal untuk barang rutin.',
            'Catat stok bulanan per lokasi supaya pemakaian berlebih cepat terdeteksi.'
        ]
    },
    {
        match: /meal|meeting|konsumsi|entertain|jamuan|cemilan/i,
        tips: [
            'Tetapkan plafon biaya per orang per acara dan wajibkan daftar hadir sebagai lampiran.',
            'Utamakan meeting online untuk koordinasi rutin; konsumsi hanya untuk meeting dengan pihak luar.'
        ]
    },
    {
        match: /parkir|toll|tol|e-toll/i,
        tips: [
            'Gabungkan perjalanan searah (car pooling) dan rencanakan rute sebelum berangkat.',
            'Gunakan kartu e-toll korporat per kendaraan supaya biaya terekap otomatis dan mudah dievaluasi.'
        ]
    },
    {
        match: /lembur|buruh/i,
        tips: [
            'Rencanakan jadwal kerja supaya lembur hanya untuk pekerjaan yang benar-benar mendesak dan disetujui di muka.',
            'Bandingkan biaya buruh harian dengan opsi kontrak borongan untuk pekerjaan berulang.'
        ]
    },
    {
        match: /listrik|air|utilitas|pdam|pln|internet|telepon|pulsa/i,
        tips: [
            'Audit pemakaian listrik/air/internet per lokasi; matikan AC & lampu di luar jam kerja.',
            'Tinjau ulang paket langganan (internet/telepon) yang kapasitasnya tidak terpakai.'
        ]
    },
    {
        match: /\bit\b|komputer|printer|software|m&r|maintenance|perbaikan|servis|service/i,
        tips: [
            'Jadwalkan perawatan berkala (preventive maintenance) supaya tidak muncul biaya perbaikan darurat yang lebih mahal.',
            'Catat riwayat perbaikan per aset untuk memutuskan kapan lebih hemat mengganti daripada memperbaiki.'
        ]
    }
]

const DEFAULT_TIPS = [
    'Tetapkan anggaran bulanan per Unit Bisnis untuk kategori ini dan review pengajuan yang melebihi rata-rata.'
]

export function buildCategorySuggestions(row, detail = {}, { getUnitLabel = (unit) => unit } = {}) {
    const suggestions = []

    if (row.changePct != null && row.changePct >= 10) {
        suggestions.push(`Naik ${formatPct(row.changePct)} (${formatRupiah(row.changeAmount)}) dibanding periode yang sama tahun lalu -- jadikan prioritas untuk ditekan.`)
    } else if (row.changePct != null && row.changePct <= -5) {
        suggestions.push(`Sudah turun ${formatPct(row.changePct)} dibanding periode yang sama tahun lalu -- pertahankan pola pengendalian yang sekarang.`)
    } else if (row.changePct == null && row.current > 0) {
        suggestions.push('Biaya baru muncul tahun ini (tidak ada di periode yang sama tahun lalu) -- pastikan memang kebutuhan rutin yang dianggarkan.')
    }

    if (row.share >= 25) {
        suggestions.push(`Menyumbang ${formatPct(row.share)} dari total biaya -- penghematan di sini paling berdampak.`)
    }

    const topUnit = detail.topUnits?.[0]
    if (topUnit && topUnit.share >= 50 && (detail.topUnits?.length || 0) > 1) {
        suggestions.push(`${formatPct(topUnit.share)} berasal dari ${getUnitLabel(topUnit.name)} -- lakukan review pengajuan di unit ini lebih dulu.`)
    }

    if (row.category === BBM_INSIGHT_KEY) {
        const topPlat = detail.topPlats?.[0]
        if (topPlat) {
            suggestions.push(`Plat ${topPlat.name} menyerap ${formatPct(topPlat.share)} biaya BBM (${Math.round(topPlat.liter).toLocaleString('id-ID')} L) -- cek rute, jarak tempuh, dan kewajaran konsumsinya.`)
        }
        const nonSubsidi = (detail.topJenis || []).filter((jenis) => /pertamax|dex|turbo/i.test(jenis.name))
        const nonSubsidiShare = nonSubsidi.reduce((sum, jenis) => sum + jenis.share, 0)
        if (nonSubsidiShare >= 50) {
            suggestions.push(`${formatPct(nonSubsidiShare)} pembelian BBM jenis non-subsidi/premium -- evaluasi kendaraan mana yang bisa memakai jenis lebih hemat sesuai spesifikasi mesin.`)
        }
        suggestions.push('Terapkan kuota liter per kendaraan per bulan dan wajibkan foto odometer saat pengisian supaya konsumsi per km bisa dipantau.')
    } else {
        const matched = CATEGORY_TIPS.find((entry) => entry.match.test(row.category))
        suggestions.push(...(matched ? matched.tips : DEFAULT_TIPS))
    }

    if (row.saving > 0) {
        suggestions.push(`Target tahun depan: maksimal ${formatRupiah(row.target)} (hemat ${formatRupiah(row.saving)} dari proyeksi tahun ini).`)
    }

    return suggestions
}
