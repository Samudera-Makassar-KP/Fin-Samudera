import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import EmptyState from '../assets/images/EmptyState.png'
import Select from 'react-select'
import Modal from '../components/Modal'
import { toast } from 'react-toastify'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

const CreateBsTable = () => {
    const [data, setData] = useState({ bonSementara: [] })
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
    const itemsPerPage = 5 // Jumlah item per halaman

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedReport, setSelectedReport] = useState(null)
    const [cancelReason, setCancelReason] = useState('')

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
            { value: 'Marketing/Operasional', label: 'Marketing/Operasional' },
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
        const fetchUserAndBonSementara = async () => {
            setLoading(true) // Set loading to true before fetching data
            try {
                const uid = localStorage.getItem('userUid')
                if (!uid) {
                    console.error('UID tidak ditemukan di localStorage')
                    setLoading(false)
                    return
                }

                // Query bon sementara berdasarkan UID user
                const q = query(
                    collection(db, 'bonSementara'),
                    where('user.uid', '==', uid) // Filter data bon sementara berdasarkan UID user
                )

                const querySnapshot = await getDocs(q)
                const bonSementara = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    displayId: doc.data().displayId,
                    ...doc.data()
                }))

                const existingYears = new Set(bonSementara.map((item) => new Date(item.tanggalPengajuan).getFullYear()))

                const updatedYearOptions = Array.from(existingYears)
                    .map((year) => ({ value: year, label: `${year}` }))
                    .sort((a, b) => b.value - a.value) // Urutkan tahun dari yang terbaru

                setYearOptions(updatedYearOptions)
                setData({ bonSementara })
            } catch (error) {
                console.error('Error fetching user or bon sementara data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchUserAndBonSementara()
    }, [])

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A' // Handle null/undefined
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

    const filteredBonSementara = data.bonSementara
        .filter((item) => {
            const matchesStatus = filters.status ? item.status === filters.status.value : true

            const matchesCategory = filters.kategori ? item.bonSementara[0].kategori === filters.kategori.value : true

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

    const totalPages = Math.ceil(filteredBonSementara.length / itemsPerPage)
    const currentBonSementara = filteredBonSementara.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1)
        }
    }

    // Fungsi untuk berpindah ke halaman sebelumnya
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
            const bonSemetaraDocRef = doc(db, 'bonSementara', selectedReport.id)

            // Memperbarui data di Firestore
            await updateDoc(bonSemetaraDocRef, {
                status: 'Dibatalkan',
                cancelReason: cancelReason || 'Alasan tidak diberikan'
            })

            // Menyegarkan data bon semetara setelah pembatalan
            const uid = localStorage.getItem('userUid')
            const q = query(collection(db, 'bonSementara'), where('user.uid', '==', uid))
            const querySnapshot = await getDocs(q)
            const bonSementara = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                displayId: doc.data().displayId,
                ...doc.data()
            }))

            setData({ bonSementara }) // Mengupdate state dengan data baru

            toast.success('Pengajuan Bon Sementara berhasil dibatalkan.')
            // Menutup modal setelah pembatalan
            handleCloseModal()
        } catch (error) {
            console.error('Error cancelling bon sementara:', error)
            toast.error('Gagal membatalkan bon sementara. Silakan coba lagi.')
        }
    }

    const selectStyles = {
        control: (base) => ({
            ...base,
            display: 'flex', // Menggunakan Flexbox
            alignItems: 'center', // Teks berada di tengah vertikal
            justifyContent: 'space-between', // Menjaga ikon dropdown di kanan
            borderColor: '#e5e7eb',
            fontSize: '12px', // Ukuran teks
            height: '32px', // Tinggi field tetap
            padding: '0 4px', // Padding horizontal
            lineHeight: 'normal', // Pastikan line-height default
            '&:hover': {
                borderColor: '#3b82f6'
            },
            borderRadius: '8px' // Sudut melengkung
        }),
        menu: (base) => ({
            ...base,
            zIndex: 100
        }),
        option: (base) => ({
            ...base,
            fontSize: '12px',
            padding: '6px 12px',
            cursor: 'pointer'
        }),
        menuList: (base) => ({
            ...base,
            maxHeight: '160px'
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
            />
        )
    }

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-2 gap-4">
                    <h3 className="text-xl font-medium">Bon Sementara Diajukan</h3>
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

    const shouldShowEmptyState = data.bonSementara.length === 0 || filteredBonSementara.length === 0

    return (
        <div>
            {shouldShowEmptyState ? (
                <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-2 gap-4">
                        <h3 className="text-xl font-medium items-center">Bon Sementara Diajukan</h3>
                        <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2">
                            <FilterSelect field="status" label="Status" />
                            <FilterSelect field="kategori" label="Kategori" />
                            <FilterSelect field="bulan" label="Bulan" />
                            <FilterSelect field="tahun" label="Tahun" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center mt-4">
                        <figure className="w-44 h-44 mb-4">
                            <img src={EmptyState} alt="bon sementara icon" className="w-full h-full object-contain" />
                        </figure>
                    </div>
                </div>
            ) : (
                // Jika ada data bon sementara
                <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-2 gap-4">
                        <h3 className="text-xl font-medium items-center">Bon Sementara Diajukan</h3>
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
                                <table className="w-full bg-white text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 text-left">
                                            <th className="px-2 py-2 border text-center w-auto">No.</th>
                                            <th className="px-4 py-2 border">Nomor BS</th>
                                            <th className="px-4 py-2 border">Kategori BS</th>
                                            <th className="px-4 py-2 border">Jumlah BS</th>
                                            <th className="px-4 py-2 border">Tanggal Pengajuan</th>
                                            <th className="py-2 border text-center">Status</th>
                                            <th className="py-2 border text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentBonSementara.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-2 py-2 border text-center w-auto">
                                                    {index + 1 + (currentPage - 1) * itemsPerPage}
                                                </td>
                                                <td className="px-4 py-2 border">
                                                    <Link
                                                        to={`/create-bs/${item.id}`}
                                                        className="text-black hover:text-gray-700 hover:underline cursor-pointer"
                                                    >
                                                        {item.displayId}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-2 border">{item.bonSementara[0].kategori}</td>
                                                <td className="px-4 py-2 border">
                                                    Rp{item.bonSementara[0].jumlahBS.toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-4 py-2 border">
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
                                                    <button
                                                        className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed hover"
                                                        onClick={() => handleCancel(item)}
                                                        disabled={item.status !== 'Diajukan'}
                                                    >
                                                        Batalkan
                                                    </button>
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
                        <div className="flex items-center justify-center gap-2 mt-6 text-xs">
                            {/* Tombol Previous */}
                            <button
                                onClick={prevPage}
                                disabled={currentPage === 1}
                                className={`flex items-center gap-2 p-2 rounded-full ${
                                    currentPage === 1
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'border border-red-600 text-red-600 hover:bg-red-100'
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

                            {/* Tombol Halaman */}
                            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`px-3 py-2 rounded-full ${
                                        currentPage === page
                                            ? 'bg-red-600 text-white'
                                            : 'border border-red-600 text-red-600 hover:bg-red-100'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}

                            {/* Tombol Next */}
                            <button
                                onClick={nextPage}
                                disabled={currentPage === totalPages}
                                className={`flex items-center gap-2 px-2 py-2 rounded-full ${
                                    currentPage === totalPages
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'border border-red-600 text-red-600 hover:bg-red-100'
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
            />

        </div>
    )
}

export default CreateBsTable
