import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebaseConfig'
import Select from 'react-select'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import EmptyState from '../assets/images/EmptyState.png'
import { useTheme } from '../context/ThemeContext'
import { getStatusBadgeClass } from '../utils/statusBadge'

// Bagian BI: menu "Maker" -- khusus role Validator (Admin/Super Admin ikut
// bisa melihat untuk keperluan pengawasan, mengikuti pola akses "Rekapan").
// Menampilkan BS & Reimbursement yang sudah berstatus "Disetujui" dan
// menunggu diproses pencairannya ("di-maker"), sesuai unit bisnis yang
// ditugaskan ke Validator yang login. LPJ sengaja TIDAK disertakan (lihat
// keputusan Bagian BI: cakupan Maker hanya BS & RBS).
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

const STATUS_FILTER_OPTIONS = [
    { value: 'ALL', label: 'Semua Status' },
    { value: 'Menunggu Maker', label: 'Menunggu Maker' },
    { value: 'Sudah Dimaker', label: 'Sudah Dimaker' }
]

const Maker = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [isRoleLoaded, setIsRoleLoaded] = useState(false)
    const [role, setRole] = useState(null)
    const [ownUnits, setOwnUnits] = useState([])

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState([])
    const [unitFilter, setUnitFilter] = useState(null)
    const [statusFilter, setStatusFilter] = useState(STATUS_FILTER_OPTIONS[0])
    const [processingId, setProcessingId] = useState(null)

    // 1. Ambil role & unit user login (pola sama seperti RekapanUnitBisnis.jsx)
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
                    const d = userDoc.data()
                    setRole(d.role || null)
                    setOwnUnits(Array.isArray(d.unit) ? d.unit : (d.unit ? [d.unit] : []))
                }
            } catch (error) {
                console.error('Gagal mengambil data role user:', error)
            } finally {
                setIsRoleLoaded(true)
            }
        }
        fetchUserRole()
    }, [])

    const isAdmin = role === 'Admin' || role === 'Super Admin'

    // 2. Ambil semua BS & Reimbursement berstatus "Disetujui" sekali saja,
    // filter unit bisnis dilakukan di client (pola sama seperti RekapanUnitBisnis.jsx/
    // ReportExport.jsx).
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [bsSnap, rbsSnap] = await Promise.all([
                getDocs(query(collection(db, 'bonSementara'), where('status', '==', 'Disetujui'))),
                getDocs(query(collection(db, 'reimbursement'), where('status', '==', 'Disetujui')))
            ])
            const bsDocs = bsSnap.docs.map((d) => ({ id: d.id, jenis: 'BS', docType: 'bonSementara', ...d.data() }))
            const rbsDocs = rbsSnap.docs.map((d) => ({ id: d.id, jenis: 'RBS', docType: 'reimbursement', ...d.data() }))
            setData([...bsDocs, ...rbsDocs])
        } catch (error) {
            console.error('Gagal mengambil data Maker:', error)
            toast.error('Gagal mengambil data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!isRoleLoaded) return
        fetchData()
    }, [isRoleLoaded, fetchData])

    const unitOptions = isAdmin ? BUSINESS_UNITS : ownUnits.map((u) => ({ value: u, label: u }))

    const visibleData = data
        .filter((item) => {
            const itemUnit = item.user?.unit
            if (!isAdmin && !ownUnits.includes(itemUnit)) return false
            if (unitFilter && itemUnit !== unitFilter.value) return false
            const makerStatus = item.makerStatus || 'Menunggu Maker'
            if (statusFilter?.value !== 'ALL' && makerStatus !== statusFilter.value) return false
            return true
        })
        .sort((a, b) => {
            const aPending = (a.makerStatus || 'Menunggu Maker') === 'Menunggu Maker'
            const bPending = (b.makerStatus || 'Menunggu Maker') === 'Menunggu Maker'
            if (aPending !== bPending) return aPending ? -1 : 1
            return new Date(b.tanggalPengajuan || 0) - new Date(a.tanggalPengajuan || 0)
        })

    const handleMarkAsMaker = async (item) => {
        setProcessingId(item.id)
        try {
            const markAsMaker = httpsCallable(functions, 'markAsMaker')
            await markAsMaker({ docType: item.docType, docId: item.id })
            toast.success(`${item.jenis} ${item.displayId} ditandai selesai di-maker`)
            await fetchData()
        } catch (error) {
            console.error('Gagal menandai Maker:', error)
            toast.error(error?.message || 'Gagal menandai selesai di-maker')
        } finally {
            setProcessingId(null)
        }
    }

    const getNominal = (item) => (item.jenis === 'BS' ? item.bonSementara?.[0]?.jumlahBS || 0 : item.totalBiaya || 0)

    const formatDate = (value) =>
        value
            ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '-'

    const selectStyles = {
        control: (base) => ({
            ...base,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            fontSize: '12px',
            height: '32px',
            padding: '0 4px',
            lineHeight: 'normal',
            '&:hover': { borderColor: '#3b82f6' },
            borderRadius: '8px'
        }),
        singleValue: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        input: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        placeholder: (base) => ({ ...base, color: isDark ? '#9ca3af' : '#6b7280' }),
        menu: (base) => ({ ...base, zIndex: 100, backgroundColor: isDark ? '#1f2937' : '#ffffff' }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        option: (base, state) => ({
            ...base,
            fontSize: '12px',
            padding: '6px 12px',
            cursor: 'pointer',
            backgroundColor: isDark
                ? (state.isSelected ? '#374151' : state.isFocused ? '#2d3748' : '#1f2937')
                : base.backgroundColor,
            color: isDark ? '#f3f4f6' : base.color
        })
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-bold dark:text-gray-100 mb-2">Maker</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                BS & Reimbursement yang sudah Disetujui dan menunggu diproses pencairannya.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
                <div className="w-56">
                    <Select
                        options={unitOptions}
                        value={unitFilter}
                        onChange={setUnitFilter}
                        placeholder="Semua Unit Bisnis"
                        styles={selectStyles}
                        isClearable
                        menuPortalTarget={document.body}
                        menuPosition="absolute"
                    />
                </div>
                <div className="w-48">
                    <Select
                        options={STATUS_FILTER_OPTIONS}
                        value={statusFilter}
                        onChange={setStatusFilter}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="absolute"
                    />
                </div>
            </div>

            {loading ? (
                <Skeleton count={5} height={40} className="mb-2" />
            ) : visibleData.length === 0 ? (
                <div className="flex flex-col items-center py-10">
                    <img src={EmptyState} alt="Tidak ada data" className="w-40 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Tidak ada dokumen yang perlu di-maker.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full border dark:border-gray-600 text-sm">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                                <th className="px-4 py-2 border dark:border-gray-600">No.</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Jenis</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Nomor</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Unit Bisnis</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Pengaju</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Nominal</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Tanggal Pengajuan</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Status Maker</th>
                                <th className="px-4 py-2 border dark:border-gray-600">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleData.map((item, index) => {
                                const makerStatus = item.makerStatus || 'Menunggu Maker'
                                const detailPath = item.jenis === 'BS' ? `/bon-sementara/${item.id}` : `/reimbursement/${item.id}`
                                return (
                                    <tr key={item.id} className="dark:text-gray-100">
                                        <td className="px-4 py-2 border dark:border-gray-600 text-center">{index + 1}</td>
                                        <td className="px-4 py-2 border dark:border-gray-600 text-center">{item.jenis}</td>
                                        <td className="px-4 py-2 border dark:border-gray-600">
                                            <Link to={detailPath} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                {item.displayId}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-2 border dark:border-gray-600">{item.user?.unit || '-'}</td>
                                        <td className="px-4 py-2 border dark:border-gray-600">{item.user?.nama || '-'}</td>
                                        <td className="px-4 py-2 border dark:border-gray-600 text-right">
                                            {getNominal(item).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-4 py-2 border dark:border-gray-600 text-center">
                                            {formatDate(item.tanggalPengajuan)}
                                        </td>
                                        <td className="px-4 py-2 border dark:border-gray-600 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(makerStatus)}`}>
                                                {makerStatus}
                                            </span>
                                            {makerStatus === 'Sudah Dimaker' && item.makerByName && (
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    oleh {item.makerByName}{item.makerAt ? ` • ${formatDate(item.makerAt)}` : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 border dark:border-gray-600 text-center">
                                            {makerStatus === 'Menunggu Maker' ? (
                                                <button
                                                    onClick={() => handleMarkAsMaker(item)}
                                                    disabled={processingId === item.id}
                                                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    {processingId === item.id ? 'Memproses...' : 'Tandai Sudah Dimaker'}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default Maker
