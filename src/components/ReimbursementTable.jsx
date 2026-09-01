import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import EmptyState from '../assets/images/EmptyState.png'
import Select from 'react-select'
import Modal from '../components/Modal'
import { toast } from 'react-toastify'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useTheme } from '../context/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { generateReimbursementPDF } from '../utils/ReimbursementPdf'

const ReimbursementTable = () => {
    const { theme } = useTheme()
    const [data, setData] = useState({ reimbursements: [] })
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)

    // Get current date
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1 // JavaScript months are 0-indexed

    const [yearOptions, setYearOptions] = useState([{ value: currentYear, label: `${currentYear}` }])

    // Set default filters with current month and year
    const [filters, setFilters] = useState({
        status: '',
        kategori: '',
        bulan: { value: currentMonth, label: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(today) },
        tahun: { value: currentYear, label: `${currentYear}` }
    })
    const itemsPerPage = 5

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedReport, setSelectedReport] = useState(null)
    const [cancelReason, setCancelReason] = useState('')

    const [actionMenu, setActionMenu] = useState(null) // { id, item, top, left }
    const [printLoadingId, setPrintLoadingId] = useState(null)

    const filterOptions = {
        status: [
            { value: 'Diajukan', label: 'Diajukan' },
            { value: 'Divalidasi', label: 'Divalidasi' },
            { value: 'Diproses', label: 'Diproses' },
            { value: 'Disetujui', label: 'Disetujui' },
            { value: 'Ditolak', label: 'Ditolak' },
            { value: 'Dibatalkan', label: 'Dibatalkan' }
        ],
        kategori: [
            { value: 'BBM', label: 'BBM' },
            { value: 'Operasional', label: 'Operasional' },
            { value: 'GA/Umum', label: 'GA/Umum' }
        ],
        bulan: [
            { value: 1, label: 'Januari' },
            { value: 2, label: 'Februari' },
            { value: 3, label: 'Maret' },
            { value: 4, label: 'April' },
            { value: 5, label: 'Mei' },
            { value: 6, label: 'Juni' },
            { value: 7, label: 'Juli' },
            { value: 8, label: 'Agustus' },
            { value: 9, label: 'September' },
            { value: 10, label: 'Oktober' },
            { value: 11, label: 'November' },
            { value: 12, label: 'Desember' }
        ]
    }

    useEffect(() => {
        const fetchUserAndReimbursements = async () => {
            setLoading(true) // Set loading to true before fetching data
            try {
                const uid = localStorage.getItem('userUid')
                if (!uid) {
                    console.error('UID tidak ditemukan di localStorage')
                    setLoading(false)
                    return
                }

                // Query reimbursement berdasarkan UID user
                const q = query(collection(db, 'reimbursement'), where('user.uid', '==', uid))

                const querySnapshot = await getDocs(q)
                const reimbursements = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    displayId: doc.data().displayId,
                    ...doc.data()
                }))

                // Dynamically update year options based on existing reimbursements
                const existingYears = new Set(
                    reimbursements.map((item) => new Date(item.tanggalPengajuan).getFullYear())
                )

                const updatedYearOptions = Array.from(existingYears)
                    .map((year) => ({ value: year, label: `${year}` }))
                    .sort((a, b) => b.value - a.value) // Urutkan tahun dari yang terbaru

                setYearOptions(updatedYearOptions)
                setData({ reimbursements })
            } catch (error) {
                console.error('Error fetching user or reimbursements data:', error)
            } finally {
                setLoading(false) // Set loading to false after fetching data
            }
        }

        fetchUserAndReimbursements()
    }, [])

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A'
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date)
    }

    const handleFilterChange = (field, selectedOption) => {
        setFilters((prev) => ({
            ...prev,
            [field]: selectedOption
        }))
        setCurrentPage(1)
    }

    // Filter data berdasarkan status, kategori, dan bulan
    const filteredReimbursements = data.reimbursements
        .filter((item) => {
            const matchesStatus = filters.status ? item.status === filters.status.value : true
            const matchesCategory = filters.kategori ? item.kategori === filters.kategori.value : true

            const matchesMonth = filters.bulan
                ? new Date(item.tanggalPengajuan).getMonth() + 1 === filters.bulan.value
                : true

            const matchesYear = filters.tahun
                ? new Date(item.tanggalPengajuan).getFullYear() === filters.tahun.value
                : true

            return matchesStatus && matchesCategory && matchesMonth && matchesYear
        })

        // Urutkan dari tanggal terbaru ke terlama
        .sort((a, b) => new Date(b.tanggalPengajuan) - new Date(a.tanggalPengajuan))

    const totalPages = Math.ceil(filteredReimbursements.length / itemsPerPage)
    const currentReimbursements = filteredReimbursements.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1)
        }
    }

    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1)
        }
    }

    const handleCancel = (report) => {
        setSelectedReport(report)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setCancelReason('')
        setSelectedReport(null)
    }

    const handleSubmitCancel = async () => {
        if (!selectedReport || !cancelReason) {
            toast.warning('Harap isi alasan pembatalan terlebih dahulu!')
            return
        }

        try {
            const uid = localStorage.getItem('userUid');
            const reimbursementDocRef = doc(db, 'reimbursement', selectedReport.id)

            const newStatusHistory = {
                timestamp: new Date().toISOString(),
                actor: uid,
                status: 'Dibatalkan'                
            };

            await updateDoc(reimbursementDocRef, {
                status: 'Dibatalkan',
                cancelReason: cancelReason || 'Alasan tidak diberikan',
                statusHistory: arrayUnion(newStatusHistory)
            })

            // Refresh data            
            const q = query(collection(db, 'reimbursement'), where('user.uid', '==', uid))
            const querySnapshot = await getDocs(q)
            const reimbursements = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                displayId: doc.data().displayId,
                ...doc.data()
            }))

            setData({ reimbursements })
            toast.success('Reimbursement berhasil dibatalkan.')
            handleCloseModal()
        } catch (error) {
            console.error('Error cancelling reimbursement:', error)
            toast.error('Gagal membatalkan reimbursement. Silakan coba lagi.')
        }
    }

    const openActionMenu = (item, event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        setActionMenu({
            id: item.id,
            item,
            top: rect.bottom + window.scrollY + 4,
            left: rect.right + window.scrollX
        })
    }

    const closeActionMenu = () => setActionMenu(null)

    const handlePrintRbsForm = async (item) => {
        closeActionMenu()
        setPrintLoadingId(item.id)
        try {
            const url = await generateReimbursementPDF(item)
            if (!url) return
            const win = window.open(url, '_blank', 'noopener,noreferrer')
            if (!win) toast.warning('Pop-up diblokir browser. Izinkan pop-up untuk mencetak RBS Form.')
        } catch (error) {
            console.error('Error printing RBS Form:', error)
            toast.error('Gagal mencetak RBS Form')
        } finally {
            setPrintLoadingId(null)
        }
    }

    const handlePrintLampiran = (item) => {
        closeActionMenu()
        if (!item.lampiranUrl) {
            toast.error('Lampiran tidak tersedia')
            return
        }
        const win = window.open(item.lampiranUrl, '_blank', 'noopener,noreferrer')
        if (!win) toast.warning('Pop-up diblokir browser. Izinkan pop-up untuk mencetak Lampiran.')
    }

    const handlePrintBoth = async (item) => {
        closeActionMenu()
        setPrintLoadingId(item.id)
        try {
            const url = await generateReimbursementPDF(item)
            if (url) {
                const win = window.open(url, '_blank', 'noopener,noreferrer')
                if (!win) toast.warning('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.')
            }
            if (item.lampiranUrl) {
                window.open(item.lampiranUrl, '_blank', 'noopener,noreferrer')
            } else {
                toast.error('Lampiran tidak tersedia, hanya RBS Form yang dicetak')
            }
        } catch (error) {
            console.error('Error printing documents:', error)
            toast.error('Gagal mencetak dokumen')
        } finally {
            setPrintLoadingId(null)
        }
    }

    const handleMarkTransferred = async (item) => {
        closeActionMenu()
        try {
            const reimbursementDocRef = doc(db, 'reimbursement', item.id)
            const transferredAt = new Date().toISOString()
            await updateDoc(reimbursementDocRef, { transferred: true, transferredAt })

            setData((prev) => ({
                reimbursements: prev.reimbursements.map((r) =>
                    r.id === item.id ? { ...r, transferred: true, transferredAt } : r
                )
            }))
            toast.success('Ditandai sebagai sudah ditransfer')
        } catch (error) {
            console.error('Error marking transferred:', error)
            toast.error('Gagal menandai sebagai Transferred')
        }
    }

    const isDark = theme === 'dark'
    const selectStyles = {
        control: (base) => ({
            ...base,
            display: 'flex', // Menggunakan Flexbox
            alignItems: 'center', // Teks berada di tengah vertikal
            justifyContent: 'space-between', // Menjaga ikon dropdown di kanan
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            fontSize: '12px', // Ukuran teks
            height: '32px', // Tinggi field tetap
            padding: '0 4px', // Padding horizontal
            lineHeight: 'normal', // Pastikan line-height default
            '&:hover': {
                borderColor: '#3b82f6'
            },
            borderRadius: '8px' // Sudut melengkung
        }),
        singleValue: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        input: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        placeholder: (base) => ({ ...base, color: isDark ? '#9ca3af' : '#6b7280' }),
        menu: (base) => ({
            ...base,
            zIndex: 100,
            backgroundColor: isDark ? '#1f2937' : '#ffffff'
        }),
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

    const FilterSelect = ({ field, label }) => {
        // For year, use the dynamically generated yearOptions
        const options = field === 'tahun' ? yearOptions : filterOptions[field]

        return (
            <Select
                value={filters[field]}
                onChange={(option) => handleFilterChange(field, option)}
                options={options}
                placeholder={label}
                isClearable={field !== 'bulan' && field !== 'tahun'}
                className="w-38 lg:w-40"
                styles={selectStyles}
                isSearchable={false}
                menuPortalTarget={document.body}
                menuPosition="absolute"
            />
        )
    }

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg mb-6 shadow-sm transition-colors">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-2 gap-4">
                    <h3 className="text-xl font-medium dark:text-gray-100">Reimbursement Diajukan</h3>
                    <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2">
                        {[...Array(4)].map((_, index) => (
                            <div key={index} className="w-full lg:w-40">
                                <Skeleton width="100%" height={32} />
                            </div>
                        ))}
                    </div>
                </div>
                <Skeleton count={5} height={40} />
            </div>
        )
    }

    const shouldShowEmptyState = data.reimbursements.length === 0 || filteredReimbursements.length === 0

    return (
        <div>
            {shouldShowEmptyState ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg mb-6 shadow-sm transition-colors">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-2 gap-4">
                        <h3 className="text-xl font-medium items-center dark:text-gray-100">Reimbursement Diajukan</h3>
                        <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2">
                            <FilterSelect field="status" label="Status" />
                            <FilterSelect field="kategori" label="Kategori" />
                            <FilterSelect field="bulan" label="Bulan" />
                            <FilterSelect field="tahun" label="Tahun" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center mt-4">
                        <figure className="w-44 h-44 mb-4">
                            <img src={EmptyState} alt="reimbursement icon" className="w-full h-full object-contain" />
                        </figure>
                    </div>
                </div>
            ) : (
                // Jika ada data reimbursement
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg mb-6 shadow-sm transition-colors">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-2 gap-4">
                        <h3 className="text-xl font-medium dark:text-gray-100">Reimbursement Diajukan</h3>
                        <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2">
                            <FilterSelect field="status" label="Status" />
                            <FilterSelect field="kategori" label="Kategori" />
                            <FilterSelect field="bulan" label="Bulan" />
                            <FilterSelect field="tahun" label="Tahun" />
                        </div>
                    </div>

                    <div className="w-full">
                        <div className="w-full overflow-x-auto">
                            <div className="inline-block min-w-[800px] w-full">
                                <table className="w-full bg-white dark:bg-gray-800 text-sm dark:text-gray-200">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-700 text-left dark:text-gray-100">
                                            <th className="px-2 py-2 border dark:border-gray-600 text-center w-auto">No.</th>
                                            <th className="px-4 py-2 border dark:border-gray-600">Nomor Dokumen</th>
                                            <th className="px-4 py-2 border dark:border-gray-600">Kategori Reimbursement</th>
                                            <th className="px-4 py-2 border dark:border-gray-600">Jumlah</th>
                                            <th className="px-4 py-2 border dark:border-gray-600">Tanggal Pengajuan</th>
                                            <th className="py-2 border dark:border-gray-600 text-center">Status</th>
                                            <th className="py-2 border dark:border-gray-600 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentReimbursements.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-2 py-2 border dark:border-gray-600 text-center w-auto">
                                                    {index + 1 + (currentPage - 1) * itemsPerPage}
                                                </td>
                                                <td className="px-4 py-2 border dark:border-gray-600">
                                                    <Link
                                                        to={`/reimbursement/${item.id}`}
                                                        className="text-black dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 hover:underline cursor-pointer"
                                                    >
                                                        {item.displayId}
                                                    </Link>
                                                    {item.transferred && (
                                                        <div className="text-[10px] font-semibold text-black dark:text-gray-300 leading-tight mt-0.5">
                                                            Transferred
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 border dark:border-gray-600">{item.kategori}</td>
                                                <td className="px-4 py-2 border dark:border-gray-600">
                                                    Rp{item.totalBiaya.toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-4 py-2 border dark:border-gray-600">
                                                    {formatDate(item.tanggalPengajuan)}
                                                </td>
                                                <td className="px-2 py-2 border text-center">
                                                    <span
                                                        className={`px-4 py-1 rounded-full text-xs font-medium 
                                            ${
                                                item.status === 'Diajukan'
                                                    ? 'bg-blue-200 text-blue-800 border-[1px] border-blue-600'
                                                    : item.status === 'Disetujui'
                                                      ? 'bg-green-200 text-green-800 border-[1px] border-green-600'
                                                      : item.status === 'Diproses'
                                                        ? 'bg-yellow-200 text-yellow-800 border-[1px] border-yellow-600'
                                                        : item.status === 'Ditolak'
                                                          ? 'bg-red-200 text-red-800 border-[1px] border-red-600'
                                                          : item.status === 'Divalidasi'
                                                            ? 'bg-purple-200 text-purple-800 border-[1px] border-purple-600'
                                                            : 'bg-gray-300 text-gray-700 border-[1px] border-gray-600'
                                            }`}
                                                    >
                                                        {item.status || 'Tidak Diketahui'}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2 border text-center">
                                                    {item.status === 'Disetujui' ? (
                                                        <button
                                                            className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            onClick={(e) => openActionMenu(item, e)}
                                                            disabled={printLoadingId === item.id}
                                                        >
                                                            {printLoadingId === item.id ? (
                                                                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                                            ) : (
                                                                <>
                                                                    Cetak
                                                                    <svg
                                                                        className="w-3 h-3"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                    >
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed hover"
                                                            onClick={() => handleCancel(item)}
                                                            disabled={item.status !== 'Diajukan'}
                                                        >
                                                            Batalkan
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Conditional Pagination - hanya muncul jika lebih dari satu page */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-1 mt-6 text-xs">
                            {/* Tombol Previous */}
                            <button
                                onClick={prevPage}
                                disabled={currentPage === 1}
                                className={`flex items-center px-2 h-9 rounded-full ${
                                    currentPage === 1
                                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                                        : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                }`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="size-4"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 19.5L8.25 12l7.5-7.5"
                                    />
                                </svg>
                            </button>

                            {/* Tombol Halaman dengan Ellipsis */}
                            {(() => {
                                let pages = []
                                // Mengurangi jumlah halaman yang ditampilkan di mobile
                                const visiblePages = window.innerWidth < 640 ? 1 : 3

                                // Selalu tampilkan halaman pertama
                                pages.push(
                                    <button
                                        key={1}
                                        onClick={() => setCurrentPage(1)}
                                        className={`min-w-[36px] h-9 rounded-full ${
                                            currentPage === 1
                                                ? 'bg-red-600 text-white'
                                                : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                        }`}
                                    >
                                        1
                                    </button>
                                )

                                if (totalPages <= visiblePages + 2) {
                                    // Jika total halaman sedikit, tampilkan semua
                                    for (let i = 2; i <= totalPages; i++) {
                                        pages.push(
                                            <button
                                                key={i}
                                                onClick={() => setCurrentPage(i)}
                                                className={`min-w-[36px] h-9 rounded-full ${
                                                    currentPage === i
                                                        ? 'bg-red-600 text-white'
                                                        : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                }`}
                                            >
                                                {i}
                                            </button>
                                        )
                                    }
                                } else {
                                    // Logika untuk mobile view
                                    if (window.innerWidth < 640) {
                                        // Jika current page bukan di awal atau akhir, tampilkan ellipsis di kedua sisi
                                        if (currentPage > 2 && currentPage < totalPages - 1) {
                                            pages.push(
                                                <span key="ellipsis1" className="px-1">
                                                    ...
                                                </span>
                                            )
                                            pages.push(
                                                <button
                                                    key={currentPage}
                                                    onClick={() => setCurrentPage(currentPage)}
                                                    className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                                >
                                                    {currentPage}
                                                </button>
                                            )
                                            pages.push(
                                                <span key="ellipsis2" className="px-1">
                                                    ...
                                                </span>
                                            )
                                        } else if (currentPage <= 2) {
                                            // Tampilkan halaman 2 jika current page di awal
                                            if (currentPage === 2) {
                                                pages.push(
                                                    <button
                                                        key={2}
                                                        onClick={() => setCurrentPage(2)}
                                                        className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                                    >
                                                        2
                                                    </button>
                                                )
                                            }
                                            pages.push(
                                                <span key="ellipsis1" className="px-1">
                                                    ...
                                                </span>
                                            )
                                        } else {
                                            // Tampilkan ellipsis dan halaman sebelum terakhir jika di akhir
                                            pages.push(
                                                <span key="ellipsis1" className="px-1">
                                                    ...
                                                </span>
                                            )
                                            if (currentPage === totalPages - 1) {
                                                pages.push(
                                                    <button
                                                        key={totalPages - 1}
                                                        onClick={() => setCurrentPage(totalPages - 1)}
                                                        className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                                    >
                                                        {totalPages - 1}
                                                    </button>
                                                )
                                            }
                                        }
                                    } else {
                                        // Desktop view logic (sama seperti sebelumnya)
                                        if (currentPage <= visiblePages) {
                                            for (let i = 2; i <= visiblePages; i++) {
                                                pages.push(
                                                    <button
                                                        key={i}
                                                        onClick={() => setCurrentPage(i)}
                                                        className={`min-w-[36px] h-9 rounded-full ${
                                                            currentPage === i
                                                                ? 'bg-red-600 text-white'
                                                                : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                        }`}
                                                    >
                                                        {i}
                                                    </button>
                                                )
                                            }
                                            pages.push(
                                                <span key="ellipsis1" className="px-1">
                                                    ...
                                                </span>
                                            )
                                        } else if (currentPage > totalPages - visiblePages) {
                                            pages.push(
                                                <span key="ellipsis1" className="px-1">
                                                    ...
                                                </span>
                                            )
                                            for (let i = totalPages - visiblePages + 1; i < totalPages; i++) {
                                                pages.push(
                                                    <button
                                                        key={i}
                                                        onClick={() => setCurrentPage(i)}
                                                        className={`min-w-[36px] h-9 rounded-full ${
                                                            currentPage === i
                                                                ? 'bg-red-600 text-white'
                                                                : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                        }`}
                                                    >
                                                        {i}
                                                    </button>
                                                )
                                            }
                                        } else {
                                            pages.push(
                                                <span key="ellipsis1" className="px-1">
                                                    ...
                                                </span>
                                            )
                                            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                                if (i > 1 && i < totalPages) {
                                                    pages.push(
                                                        <button
                                                            key={i}
                                                            onClick={() => setCurrentPage(i)}
                                                            className={`min-w-[36px] h-9 rounded-full ${
                                                                currentPage === i
                                                                    ? 'bg-red-600 text-white'
                                                                    : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                            }`}
                                                        >
                                                            {i}
                                                        </button>
                                                    )
                                                }
                                            }
                                            pages.push(
                                                <span key="ellipsis2" className="px-1">
                                                    ...
                                                </span>
                                            )
                                        }
                                    }

                                    // Selalu tampilkan halaman terakhir
                                    if (totalPages > 1) {
                                        pages.push(
                                            <button
                                                key={totalPages}
                                                onClick={() => setCurrentPage(totalPages)}
                                                className={`min-w-[36px] h-9 rounded-full ${
                                                    currentPage === totalPages
                                                        ? 'bg-red-600 text-white'
                                                        : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                }`}
                                            >
                                                {totalPages}
                                            </button>
                                        )
                                    }
                                }

                                return pages
                            })()}

                            {/* Tombol Next */}
                            <button
                                onClick={nextPage}
                                disabled={currentPage === totalPages}
                                className={`flex items-center px-2 h-9 rounded-full ${
                                    currentPage === totalPages
                                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                                        : 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                }`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="size-4"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            )}
            <Modal
                showModal={isModalOpen}
                selectedReport={selectedReport}
                cancelReason={cancelReason}
                setCancelReason={setCancelReason}
                onClose={handleCloseModal}
                onConfirm={handleSubmitCancel}
                title="Konfirmasi Pembatalan"
                message={`Apakah Anda yakin ingin membatalkan laporan ${selectedReport?.displayId || 'ini'}?`}
                cancelText="Tidak"
                confirmText="Ya, Batalkan"
                showCancelReason={true}
                reasonLabel='Alasan Pembatalan'
                reasonPlaceholder='Masukkan alasan pembatalan...'
            />

            {actionMenu && ReactDOM.createPortal(
                <>
                    <div className="fixed inset-0 z-40" onClick={closeActionMenu} />
                    <div
                        className="fixed z-50 w-52 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 text-sm text-left"
                        style={{ top: actionMenu.top, left: actionMenu.left, transform: 'translateX(-100%)' }}
                    >
                        <button
                            className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => handlePrintRbsForm(actionMenu.item)}
                        >
                            Print RBS Form
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => handlePrintLampiran(actionMenu.item)}
                        >
                            Print Lampiran
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => handlePrintBoth(actionMenu.item)}
                        >
                            Print Both
                        </button>
                        <div className="my-1 border-t border-gray-100 dark:border-gray-600" />
                        {actionMenu.item.transferred ? (
                            <div className="px-4 py-2 text-gray-400 dark:text-gray-500 cursor-not-allowed">
                                &#10003; Transferred
                            </div>
                        ) : (
                            <button
                                className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                                onClick={() => handleMarkTransferred(actionMenu.item)}
                            >
                                Transferred
                            </button>
                        )}
                    </div>
                </>,
                document.body
            )}
        </div>
    )
}

export default ReimbursementTable