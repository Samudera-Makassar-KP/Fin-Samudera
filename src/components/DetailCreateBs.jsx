import React, { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { useParams, useNavigate } from 'react-router-dom'
import { generateBsPDF } from '../utils/BsPdf'
import ModalPDF from './ModalPDF'
import { toast } from 'react-toastify'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

const DetailCreateBs = () => {
    const [userData, setUserData] = useState(null)
    const [bonSementaraDetail, setBonSementaraDetail] = useState(null)
    const [reviewers, setReviewers] = useState([])
    const [, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    const { id } = useParams()
    const navigate = useNavigate()
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

                // Fetch lpj data
                const bonSementaraDocRef = doc(db, 'bonSementara', id)
                const bonSementaraSnapshot = await getDoc(bonSementaraDocRef)

                if (!bonSementaraSnapshot.exists()) {
                    throw new Error('Data Bon Sementara tidak ditemukan')
                }

                const bonSementaraData = bonSementaraSnapshot.data()
                setUserData(userSnapshot.data())
                setBonSementaraDetail(bonSementaraData)

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
                    fetchReviewerNames(bonSementaraData?.user?.reviewer1),
                    fetchReviewerNames(bonSementaraData?.user?.reviewer2),
                    fetchReviewerNames(bonSementaraData?.user?.validator)
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
    const getDetailedApprovalStatus = (bonSementara, reviewerNames) => {
        if (!bonSementara || !bonSementara.statusHistory || bonSementara.statusHistory.length === 0) {
            return '-'
        }

        const lastStatus = bonSementara.statusHistory[bonSementara.statusHistory.length - 1]
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
        const reviewer1Array = bonSementara?.user?.reviewer1 || []
        const reviewer2Array = bonSementara?.user?.reviewer2 || []
        const validatorArray = bonSementara?.user?.validator || []

        // Logika untuk kasus reviewer2 kosong
        const reviewer2Exists = Array.isArray(reviewer2Array) && reviewer2Array.some((uid) => uid)

        // Cek status approval dari reviewer
        if (bonSementara.approvedByReviewer1Status === 'reviewer' && bonSementara.approvedByReviewer1) {
            const reviewer1 = determineApprover(reviewer1Array, 0)
            if (reviewer1 !== '-') return reviewer1
        }

        switch (bonSementara.status) {
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
                if (bonSementara.approvedBySuperAdmin) {
                    return 'Super Admin'
                }
                if (bonSementara.approvedByReviewer1) {
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

    const closePreview = () => {
        setModalPdfUrl(null) // Reset URL untuk menutup preview
        setModalTitle('')
    }

    const handleGenerateAndPreviewPDF = async () => {
        setIsLoading(true)
        try {
            setIsLoading(true)
            const url = await generateBsPDF(bonSementaraDetail)

            if (url) {
                setModalPdfUrl(url)
                setModalTitle(`Preview ${bonSementaraDetail.displayId}`)
            }
        } catch (error) {
            toast.error('Gagal menghasilkan PDF')
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleBuatLaporan = () => {
        const bonSementara = bonSementaraDetail?.bonSementara?.[0]
        const userDetail = bonSementaraDetail?.user
        if (bonSementara?.kategori === 'GA/Umum') {
            navigate('/lpj/umum', {
                state: {
                    nomorBS: bonSementara.nomorBS,
                    jumlahBS: bonSementara.jumlahBS,
                    aktivitas: bonSementara.aktivitas,
                    unit: userDetail.unit,
                    validator: userDetail.validator,
                }
            })
        } else if (bonSementara?.kategori === 'Marketing/Operasional') {
            navigate('/lpj/marketing', {
                state: {
                    nomorBS: bonSementara.nomorBS,
                    jumlahBS: bonSementara.jumlahBS,
                    aktivitas: bonSementara.aktivitas,
                    unit: userDetail.unit,
                    validator: userDetail.validator,
                }
            })
        } else {
            alert('Kategori tidak dikenali.')
        }
    }

    if (!userData || !bonSementaraDetail) {
        return (
            <div className="container mx-auto py-10 px-4 md:py-8 md:px-0">
                <h2 className="text-xl font-medium mb-4">
                    Detail <span className="font-bold">Pengajuan Bon Sementara</span>
                </h2>
                <div className="bg-white p-4 md:p-6 rounded-lg mb-6 shadow-sm">
                    {/* Desktop View (xl:1280px and above) */}
                    <div className="hidden xl:block">
                        <div className="grid grid-cols-2 gap-x-16 mb-4 font-medium">
                            <div className="grid grid-cols-[auto_1fr] gap-x-16">
                                {[...Array(4)].map((_, index) => (
                                    <React.Fragment key={`desktop-left-${index}`}>
                                        <Skeleton width={120} height={24} />
                                        <Skeleton width={200} height={24} />
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="grid grid-cols-[auto_1fr] gap-x-16">
                                {[...Array(4)].map((_, index) => (
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
                                {[...Array(4)].map((_, index) => (
                                    <div key={`tablet-left-${index}`} className="flex items-center">
                                        <Skeleton width={100} height={20} className="mr-2" />
                                        <Skeleton width={150} height={20} />
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-1">
                                {[...Array(4)].map((_, index) => (
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
                            {[...Array(8)].map((_, index) => (
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
                            <div className="bg-gray-100 grid grid-cols-5 rounded-t-lg">
                                {[...Array(5)].map((_, index) => (
                                    <div key={`header-${index}`} className="p-2">
                                        <Skeleton height={24} />
                                    </div>
                                ))}
                            </div>

                            {/* Table Body Skeleton */}
                            {[...Array(1)].map((_, rowIndex) => (
                                <div key={`row-${rowIndex}`} className="grid grid-cols-5 border-b">
                                    {[...Array(5)].map((_, colIndex) => (
                                        <div key={`cell-${rowIndex}-${colIndex}`} className="p-2">
                                            <Skeleton height={20} />
                                        </div>
                                    ))}
                                </div>
                            ))}
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

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Detail <span className="font-bold">Pengajuan Bon Sementara</span>
            </h2>

            <div className="bg-white p-4 md:p-6 rounded-lg shadow">
                {/* Responsive grid for user details */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-x-16 mb-6 font-medium">
                    {/* Mobile dan Tablet view (up to xl breakpoint) */}
                    <div className="xl:hidden">
                        <div className="flex flex-wrap justify-between gap-1 md:gap-x-12">
                            {/* First Column */}
                            <div className="space-y-1 flex-1">
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Nama Lengkap</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{bonSementaraDetail?.user?.nama ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Department</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">
                                        {' '}
                                        {Array.isArray(bonSementaraDetail?.user?.department) &&
                                        bonSementaraDetail.user.department.length > 0
                                            ? bonSementaraDetail.user.department.join(', ')
                                            : ''}
                                    </p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Unit Bisnis</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{bonSementaraDetail?.user?.unit ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Posisi</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{bonSementaraDetail?.user?.posisi ?? 'N/A'}</p>
                                </div>
                            </div>

                            {/* Second column */}
                            <div className="space-y-1 flex-1">
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Nama Bank</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{bonSementaraDetail?.user?.bankName ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>No. Rekening</p>
                                    <p className="text-left">:</p>
                                    <p className="break-all">{bonSementaraDetail?.user?.accountNumber ?? 'N/A'}</p>
                                </div>

                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Status</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{bonSementaraDetail?.status ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>
                                        {bonSementaraDetail?.status === 'Ditolak'
                                            ? 'Ditolak Oleh'
                                            : bonSementaraDetail?.status === 'Divalidasi'
                                              ? 'Divalidasi Oleh'
                                              : 'Disetujui Oleh'}
                                    </p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">
                                        {getDetailedApprovalStatus(bonSementaraDetail, reviewers)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop layout  */}
                    <div className="hidden xl:grid grid-cols-[auto_1fr] gap-x-16 text-base">
                        <p>Nama Lengkap</p>
                        <p>: {bonSementaraDetail?.user?.nama ?? 'N/A'}</p>
                        <p>Department</p>
                        <p>
                            :{' '}
                            {Array.isArray(bonSementaraDetail?.user?.department) &&
                            bonSementaraDetail.user.department.length > 0
                                ? bonSementaraDetail.user.department.join(', ')
                                : ''}
                        </p>
                        <p>Unit Bisnis</p>
                        <p>: {bonSementaraDetail?.user?.unit ?? 'N/A'}</p>
                        <p>Posisi</p>
                        <p>: {bonSementaraDetail?.user?.posisi ?? 'N/A'}</p>
                    </div>
                    <div className="hidden xl:grid grid-cols-[auto_1fr] gap-x-16 text-base">
                        <p>Nama Bank</p>
                        <p>: {bonSementaraDetail?.user?.bankName ?? 'N/A'}</p>
                        <p>Nomor Rekening</p>
                        <p>: {bonSementaraDetail?.user?.accountNumber ?? 'N/A'}</p>
                        <p>Status</p>
                        <p>: {bonSementaraDetail?.status ?? 'N/A'}</p>
                        <p>
                            {bonSementaraDetail?.status === 'Ditolak'
                                ? 'Ditolak Oleh'
                                : bonSementaraDetail?.status === 'Divalidasi'
                                  ? 'Divalidasi Oleh'
                                  : 'Disetujui Oleh'}
                        </p>
                        <p>: {getDetailedApprovalStatus(bonSementaraDetail, reviewers)}</p>
                    </div>
                </div>

                {/* Responsive table wrapper */}
                <div className="mb-8 overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-[640px] md:w-full p-4 md:p-0">
                        <table className="w-full bg-white border rounded-lg text-sm">
                            <thead>
                                <tr className="bg-gray-100 text-left">
                                    <th className="px-4 py-2 border w-auto">Nomor BS</th>
                                    <th className="px-4 py-2 border w-auto">Kategori</th>
                                    <th className="px-4 py-2 border w-auto">Aktivitas</th>
                                    <th className="px-4 py-2 border w-auto">Jumlah BS</th>
                                    <th className="px-4 py-2 border w-auto">Tanggal Pengajuan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bonSementaraDetail?.bonSementara?.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-2 border">{item.nomorBS}</td>
                                        <td className="px-4 py-2 border">{item.kategori}</td>
                                        <td className="px-4 py-2 border">{item.aktivitas}</td>
                                        <td className="px-4 py-2 border">Rp{item.jumlahBS.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-2 border">
                                            {formatDate(bonSementaraDetail.tanggalPengajuan) ?? 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                {bonSementaraDetail?.status === 'Dibatalkan' && (
                                    <>
                                        <tr>
                                            <td colSpan="5" className="px-4 py-2 text-left border">
                                                &nbsp;
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan="5" className="px-4 py-2 text-left border">
                                                <span className="font-semibold">Alasan Pembatalan :</span>{' '}
                                                {bonSementaraDetail?.cancelReason}
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Responsive action buttons */}
                <div className="flex flex-col md:flex-row md:justify-end mt-6 space-y-2 md:space-y-0 md:space-x-2">
                    {userData?.uid === bonSementaraDetail?.user.uid && (
                        <button
                            onClick={handleBuatLaporan}
                            className={`px-12 py-3 rounded ${
                                bonSementaraDetail?.status === 'Disetujui'
                                    ? 'text-red-600 bg-transparent hover:text-red-800 border border-red-600 hover:border-red-800'
                                    : 'text-gray-300 bg-transparent border border-gray-200 cursor-not-allowed'
                            }`}
                            disabled={bonSementaraDetail?.status !== 'Disetujui'}
                        >
                            Buat Laporan
                        </button>
                    )}

                    {userData?.uid === bonSementaraDetail?.user.uid && (
                        <button
                            className={`px-16 py-3 rounded ${
                                bonSementaraDetail?.status === 'Disetujui'
                                    ? 'text-white bg-red-600 hover:bg-red-700 hover:text-gray-200'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            }`}
                            onClick={handleGenerateAndPreviewPDF}
                            disabled={bonSementaraDetail?.status !== 'Disetujui' || isLoading}
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

export default DetailCreateBs
