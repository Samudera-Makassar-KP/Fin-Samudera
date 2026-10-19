import React, { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowTrendDown, faArrowTrendUp, faChevronDown, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { formatRupiah, MONTH_LABELS } from '../utils/rekapanAggregation'
import { BBM_INSIGHT_KEY, buildCategorySuggestions } from '../utils/rekapanInsights'

const formatPct = (value) => `${Math.abs(value).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`

// Biaya naik = merah (buruk), turun = hijau (baik).
const ChangeBadge = ({ pct, className = '' }) => {
    if (pct == null) {
        return <span className={`text-xs text-gray-500 dark:text-gray-400 ${className}`}>tidak ada pembanding</span>
    }
    const isUp = pct > 0
    const tone = isUp
        ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tone} ${className}`}>
            <FontAwesomeIcon icon={isUp ? faArrowTrendUp : faArrowTrendDown} />
            {isUp ? 'Naik' : 'Turun'} {formatPct(pct)}
        </span>
    )
}

const Card = ({ eyebrow, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex flex-col">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{eyebrow}</p>
        {children}
    </div>
)

// Bagian BR: tiga kartu ringkasan biaya + analisa per bagian (khusus Super
// Admin) di atas tabel Rekapan. Semua angka dihitung di utils/rekapanInsights.js.
const RekapanCostInsights = ({
    year,
    monthsElapsed,
    outlook,
    details,
    getUnitLabel,
    targetPct,
    isSavingTarget,
    onSaveTarget
}) => {
    const [targetDraft, setTargetDraft] = useState(String(targetPct))
    const [openCategory, setOpenCategory] = useState(null)

    useEffect(() => {
        setTargetDraft(String(targetPct))
    }, [targetPct])

    const isPartialYear = monthsElapsed < 12
    const periodLabel = isPartialYear
        ? `Jan-${MONTH_LABELS[monthsElapsed - 1]} ${year}`
        : `Tahun ${year}`
    const previousPeriodLabel = isPartialYear
        ? `Jan-${MONTH_LABELS[monthsElapsed - 1]} ${year - 1}`
        : `Tahun ${year - 1}`

    const draftNumber = Number(String(targetDraft).replace(',', '.'))
    const isDraftValid = Number.isFinite(draftNumber) && draftNumber >= 0 && draftNumber <= 100
    const isDraftChanged = isDraftValid && draftNumber !== Number(targetPct)

    const hasAnyData = outlook.previousYearTotal > 0 || outlook.currentTotal > 0

    return (
        <div className="mb-6">
            <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ringkasan Biaya & Target</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Khusus Super Admin -- mengikuti filter Unit Bisnis</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card eyebrow={`Biaya Tahun ${year - 1}`}>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatRupiah(outlook.previousYearTotal)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Rata-rata {formatRupiah(outlook.previousYearMonthlyAverage)} / bulan
                    </p>
                    {outlook.topPreviousCategory && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                            Terbesar: <span className="font-medium">{outlook.topPreviousCategory.category}</span>{' '}
                            ({formatRupiah(outlook.topPreviousCategory.amount)})
                        </p>
                    )}
                </Card>

                <Card eyebrow={`Biaya ${periodLabel}`}>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatRupiah(outlook.currentTotal)}
                    </p>
                    <div className="mt-2">
                        <ChangeBadge pct={outlook.changePct} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                        {outlook.changeAmount >= 0 ? '+' : '-'}{formatRupiah(Math.abs(outlook.changeAmount))} dibanding{' '}
                        {previousPeriodLabel} ({formatRupiah(outlook.previousSamePeriodTotal)})
                    </p>
                    {isPartialYear && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Dibandingkan dengan bulan yang sama supaya adil -- tahun berjalan belum 12 bulan.
                        </p>
                    )}
                </Card>

                <Card eyebrow={`Target Tahun ${year + 1}`}>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Turunkan biaya</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={targetDraft}
                            onChange={(e) => setTargetDraft(e.target.value.replace(/[^\d.,]/g, ''))}
                            className="w-16 h-8 px-2 text-right border rounded-md text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            aria-label="Target penurunan biaya (persen)"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">%</span>
                        {isDraftChanged && (
                            <button
                                type="button"
                                onClick={() => onSaveTarget(draftNumber)}
                                disabled={isSavingTarget}
                                className="ml-auto px-3 h-8 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                {isSavingTarget ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : 'Simpan'}
                            </button>
                        )}
                    </div>
                    {!isDraftValid && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Isi angka 0-100.</p>
                    )}
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-3">
                        {formatRupiah(outlook.targetNextYearTotal)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        Hemat {formatRupiah(outlook.targetSaving)} dari proyeksi {year}{' '}
                        ({formatRupiah(outlook.projectedCurrentYearTotal)})
                    </p>
                    {isPartialYear && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Proyeksi {year} = rata-rata bulanan {periodLabel} x 12.
                        </p>
                    )}
                </Card>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-4">
                <div className="px-5 pt-4 pb-2">
                    <p className="font-semibold text-gray-800 dark:text-gray-100">Analisa & Saran Penghematan per Bagian</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Diurutkan dari biaya terbesar {periodLabel}. Klik baris untuk melihat data & saran.
                    </p>
                </div>

                {!hasAnyData ? (
                    <p className="px-5 pb-5 text-sm text-gray-500 dark:text-gray-400">
                        Belum ada data Disetujui untuk {year - 1} maupun {year} di Unit Bisnis yang dipilih.
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {outlook.categories.map((row) => {
                            const isOpen = openCategory === row.category
                            const detail = details[row.category] || {}
                            return (
                                <li key={row.category}>
                                    <button
                                        type="button"
                                        onClick={() => setOpenCategory(isOpen ? null : row.category)}
                                        className="w-full px-5 py-3 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_auto] gap-x-4 gap-y-1 items-center text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                        aria-expanded={isOpen}
                                    >
                                        <span className="font-medium text-gray-800 dark:text-gray-100 truncate">
                                            {row.category === BBM_INSIGHT_KEY ? 'BBM (semua form)' : row.category}
                                        </span>
                                        <FontAwesomeIcon
                                            icon={faChevronDown}
                                            className={`md:order-last text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                        <span className="text-sm tabular-nums text-gray-700 dark:text-gray-200">
                                            {formatRupiah(row.current)}
                                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                                                {formatPct(row.share)} dari total
                                            </span>
                                        </span>
                                        <span><ChangeBadge pct={row.changePct} /></span>
                                        <span className="text-sm tabular-nums text-gray-700 dark:text-gray-200">
                                            <span className="block text-xs text-gray-500 dark:text-gray-400">Target {year + 1}</span>
                                            {formatRupiah(row.target)}
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="px-5 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div className="text-sm text-gray-700 dark:text-gray-200 space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{previousPeriodLabel}</p>
                                                        <p className="tabular-nums">{formatRupiah(row.previousSamePeriod)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total tahun {year - 1}</p>
                                                        <p className="tabular-nums">{formatRupiah(row.previousYear)}</p>
                                                    </div>
                                                </div>
                                                {detail.topUnits?.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Unit penyumbang terbesar</p>
                                                        {detail.topUnits.map((unit) => (
                                                            <p key={unit.name} className="flex justify-between gap-2">
                                                                <span className="truncate">{getUnitLabel(unit.name)}</span>
                                                                <span className="tabular-nums whitespace-nowrap">{formatRupiah(unit.amount)} ({formatPct(unit.share)})</span>
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {detail.topPlats?.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Plat dengan biaya BBM terbesar</p>
                                                        {detail.topPlats.map((plat) => (
                                                            <p key={plat.name} className="flex justify-between gap-2">
                                                                <span className="truncate">{plat.name}</span>
                                                                <span className="tabular-nums whitespace-nowrap">
                                                                    {formatRupiah(plat.amount)} · {Math.round(plat.liter).toLocaleString('id-ID')} L
                                                                </span>
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {detail.topJenis?.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Jenis BBM</p>
                                                        {detail.topJenis.map((jenis) => (
                                                            <p key={jenis.name} className="flex justify-between gap-2">
                                                                <span className="truncate">{jenis.name}</span>
                                                                <span className="tabular-nums whitespace-nowrap">{formatPct(jenis.share)}</span>
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Saran</p>
                                                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                                                    {buildCategorySuggestions(row, detail, { getUnitLabel }).map((tip) => (
                                                        <li key={tip}>{tip}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}

export default RekapanCostInsights
