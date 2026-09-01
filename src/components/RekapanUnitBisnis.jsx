import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import Select from 'react-select'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { db } from '../firebaseConfig'
import { useTheme } from '../context/ThemeContext'
import {
    MONTH_LABELS,
    sumMonths,
    aggregateByCategory,
    aggregateBbm
} from '../utils/rekapanAggregation'

// Sama seperti BUSINESS_UNITS di FormBs.jsx -- daftar semua Unit Bisnis untuk opsi
// dropdown Admin/Super Admin ("Semua Unit Bisnis" melihat seluruhnya sekaligus).
const BUSINESS_UNITS = [
    { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
    { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
    { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
    { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
    { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
    { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
    { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
    { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' },
    { value: 'Samudera Indonesia', label: 'Samudera Indonesia' },
    { value: 'Panitia', label: 'Panitia' }
]

const ALL_UNITS_VALUE = '__ALL__'

// Urutan tampil kategori yang diketahui (sesuai jenisOptions form RBS Umum/Operasional
// & LPJ Umum/Marketing yang sudah diseragamkan). Kategori tak dikenal (data lampau)
// tetap ditampilkan, disisipkan di akhir. Item berjenis BBM ("BBM ...") tidak pernah
// muncul di sini -- ditangani terpisah lewat tabel "BBM -- Total Biaya"/"BBM -- Liter
// per Plat Nomor" (lihat aggregateBbm).
const CATEGORY_ORDER = [
    'ATK', 'RTG', 'RTK',
    'Meals Meeting', 'Meeting',
    'Entertaint',
    'Meals Lembur', 'Meal Lembur',
    'Parkir', 'E-Toll', 'Toll',
    'Biaya Buruh', 'Meal Buruh',
    'Lainnya'
]

// Key sentinel untuk 2 tabel BBM (bukan kategori dinamis dari data) supaya bisa
// ikut difilter lewat dropdown "Tampilkan Rekapan" yang sama.
const BBM_TOTAL_KEY = '__BBM_TOTAL__'
const BBM_LITER_KEY = '__BBM_LITER__'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => ({ value: y, label: String(y) }))

const RekapanUnitBisnis = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [isRoleLoaded, setIsRoleLoaded] = useState(false)
    const [role, setRole] = useState(null)
    const [ownUnits, setOwnUnits] = useState([])

    const [unitOptions, setUnitOptions] = useState([])
    const [selectedUnit, setSelectedUnit] = useState(null)
    const [selectedYear, setSelectedYear] = useState(YEAR_OPTIONS[0])

    const [isDataLoading, setIsDataLoading] = useState(true)
    const [reimbursementDocs, setReimbursementDocs] = useState([])
    const [lpjDocs, setLpjDocs] = useState([])

    // 1. Ambil role & unit user login (pola sama seperti FormBs.jsx)
    useEffect(() => {
        const fetchUserRole = async () => {
            const uid = localStorage.getItem('userUid')
            if (!uid) {
                setIsRoleLoaded(true)
                return
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', uid))
                if (userDoc.exists()) {
                    const data = userDoc.data()
                    setRole(data.role || null)
                    setOwnUnits(Array.isArray(data.unit) ? data.unit : (data.unit ? [data.unit] : []))
                }
            } catch (error) {
                console.error('Gagal mengambil data role user:', error)
            } finally {
                setIsRoleLoaded(true)
            }
        }

        fetchUserRole()
    }, [])

    // 2. Susun opsi dropdown Unit Bisnis sesuai role
    useEffect(() => {
        if (!isRoleLoaded) return

        const isAdmin = role === 'Admin' || role === 'Super Admin'
        const options = isAdmin
            ? [{ value: ALL_UNITS_VALUE, label: 'Semua Unit Bisnis' }, ...BUSINESS_UNITS]
            : ownUnits.map((u) => ({ value: u, label: u }))

        setUnitOptions(options)
        setSelectedUnit(options[0] || null)
    }, [isRoleLoaded, role, ownUnits])

    // 3. Fetch data reimbursement & lpj yang sudah Disetujui (sekali saja, filter
    // unit/tahun dilakukan di client -- pola sama seperti ReportExport.jsx)
    useEffect(() => {
        const fetchData = async () => {
            setIsDataLoading(true)
            try {
                const [reimbursementSnap, lpjSnap] = await Promise.all([
                    getDocs(query(collection(db, 'reimbursement'), where('status', '==', 'Disetujui'))),
                    getDocs(query(collection(db, 'lpj'), where('status', '==', 'Disetujui')))
                ])

                setReimbursementDocs(reimbursementSnap.docs.map((d) => d.data()))
                setLpjDocs(lpjSnap.docs.map((d) => d.data()))
            } catch (error) {
                console.error('Gagal mengambil data rekapan:', error)
            } finally {
                setIsDataLoading(false)
            }
        }

        fetchData()
    }, [])

    const unitsFilter = useMemo(() => {
        if (!selectedUnit) return []
        if (selectedUnit.value === ALL_UNITS_VALUE) return []
        return [selectedUnit.value]
    }, [selectedUnit])

    const displayUnits = useMemo(() => {
        if (!selectedUnit) return []
        if (selectedUnit.value === ALL_UNITS_VALUE) return BUSINESS_UNITS.map((u) => u.value)
        return [selectedUnit.value]
    }, [selectedUnit])

    const categoryData = useMemo(() => {
        return aggregateByCategory(reimbursementDocs, lpjDocs, { year: selectedYear.value, units: unitsFilter })
    }, [reimbursementDocs, lpjDocs, selectedYear, unitsFilter])

    const bbmData = useMemo(() => {
        return aggregateBbm(reimbursementDocs, lpjDocs, { year: selectedYear.value, units: unitsFilter })
    }, [reimbursementDocs, lpjDocs, selectedYear, unitsFilter])

    const orderedCategories = useMemo(() => {
        const found = Object.keys(categoryData)
        const known = CATEGORY_ORDER.filter((c) => found.includes(c))
        const unknown = found.filter((c) => !CATEGORY_ORDER.includes(c)).sort()
        return [...known, ...unknown]
    }, [categoryData])

    // Filter "Tampilkan Rekapan" -- pilih tabel/kategori mana saja yang mau ditampilkan.
    // Kosong (default) berarti tampilkan semua, sama seperti perilaku sebelum ada filter ini.
    const [tableFilter, setTableFilter] = useState([])
    const [isTableFilterOpen, setIsTableFilterOpen] = useState(false)

    const tableFilterOptions = useMemo(() => [
        { value: BBM_TOTAL_KEY, label: 'BBM -- Total Biaya' },
        { value: BBM_LITER_KEY, label: 'BBM -- Liter per Plat Nomor' },
        ...orderedCategories.map((c) => ({ value: c, label: c }))
    ], [orderedCategories])

    const isTableVisible = useCallback((key) => {
        return tableFilter.length === 0 || tableFilter.some((opt) => opt.value === key)
    }, [tableFilter])

    const isTableFilterChecked = useCallback((value) => {
        return tableFilter.some((opt) => opt.value === value)
    }, [tableFilter])

    const toggleTableFilterOption = useCallback((option) => {
        setTableFilter((prev) => {
            const exists = prev.some((opt) => opt.value === option.value)
            return exists ? prev.filter((opt) => opt.value !== option.value) : [...prev, option]
        })
    }, [])

    const tableFilterLabel = tableFilter.length === 0
        ? 'Semua rekapan ditampilkan'
        : `${tableFilter.length} rekapan dipilih`

    const getUnitLabel = useCallback((unitValue) => {
        return BUSINESS_UNITS.find((u) => u.value === unitValue)?.label || unitValue
    }, [])

    const customStyles = {
        control: (base) => ({
            ...base,
            minHeight: '40px',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            backgroundColor: isDark ? '#1f2937' : 'white'
        }),
        singleValue: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        input: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        menu: (base) => ({ ...base, zIndex: 100, backgroundColor: isDark ? '#1f2937' : '#ffffff' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: isDark
                ? (state.isSelected ? '#374151' : state.isFocused ? '#2d3748' : '#1f2937')
                : base.backgroundColor,
            color: isDark ? '#f3f4f6' : base.color,
            cursor: 'pointer'
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: isDark ? '#374151' : '#e5e7eb'
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: isDark ? '#f3f4f6' : '#111827'
        })
    }

    const renderCategoryTable = (title, rowsData) => {
        // rowsData: { [unit]: number[12] }
        return (
            <div key={title} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr style={{ backgroundColor: '#ED1C24' }}>
                                <th colSpan={14} className="py-2 px-4 text-white text-left font-semibold">
                                    {title}
                                </th>
                            </tr>
                            <tr style={{ backgroundColor: '#ED1C24' }}>
                                <th className="py-2 px-4 text-white text-left font-medium min-w-[220px]">Unit Bisnis</th>
                                {MONTH_LABELS.map((m) => (
                                    <th key={m} className="py-2 px-2 text-white text-center font-medium">{m}</th>
                                ))}
                                <th className="py-2 px-3 text-white text-center font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayUnits.map((unit, idx) => {
                                const months = rowsData[unit] || Array(12).fill(0)
                                return (
                                    <tr key={unit} className={idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/40' : 'bg-white dark:bg-gray-800'}>
                                        <td className="py-2 px-4 text-gray-800 dark:text-gray-100 whitespace-nowrap">{getUnitLabel(unit)}</td>
                                        {months.map((val, i) => (
                                            <td key={i} className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">
                                                {val ? val.toLocaleString('id-ID') : '-'}
                                            </td>
                                        ))}
                                        <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-50">
                                            {sumMonths(months).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    const renderBbmLiterTable = () => {
        const plats = Object.keys(bbmData.byPlat).sort()
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr style={{ backgroundColor: '#ED1C24' }}>
                                <th colSpan={14} className="py-2 px-4 text-white text-left font-semibold">
                                    BBM -- Liter per Plat Nomor
                                </th>
                            </tr>
                            <tr style={{ backgroundColor: '#ED1C24' }}>
                                <th className="py-2 px-4 text-white text-left font-medium min-w-[160px]">Plat Nomor</th>
                                {MONTH_LABELS.map((m) => (
                                    <th key={m} className="py-2 px-2 text-white text-center font-medium">{m}</th>
                                ))}
                                <th className="py-2 px-3 text-white text-center font-medium">Total (L)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plats.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="py-4 px-4 text-center text-gray-500 dark:text-gray-400">
                                        Tidak ada data BBM untuk filter ini.
                                    </td>
                                </tr>
                            )}
                            {plats.map((plat, idx) => (
                                <tr key={plat} className={idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/40' : 'bg-white dark:bg-gray-800'}>
                                    <td className="py-2 px-4 text-gray-800 dark:text-gray-100 whitespace-nowrap">{plat}</td>
                                    {bbmData.byPlat[plat].liter.map((val, i) => (
                                        <td key={i} className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">
                                            {val ? val.toLocaleString('id-ID') : '-'}
                                        </td>
                                    ))}
                                    <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-50">
                                        {sumMonths(bbmData.byPlat[plat].liter).toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    if (!isRoleLoaded) {
        return (
            <div className="container mx-auto py-10 md:py-8">
                <Skeleton height={40} className="mb-4" />
                <Skeleton height={300} />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-6 dark:text-gray-100">Rekapan Unit Bisnis</h2>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6 transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Unit Bisnis</label>
                        <Select
                            options={unitOptions}
                            value={selectedUnit}
                            onChange={setSelectedUnit}
                            placeholder="Pilih Unit Bisnis"
                            styles={customStyles}
                            isSearchable={false}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Tahun</label>
                        <Select
                            options={YEAR_OPTIONS}
                            value={selectedYear}
                            onChange={setSelectedYear}
                            styles={customStyles}
                            isSearchable={false}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Tampilkan Rekapan</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsTableFilterOpen((prev) => !prev)}
                                className="w-full h-10 px-3 flex items-center justify-between border rounded-md text-sm text-left bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                            >
                                <span className="truncate">{tableFilterLabel}</span>
                                <svg
                                    className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${isTableFilterOpen ? 'rotate-180' : ''}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isTableFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsTableFilterOpen(false)} />
                                    <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1">
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                            <button
                                                type="button"
                                                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                                onClick={() => setTableFilter(tableFilterOptions)}
                                            >
                                                Pilih Semua
                                            </button>
                                            <button
                                                type="button"
                                                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                                                onClick={() => setTableFilter([])}
                                            >
                                                Kosongkan
                                            </button>
                                        </div>
                                        {tableFilterOptions.map((opt) => (
                                            <label
                                                key={opt.value}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isTableFilterChecked(opt.value)}
                                                    onChange={() => toggleTableFilterOption(opt)}
                                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                />
                                                <span>{opt.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isDataLoading ? (
                <div className="space-y-4">
                    <Skeleton height={220} />
                    <Skeleton height={220} />
                </div>
            ) : !selectedUnit ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-500 dark:text-gray-400">
                    Belum ada Unit Bisnis yang ditugaskan ke akun Anda.
                </div>
            ) : (
                <>
                    {isTableVisible(BBM_TOTAL_KEY) && renderCategoryTable('BBM -- Total Biaya', bbmData.totals)}
                    {isTableVisible(BBM_LITER_KEY) && renderBbmLiterTable()}
                    {orderedCategories
                        .filter((category) => isTableVisible(category))
                        .map((category) => renderCategoryTable(category, categoryData[category]))}

                    {tableFilter.length > 0 &&
                        !isTableVisible(BBM_TOTAL_KEY) &&
                        !isTableVisible(BBM_LITER_KEY) &&
                        orderedCategories.filter((category) => isTableVisible(category)).length === 0 && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-500 dark:text-gray-400">
                            Tidak ada rekapan yang cocok dengan filter "Tampilkan Rekapan" yang dipilih.
                        </div>
                    )}

                    {orderedCategories.length === 0 && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-500 dark:text-gray-400">
                            Belum ada data pengajuan Disetujui untuk filter ini.
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default RekapanUnitBisnis
