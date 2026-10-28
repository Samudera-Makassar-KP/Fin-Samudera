import React, { Fragment, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowTrendDown, faArrowTrendUp, faChevronDown, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { formatRupiah } from '../utils/rekapanAggregation'
import { BBM_INSIGHT_KEY, buildCategorySuggestions } from '../utils/rekapanInsights'

const TOP_ROWS = 10

const formatPct = (value) => `${Math.abs(value).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
const categoryLabel = (category) => (category === BBM_INSIGHT_KEY ? 'BBM (semua form)' : category)

// Biaya naik = merah (buruk), turun = hijau (baik).
const ChangeBadge = ({ pct }) => {
    if (pct == null) {
        return <span className="text-xs text-gray-500 dark:text-gray-400">baru</span>
    }
    const isUp = pct > 0
    const tone = isUp
        ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${tone}`}>
            <FontAwesomeIcon icon={isUp ? faArrowTrendUp : faArrowTrendDown} />
            {isUp ? '+' : '-'}{formatPct(pct)}
        </span>
    )
}

const Card = ({ eyebrow, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 flex flex-col">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{eyebrow}</p>
        {children}
    </div>
)

const Row = ({ label, value }) => (
    <div className="flex justify-between gap-3 py-0.5">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="tabular-nums text-gray-800 dark:text-gray-100 whitespace-nowrap">{value}</span>
    </div>
)

// Bagian BR: tiga kartu ringkasan biaya + tabel analisa per bagian (khusus
// Super Admin) di atas tabel Rekapan. Semua angka dari utils/rekapanInsights.js
// dan mengikuti filter Unit Bisnis, Bulan, dan Tampilkan Rekapan.
const RekapanCostInsights = ({
    period,
    isCategoryFiltered,
    outlook,
    details,
    getUnitLabel,
    targetPct,
    isSavingTarget,
    onSaveTarget
}) => {
    const [targetDraft, setTargetDraft] = useState(String(targetPct))
    const [openCategory, setOpenCategory] = useState(null)
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        setTargetDraft(String(targetPct))
    }, [targetPct])

    const draftNumber = Number(String(targetDraft).replace(',', '.'))
    const isDraftValid = targetDraft !== '' && Number.isFinite(draftNumber) && draftNumber >= 0 && draftNumber <= 100
    const isDraftChanged = isDraftValid && draftNumber !== Number(targetPct)

    const rows = outlook.categories
    const visibleRows = showAll ? rows : rows.slice(0, TOP_ROWS)
    const hiddenRows = showAll ? [] : rows.slice(TOP_ROWS)
    const hiddenSum = (key) => hiddenRows.reduce((sum, row) => sum + row[key], 0)
    const hasAnyData = outlook.previousYearTotal > 0 || outlook.currentTotal > 0

    return (
        <div className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ringkasan Biaya & Target</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    Periode {period.currentLabel} · Unit Bisnis sesuai filter · {isCategoryFiltered ? 'Hanya rekapan yang dipilih' : 'Semua rekapan'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card eyebrow={`1 · Biaya ${period.previousFullLabel}`}>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatRupiah(outlook.previousYearTotal)}
                    </p>
                    <div className="text-sm mt-3">
                        {period.previousFullLabel.startsWith('Tahun') && (
                            <Row label="Rata-rata per bulan" value={formatRupiah(outlook.previousYearMonthlyAverage)} />
                        )}
                        {outlook.topPreviousCategory && (
                            <Row label={`Terbesar: ${categoryLabel(outlook.topPreviousCategory.category)}`} value={formatRupiah(outlook.topPreviousCategory.amount)} />
                        )}
                    </div>
                </Card>

                <Card eyebrow={`2 · Biaya ${period.currentLabel}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                            {formatRupiah(outlook.currentTotal)}
                        </p>
                        <ChangeBadge pct={outlook.changePct} />
                    </div>
                    <div className="text-sm mt-3">
                        <Row label={`Pembanding (${period.previousLabel})`} value={formatRupiah(outlook.previousSamePeriodTotal)} />
                        <Row
                            label={outlook.changeAmount >= 0 ? 'Naik sebesar' : 'Turun sebesar'}
                            value={formatRupiah(Math.abs(outlook.changeAmount))}
                        />
                    </div>
                    {period.isProjected && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Dibandingkan dengan bulan yang sama tahun lalu, karena tahun ini belum 12 bulan.
                        </p>
                    )}
                </Card>

                <Card eyebrow={`3 · Target ${period.targetLabel}`}>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Turunkan</span>
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
                    {!isDraftValid && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Isi angka 0-100.</p>}
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-3">
                        {formatRupiah(outlook.targetNextYearTotal)}
                    </p>
                    <div className="text-sm mt-1">
                        <Row
                            label={period.isProjected ? 'Proyeksi biaya tahun ini' : `Biaya ${period.currentLabel}`}
                            value={formatRupiah(outlook.projectedCurrentYearTotal)}
                        />
                        <Row label="Harus dihemat" value={formatRupiah(outlook.targetSaving)} />
                    </div>
                    {period.isProjected && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Proyeksi = rata-rata bulanan {period.currentLabel} x 12.
                        </p>
                    )}
                </Card>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-4">
                <div className="px-5 pt-4 pb-3">
                    <p className="font-semibold text-gray-800 dark:text-gray-100">Analisa & Saran Penghematan per Bagian</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Diurutkan dari biaya terbesar. Klik satu baris untuk melihat rincian data dan saran penghematannya.
                    </p>
                </div>

                {!hasAnyData ? (
                    <p className="px-5 pb-5 text-sm text-gray-500 dark:text-gray-400">
                        Belum ada data Disetujui untuk periode & filter ini.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="border-y border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 text-xs text-gray-500 dark:text-gray-400">
                                    <th className="text-left font-semibold px-5 py-2">Bagian</th>
                                    <th className="text-right font-semibold px-3 py-2">{period.previousLabel}</th>
                                    <th className="text-right font-semibold px-3 py-2">{period.currentLabel}</th>
                                    <th className="text-center font-semibold px-3 py-2">Naik/Turun</th>
                                    <th className="text-right font-semibold px-3 py-2">Porsi</th>
                                    <th className="text-right font-semibold px-3 py-2">Target {period.targetLabel}</th>
                                    <th className="w-10" aria-label="Rincian" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {visibleRows.map((row) => {
                                    const isOpen = openCategory === row.category
                                    const detail = details[row.category] || {}
                                    return (
                                        <Fragment key={row.category}>
                                            <tr
                                                onClick={() => setOpenCategory(isOpen ? null : row.category)}
                                                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isOpen ? 'bg-gray-50 dark:bg-gray-700/40' : ''}`}
                                            >
                                                <td className="px-5 py-2.5 font-medium text-gray-800 dark:text-gray-100">{categoryLabel(row.category)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatRupiah(row.previousSamePeriod)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatRupiah(row.current)}</td>
                                                <td className="px-3 py-2.5 text-center"><ChangeBadge pct={row.changePct} /></td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatPct(row.share)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatRupiah(row.target)}</td>
                                                <td className="px-3 py-2.5 text-gray-400">
                                                    <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr className="bg-gray-50 dark:bg-gray-700/40">
                                                    <td colSpan={7} className="px-5 pb-4 pt-1">
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Data</p>
                                                                    <Row label={`Total ${period.previousFullLabel}`} value={formatRupiah(row.previousYear)} />
                                                                    <Row label={`Pembanding (${period.previousLabel})`} value={formatRupiah(row.previousSamePeriod)} />
                                                                    <Row label={period.currentLabel} value={formatRupiah(row.current)} />
                                                                    {period.isProjected && <Row label="Proyeksi setahun" value={formatRupiah(row.projected)} />}
                                                                </div>
                                                                {detail.topUnits?.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Unit penyumbang terbesar</p>
                                                                        {detail.topUnits.map((unit) => (
                                                                            <Row key={unit.name} label={getUnitLabel(unit.name)} value={`${formatRupiah(unit.amount)} (${formatPct(unit.share)})`} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {detail.topPlats?.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Plat dengan biaya BBM terbesar</p>
                                                                        {detail.topPlats.map((plat) => (
                                                                            <Row key={plat.name} label={plat.name} value={`${formatRupiah(plat.amount)} · ${Math.round(plat.liter).toLocaleString('id-ID')} L`} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {detail.topJenis?.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Porsi jenis BBM</p>
                                                                        {detail.topJenis.map((jenis) => (
                                                                            <Row key={jenis.name} label={jenis.name} value={formatPct(jenis.share)} />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Saran penghematan</p>
                                                                <ul className="list-disc pl-5 space-y-1.5 text-gray-700 dark:text-gray-200">
                                                                    {buildCategorySuggestions(row, detail, { getUnitLabel }).map((tip) => (
                                                                        <li key={tip}>{tip}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                                {hiddenRows.length > 0 && (
                                    <tr className="text-gray-500 dark:text-gray-400">
                                        <td className="px-5 py-2.5">
                                            Bagian lainnya ({hiddenRows.length.toLocaleString('id-ID')})
                                            <button
                                                type="button"
                                                onClick={() => setShowAll(true)}
                                                className="ml-2 text-xs text-red-600 dark:text-red-400 hover:underline"
                                            >
                                                tampilkan semua
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(hiddenSum('previousSamePeriod'))}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(hiddenSum('current'))}</td>
                                        <td />
                                        <td className="px-3 py-2.5 text-right tabular-nums">{formatPct(hiddenSum('share'))}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(hiddenSum('target'))}</td>
                                        <td />
                                    </tr>
                                )}
                                {showAll && rows.length > TOP_ROWS && (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setShowAll(false)}
                                                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                            >
                                                Ringkas kembali ke {TOP_ROWS} bagian terbesar
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 dark:border-gray-600 font-semibold text-gray-900 dark:text-gray-100">
                                    <td className="px-5 py-2.5">Total</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(outlook.previousSamePeriodTotal)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(outlook.currentTotal)}</td>
                                    <td className="px-3 py-2.5 text-center"><ChangeBadge pct={outlook.changePct} /></td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{outlook.currentTotal > 0 ? '100%' : '-'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(outlook.targetNextYearTotal)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default RekapanCostInsights
