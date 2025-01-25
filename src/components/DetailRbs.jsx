import React, { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { useParams } from 'react-router-dom'
import { generateReimbursementPDF } from '../utils/ReimbursementPdf'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import ModalPDF from './ModalPDF'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

const DetailRbs = () => {
    const [userData, setUserData] = useState(null)
    const [reimbursementDetail, setReimbursementDetail] = useState(null)
    const [reviewers, setReviewers] = useState([])
    const [, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    const { id } = useParams() // Get reimbursement ID from URL params
    const uid = localStorage.getItem('userUid')

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true)

                // Fetch user data
                const userDocRef = doc(db, 'users', uid)
                const userSnapshot = await getDoc(userDocRef)

                if (!userSnapshot.exists()) {
                    throw new Error('User tidak ditemukan')
                }

                // Fetch reimbursement data
                const reimbursementDocRef = doc(db, 'reimbursement', id)
                const reimbursementSnapshot = await getDoc(reimbursementDocRef)

                if (!reimbursementSnapshot.exists()) {
                    throw new Error('Data reimbursement tidak ditemukan')
                }

                const reimbursementData = reimbursementSnapshot.data()
                setUserData(userSnapshot.data())
                setReimbursementDetail(reimbursementData)

                // Helper function to fetch names of reviewers
                const fetchReviewerNames = async (reviewerArray) => {
                    if (!Array.isArray(reviewerArray)) return []
                    const promises = reviewerArray.map(async (reviewerUid) => {
                        try {
                            const reviewerDocRef = doc(db, 'users', reviewerUid)
                            const reviewerSnapshot = await getDoc(reviewerDocRef)
                            return reviewerSnapshot.exists() ? reviewerSnapshot.data().nama : null
                        } catch (error) {
                            console.error(`Error fetching reviewer (${reviewerUid}):`, error)
                            return null
                        }
                    })
                    return Promise.all(promises)
                }

                // Fetch names for all reviewers in reviewer1 and reviewer2
                const [reviewer1Names, reviewer2Names, validatorNames] = await Promise.all([
                    fetchReviewerNames(reimbursementData?.user?.reviewer1),
                    fetchReviewerNames(reimbursementData?.user?.reviewer2),
                    fetchReviewerNames(reimbursementData?.user?.validator)
                ])

                // Combine reviewer names and filter out null values
                const validReviewerNames = [...reviewer1Names, ...reviewer2Names].filter((name) => name !== null)
                setReviewers({
                    reviewerNames: validReviewerNames,
                    validatorNames: validatorNames.filter((name) => name !== null)
                })
            } catch (error) {
                console.error('Error fetching data:', error)
                setError(error.message)
            } finally {
                setIsLoading(false)
            }
        }

        if (uid && id) {
            fetchData()
        }
    }, [uid, id]) // Dependencies array to prevent infinite loop

    // Fungsi untuk mendapatkan status approval dengan nama reviewer
    const getDetailedApprovalStatus = (reimbursement, reviewerNames) => {
        if (!reimbursement || !reimbursement.statusHistory || reimbursement.statusHistory.length === 0) {
            return '-'
        }

        const lastStatus = reimbursement.statusHistory[reimbursement.statusHistory.length - 1]
        const { status, actor } = lastStatus

        // Helper function to determine approver
        const determineApprover = (reviewerArray, roleIndexStart) => {
            // Cari index reviewer di array reviewerNames berdasarkan UID actor
            const reviewerIndex = reviewerArray.findIndex((uid) => uid === actor)
            if (reviewerIndex !== -1 && reviewerNames.reviewerNames) {
                return reviewerNames.reviewerNames[roleIndexStart + reviewerIndex] || 'N/A'
            }
            return '-'
        }

        // Helper function khusus untuk validator
        const determineValidator = (validatorArray, actor) => {
            const validatorIndex = validatorArray.findIndex((uid) => uid === actor)
            if (validatorIndex !== -1 && reviewers.validatorNames && reviewers.validatorNames[validatorIndex]) {
                return reviewers.validatorNames[validatorIndex]
            }
            return 'N/A'
        }

        // Periksa Reviewer 1 dan Reviewer 2
        const reviewer1Array = reimbursement?.user?.reviewer1 || []
        const reviewer2Array = reimbursement?.user?.reviewer2 || []
        const validatorArray = reimbursement?.user?.validator || []

        // Logika untuk kasus reviewer2 kosong
        const reviewer2Exists = Array.isArray(reviewer2Array) && reviewer2Array.some((uid) => uid)

        // Cek status approval dari reviewer
        if (reimbursement.approvedByReviewer1Status === 'reviewer' && reimbursement.approvedByReviewer1) {
            const reviewer1 = determineApprover(reviewer1Array, 0)
            if (reviewer1 !== '-') return reviewer1
        }
        switch (reimbursement.status) {
            case 'Ditolak': {
                if (status.includes('Super Admin')) {
                    return 'Super Admin'
                }
                if (status.includes('Validator')) {
                    return determineValidator(validatorArray, actor)
                }
                if (status.includes('Reviewer 1')) {
                    return determineApprover(reviewer1Array, 0)
                }
                if (status.includes('Reviewer 2')) {
                    return determineApprover(reviewer2Array, reviewer1Array.length)
                }
                break
            }

            case 'Divalidasi': {
                if (status.includes('Super Admin')) {
                    return 'Super Admin'
                }
                if (status.includes('Validator')) {
                    return determineValidator(validatorArray, actor)
                }
                break
            }

            case 'Diproses': {
                if (reimbursement.approvedBySuperAdmin) {
                    return 'Super Admin'
                }
                if (reimbursement.approvedByReviewer1) {
                    return determineApprover(reviewer1Array, 0)
                }
                break
            }

            case 'Disetujui': {
                if (status.includes('Super Admin')) {
                    return 'Super Admin'
                }
                if (!reviewer2Exists && status.includes('Reviewer 1')) {
                    return determineApprover(reviewer1Array, 0)
                }
                if (status.includes('Reviewer 2')) {
                    return determineApprover(reviewer2Array, reviewer1Array.length)
                }
                break
            }

            default:
                return '-'
        }

        return '-'
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A' // Handle null/undefined
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date)
    }

    const [modalPdfUrl, setModalPdfUrl] = useState(null)
    const [modalTitle, setModalTitle] = useState('')

    const handleViewAttachment = (lampiranUrl) => {
        if (lampiranUrl) {
            setModalPdfUrl(lampiranUrl)
            setModalTitle(`Lampiran ${reimbursementDetail.displayId}`)
        } else {
            toast.error('Lampiran tidak tersedia')
        }
    }

    const closePreview = () => {
        setModalPdfUrl(null) // Reset URL untuk menutup preview
        setModalTitle('')
    }

    const handleGenerateAndPreviewPDF = async () => {
        setIsLoading(true)
        try {
            setIsLoading(true)
            const url = await generateReimbursementPDF(reimbursementDetail)

            if (url) {
                setModalPdfUrl(url)
                setModalTitle(`Preview ${reimbursementDetail.displayId}`)
            }
        } catch (error) {
            toast.error('Gagal menghasilkan PDF')
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const getColumns = (kategori) => {
        const baseColumns = [
            { header: 'No.', key: 'no' },
            { header: 'Jenis Reimbursement', key: 'jenis' },
            { header: 'Tanggal Aktivitas', key: 'tanggal' }
        ]

        const categoryColumns = {
            bbm: [
                { header: 'Lokasi Pertamina', key: 'lokasi' },
                { header: 'Plat Nomor', key: 'plat' }
            ],
            operasional: [
                { header: 'Kebutuhan', key: 'kebutuhan' },
                { header: 'Keterangan', key: 'keterangan' }
            ],
            'ga/umum': [
                { header: 'Item', key: 'item' },
                { header: 'Keterangan', key: 'keterangan' }
            ],
            default: []
        }

        const additionalColumns = categoryColumns[kategori?.toLowerCase()] || categoryColumns.default
        return [...baseColumns, ...additionalColumns, { header: 'Biaya', key: 'biaya' }]
    }

    // Render cell berdasarkan key
    const renderCell = (item, column, index) => {
        switch (column.key) {
            case 'no':
                return <div className="text-center">{index + 1}</div>
            case 'tanggal':
                return formatDate(item[column.key])
            case 'biaya':
                return `Rp${item[column.key]?.toLocaleString('id-ID') || 'N/A'}`
            case 'item':
                return item[column.key] || 'N/A'
            case 'keterangan':
                return item[column.key] || '-'
            default:
                return item[column.key] || 'N/A'
        }
    }

    if (!userData) {
        return (
            <div className="container mx-auto py-10 px-4 md:py-8 md:px-0">
                <h2 className="text-xl font-medium mb-4">
                    Detail <span className="font-bold">Reimbursement</span>
                </h2>
                <div className="bg-white p-4 md:p-6 rounded-lg mb-6 shadow-sm">
                    {/* Desktop View (xl:1280px and above) */}
                    <div className="hidden xl:block">
                        <div className="grid grid-cols-2 gap-x-16 mb-4 font-medium">
                            <div className="grid grid-cols-[auto_1fr] gap-x-16">
                                {[...Array(5)].map((_, index) => (
                                    <React.Fragment key={`desktop-left-${index}`}>
                                        <Skeleton width={120} height={24} />
                                        <Skeleton width={200} height={24} />
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="grid grid-cols-[auto_1fr] gap-x-16">
                                {[...Array(5)].map((_, index) => (
                                    <React.Fragment key={`desktop-right-${index}`}>
                                        <Skeleton width={120} height={24} />
                                        <Skeleton width={200} height={24} />
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tablet/Laptop View (768px - 1279px) */}
                    <div className="hidden md:block xl:hidden">
                        <div className="grid grid-cols-2 gap-x-8 mb-4">
                            <div className="space-y-1">
                                {[...Array(5)].map((_, index) => (
                                    <div key={`tablet-left-${index}`} className="flex items-center">
                                        <Skeleton width={100} height={20} className="mr-2" />
                                        <Skeleton width={150} height={20} />
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-1">
                                {[...Array(5)].map((_, index) => (
                                    <div key={`tablet-right-${index}`} className="flex items-center">
                                        <Skeleton width={100} height={20} className="mr-2" />
                                        <Skeleton width={150} height={20} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Mobile View (below 768px) */}
                    <div className="md:hidden">
                        <div className="space-y-1 mb-4">
                            {[...Array(10)].map((_, index) => (
                                <div
                                    key={`mobile-${index}`}
                                    className="grid grid-cols-[120px_1fr] gap-x-1 text-sm items-start"
                                >
                                    <Skeleton width={100} height={20} />
                                    <Skeleton width={'100%'} height={20} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Responsive Table Skeleton */}
                    <div className="overflow-x-auto -mx-4 md:mx-0 mb-8">
                        <div className="min-w-[640px] md:w-full p-4 md:p-0">
                            {/* Table Header Skeleton */}
                            <div className="bg-gray-100 grid grid-cols-6 rounded-t-lg">
                                {[...Array(6)].map((_, index) => (
                                    <div key={`header-${index}`} className="p-2">
                                        <Skeleton height={24} />
                                    </div>
                                ))}
                            </div>

                            {/* Table Body Skeleton */}
                            {[...Array(3)].map((_, rowIndex) => (
                                <div key={`row-${rowIndex}`} className="grid grid-cols-6 border-b">
                                    {[...Array(6)].map((_, colIndex) => (
                                        <div key={`cell-${rowIndex}-${colIndex}`} className="p-2">
                                            <Skeleton height={20} />
                                        </div>
                                    ))}
                                </div>
                            ))}

                            {/* Table Footer Skeleton */}
                            <div className="grid grid-cols-6 mt-4">
                                <div className="col-span-5 p-2 text-right">
                                    <Skeleton width={120} height={24} className="ml-auto" />
                                </div>
                                <div className="p-2">
                                    <Skeleton height={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Skeleton */}
                    <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2 mt-4">
                        <div className="w-full md:w-[170px]">
                            <Skeleton height={45} className="w-full" />
                        </div>
                        <div className="w-full md:w-[170px]">
                            <Skeleton height={45} className="w-full" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const columns = getColumns(reimbursementDetail?.kategori)

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Detail <span className="font-bold">Reimbursement</span>
            </h2>

            <div className="bg-white p-4 md:p-6 rounded-lg shadow">
                {/* Responsive grid for user details */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-x-16 mb-6 font-medium">
                    {/* Mobile dan Tablet view (up to xl breakpoint) */}
                    <div className="xl:hidden">
                        <div className="flex flex-wrap justify-between gap-1 md:gap-x-12">
                            {/* First column */}
                            <div className="space-y-1 flex-1">
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>ID</p>
                                    <p className="text-left">:</p>
                                    <p className="break-all">{reimbursementDetail?.displayId ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Nama Lengkap</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{reimbursementDetail?.user?.nama ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Department</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">
                                        {Array.isArray(reimbursementDetail?.user?.department) &&
                                        reimbursementDetail.user.department.length > 0
                                            ? reimbursementDetail.user.department.join(', ')
                                            : ''}
                                    </p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Unit Bisnis</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{reimbursementDetail?.user?.unit ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Tgl Pengajuan</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">
                                        {formatDate(reimbursementDetail?.tanggalPengajuan) ?? 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Second column */}
                            <div className="space-y-1 flex-1">
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Kategori</p>
                                    <p className="text-left">:</p>
                                    <p className="break-all">{reimbursementDetail?.kategori ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Nomor Rekening</p>
                                    <p className="text-left">:</p>
                                    <p className="break-all">{reimbursementDetail?.user?.accountNumber ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Nama Bank</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{reimbursementDetail?.user?.bankName ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Status</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{reimbursementDetail?.status ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>
                                        {reimbursementDetail?.status === 'Ditolak'
                                            ? 'Ditolak Oleh'
                                            : reimbursementDetail?.status === 'Divalidasi'
                                              ? 'Divalidasi Oleh'
                                              : 'Disetujui Oleh'}
                                    </p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">
                                        {getDetailedApprovalStatus(reimbursementDetail, reviewers)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop layout  */}
                    <div className="hidden xl:grid grid-cols-[auto_1fr] gap-x-16 text-base">
                        <p>ID</p>
                        <p>: {reimbursementDetail?.displayId ?? 'N/A'}</p>
                        <p>Nama Lengkap</p>
                        <p>: {reimbursementDetail?.user?.nama ?? 'N/A'}</p>
                        <p>Department</p>
                        <p>
                            :{' '}
                            {Array.isArray(reimbursementDetail?.user?.department) &&
                            reimbursementDetail.user.department.length > 0
                                ? reimbursementDetail.user.department.join(', ')
                                : ''}
                        </p>
                        <p>Unit Bisnis</p>
                        <p>: {reimbursementDetail?.user?.unit ?? 'N/A'}</p>
                        <p>Tanggal Pengajuan</p>
                        <p>: {formatDate(reimbursementDetail?.tanggalPengajuan) ?? 'N/A'}</p>
                    </div>
                    <div className="hidden xl:grid grid-cols-[auto_1fr] gap-x-16 text-base">
                        <p>Kategori Reimbursement</p>
                        <p>: {reimbursementDetail?.kategori ?? 'N/A'}</p>
                        <p>Nomor Rekening</p>
                        <p>: {reimbursementDetail?.user?.accountNumber ?? 'N/A'}</p>
                        <p>Nama Bank</p>
                        <p>: {reimbursementDetail?.user?.bankName ?? 'N/A'}</p>
                        <p>Status</p>
                        <p>: {reimbursementDetail?.status ?? 'N/A'}</p>
                        <p>
                            {reimbursementDetail?.status === 'Ditolak'
                                ? 'Ditolak Oleh'
                                : reimbursementDetail?.status === 'Divalidasi'
                                  ? 'Divalidasi Oleh'
                                  : 'Disetujui Oleh'}
                        </p>
                        <p>: {getDetailedApprovalStatus(reimbursementDetail, reviewers)}</p>
                    </div>
                </div>

                {/* Responsive table wrapper */}
                <div className="mb-8 overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-[640px] md:w-full p-4 md:p-0">
                        <table className="w-full bg-white border rounded-lg text-sm">
                            <thead>
                                <tr className="bg-gray-100 text-left">
                                    {columns.map((column) => (
                                        <th
                                            key={column.key}
                                            className={`px-4 py-2 border ${column.key === 'no' ? 'text-center w-12' : 'text-left'}`}
                                        >
                                            {column.header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reimbursementDetail?.reimbursements?.map((item, index) => (
                                    <tr key={index}>
                                        {columns.map((column) => (
                                            <td key={column.key} className="px-4 py-2 border">
                                                {renderCell(item, column, index)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-4"></td>
                                </tr>

                                {reimbursementDetail?.status === 'Dibatalkan' && (
                                    <tr>
                                        <td colSpan={columns.length} className="px-4 py-2 text-left border">
                                            <span className="font-semibold">Alasan Pembatalan :</span>{' '}
                                            {reimbursementDetail?.cancelReason}
                                        </td>
                                    </tr>
                                )}

                                <tr className="font-semibold">
                                    <td colSpan={columns.length - 1} className="px-4 py-2 text-right border">
                                        Total Biaya :
                                    </td>
                                    <td className="px-4 py-2 border">
                                        Rp{reimbursementDetail?.totalBiaya?.toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Responsive action buttons */}
                <div className="flex flex-col md:flex-row md:justify-end mt-6 space-y-2 md:space-y-0 md:space-x-2">
                    <button
                        className={`w-full md:w-auto px-12 py-3 rounded ${
                            userData?.uid === reimbursementDetail?.user.uid
                                ? 'text-red-600 bg-transparent hover:text-red-800 border border-red-600 hover:border-red-800'
                                : 'text-white bg-red-600 hover:bg-red-700 hover:text-gray-200'
                        }`}
                        onClick={() => handleViewAttachment(reimbursementDetail?.lampiranUrl)}
                    >
                        Lihat Lampiran
                    </button>

                    {userData?.uid === reimbursementDetail?.user.uid && (
                        <button
                            className={`w-full md:w-auto px-16 py-3 rounded ${
                                reimbursementDetail?.status === 'Disetujui'
                                    ? 'text-white bg-red-600 hover:bg-red-700 hover:text-gray-200'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            }`}
                            onClick={handleGenerateAndPreviewPDF}
                            disabled={reimbursementDetail?.status !== 'Disetujui' || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} className="mr-1 animate-spin" />
                                    Loading..
                                </>
                            ) : (
                                'Print'
                            )}
                        </button>
                    )}
                </div>
            </div>

            <ModalPDF showModal={!!modalPdfUrl} previewUrl={modalPdfUrl} onClose={closePreview} title={modalTitle} />

        </div>
    )
}

export default DetailRbs
