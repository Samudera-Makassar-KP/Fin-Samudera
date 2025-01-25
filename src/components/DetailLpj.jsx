import React, { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { useParams } from 'react-router-dom'
import { generateLpjPDF } from '../utils/LpjPdf'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import ModalPDF from './ModalPDF'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

const DetailLpj = () => {
    const [userData, setUserData] = useState(null)
    const [lpjDetail, setLpjDetail] = useState(null)
    const [reviewers, setReviewers] = useState([])
    const [, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    const { id } = useParams() // Get lpj ID from URL params
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
                const lpjDocRef = doc(db, 'lpj', id)
                const lpjSnapshot = await getDoc(lpjDocRef)

                if (!lpjSnapshot.exists()) {
                    throw new Error('Data LPJ Bon Sementara tidak ditemukan')
                }

                const lpjData = lpjSnapshot.data()
                setUserData(userSnapshot.data())
                setLpjDetail(lpjData)

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
                    fetchReviewerNames(lpjData?.user?.reviewer1),
                    fetchReviewerNames(lpjData?.user?.reviewer2),
                    fetchReviewerNames(lpjData?.user?.validator)
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
    const getDetailedApprovalStatus = (lpj, reviewerNames) => {
        if (!lpj || !lpj.statusHistory || lpj.statusHistory.length === 0) {
            return '-'
        }

        const lastStatus = lpj.statusHistory[lpj.statusHistory.length - 1]
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
        const reviewer1Array = lpj?.user?.reviewer1 || []
        const reviewer2Array = lpj?.user?.reviewer2 || []
        const validatorArray = lpj?.user?.validator || []

        // Logika untuk kasus reviewer2 kosong
        const reviewer2Exists = Array.isArray(reviewer2Array) && reviewer2Array.some((uid) => uid)

        // Cek status approval dari reviewer
        if (lpj.approvedByReviewer1Status === 'reviewer' && lpj.approvedByReviewer1) {
            const reviewer1 = determineApprover(reviewer1Array, 0)
            if (reviewer1 !== '-') return reviewer1
        }

        switch (lpj.status) {
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
                if (lpj.approvedBySuperAdmin) {
                    return 'Super Admin'
                }
                if (lpj.approvedByReviewer1) {
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
            setModalPdfUrl(lampiranUrl) // Set URL untuk preview
            setModalTitle(`Lampiran ${lpjDetail.displayId}`)
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
            const url = await generateLpjPDF(lpjDetail)

            if (url) {
                setModalPdfUrl(url)
                setModalTitle(`Preview ${lpjDetail.displayId}`)
            }
        } catch (error) {
            toast.error('Gagal menghasilkan PDF')
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    if (!userData) {
        return (
            <div className="container mx-auto py-8">
                <h2 className="text-xl font-medium mb-4">
                    Detail <span className="font-bold">LPJ Bon Sementara</span>
                </h2>
                <div className="bg-white p-4 md:p-6 rounded-lg mb-6 shadow-sm">
                    {/* Desktop View (xl:1280px and above) */}
                    <div className="hidden xl:block">
                        <div className="grid grid-cols-2 gap-x-16 mb-4 font-medium">
                            <div className="grid grid-cols-[auto_1fr] gap-x-16">
                                {[...Array(7)].map((_, index) => (
                                    <React.Fragment key={`desktop-left-${index}`}>
                                        <Skeleton width={100} height={20} />
                                        <Skeleton width={200} height={20} />
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="grid grid-cols-[auto_1fr] gap-x-16">
                                {[...Array(7)].map((_, index) => (
                                    <React.Fragment key={`desktop-right-${index}`}>
                                        <Skeleton width={100} height={20} />
                                        <Skeleton width={200} height={20} />
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tablet/Laptop View (768px - 1279px) */}
                    <div className="hidden md:block xl:hidden">
                        <div className="grid grid-cols-2 gap-x-8 mb-4">
                            <div className="space-y-1">
                                {[...Array(7)].map((_, index) => (
                                    <div key={`tablet-left-${index}`} className="flex items-center">
                                        <Skeleton width={80} height={20} className="mr-2" />
                                        <Skeleton width={150} height={20} />
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-1">
                                {[...Array(7)].map((_, index) => (
                                    <div key={`tablet-right-${index}`} className="flex items-center">
                                        <Skeleton width={80} height={20} className="mr-2" />
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
                                    <Skeleton width={100} height={16} />
                                    <Skeleton width={'100%'} height={20} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table Skeleton - Responsive */}
                    <div className="overflow-x-auto -mx-4 md:mx-0 mb-8">
                        <div className="min-w-[640px] md:w-full">
                            <div className="bg-gray-100 grid grid-cols-7">
                                {[...Array(7)].map((_, index) => (
                                    <div key={index} className="p-1">
                                        <Skeleton height={25} />
                                    </div>
                                ))}
                            </div>

                            {[...Array(2)].map((_, index) => (
                                <div key={index} className="grid grid-cols-7 border-b">
                                    {[...Array(7)].map((_, colIndex) => (
                                        <div key={colIndex} className="p-1">
                                            <Skeleton height={25} />
                                        </div>
                                    ))}
                                </div>
                            ))}

                            <div className="grid grid-cols-6 border-t">
                                <div className="col-span-5 p-1 text-right">
                                    <Skeleton height={30} />
                                </div>
                                <div className="p-1">
                                    <Skeleton height={30} />
                                </div>
                            </div>
                            <div className="grid grid-cols-6 border-t">
                                <div className="col-span-5 p-1 text-right">
                                    <Skeleton height={30} />
                                </div>
                                <div className="p-1">
                                    <Skeleton height={30} />
                                </div>
                            </div>
                            <div className="grid grid-cols-6 border-t">
                                <div className="col-span-5 p-1 text-right">
                                    <Skeleton height={30} />
                                </div>
                                <div className="p-1">
                                    <Skeleton height={30} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Skeleton - Responsive */}
                    <div className="flex flex-col md:flex-row md:justify-end space-y-2 md:space-y-0 md:space-x-2">
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
                Detail <span className="font-bold">LPJ Bon Sementara</span>
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
                                    <p className="break-all">{lpjDetail?.displayId ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Nama Lengkap</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{lpjDetail?.user?.nama ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Department</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">
                                        {Array.isArray(lpjDetail?.user?.department) &&
                                        lpjDetail.user.department.length > 0
                                            ? lpjDetail.user.department.join(', ')
                                            : ''}
                                    </p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Unit Bisnis</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{lpjDetail?.user?.unit ?? 'N/A'}</p>
                                </div>
                                {lpjDetail?.kategori?.toLowerCase() === 'marketing/operasional' && (
                                    <>
                                        <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                            <p>Project</p>
                                            <p className="text-left">:</p>
                                            <p className="break-words">{lpjDetail?.project ?? 'N/A'}</p>
                                        </div>
                                        <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                            <p>Customer</p>
                                            <p className="text-left">:</p>
                                            <p className="break-words">{lpjDetail?.customer ?? 'N/A'}</p>
                                        </div>
                                        <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                            <p>Tgl Kegiatan</p>
                                            <p className="text-left">:</p>
                                            <p className="break-words">{formatDate(lpjDetail.tanggal) ?? 'N/A'}</p>
                                        </div>
                                    </>
                                )}
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Tgl Pengajuan</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{formatDate(lpjDetail?.tanggalPengajuan) ?? 'N/A'}</p>
                                </div>
                            </div>

                            {/* Second column */}
                            <div className="space-y-1 flex-1">
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Kategori</p>
                                    <p className="text-left">:</p>
                                    <p className="break-all">{lpjDetail?.kategori ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Nomor BS</p>
                                    <p className="text-left">:</p>
                                    <p className="break-all">{lpjDetail?.nomorBS ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Jumlah BS</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">
                                        Rp{lpjDetail?.jumlahBS.toLocaleString('id-ID') ?? 'N/A'}
                                    </p>
                                </div>
                                {lpjDetail?.kategori?.toLowerCase() === 'marketing/operasional' && (
                                    <>
                                        <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                            <p>Nomor JO</p>
                                            <p className="text-left">:</p>
                                            <p className="break-all">{lpjDetail?.nomorJO ?? 'N/A'}</p>
                                        </div>
                                        <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                            <p>Lokasi</p>
                                            <p className="text-left">:</p>
                                            <p className="break-words">{lpjDetail?.lokasi ?? 'N/A'}</p>
                                        </div>
                                    </>
                                )}
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>Status</p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{lpjDetail?.status ?? 'N/A'}</p>
                                </div>
                                <div className="grid grid-cols-[120px_auto_1fr] gap-x-1 text-sm items-start">
                                    <p>
                                        {lpjDetail?.status === 'Ditolak'
                                            ? 'Ditolak Oleh'
                                            : lpjDetail?.status === 'Divalidasi'
                                              ? 'Divalidasi Oleh'
                                              : 'Disetujui Oleh'}
                                    </p>
                                    <p className="text-left">:</p>
                                    <p className="break-words">{getDetailedApprovalStatus(lpjDetail, reviewers)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden xl:grid grid-cols-[auto_1fr] gap-x-16 text-base">
                        <p>ID</p>
                        <p>: {lpjDetail?.displayId ?? 'N/A'}</p>
                        <p>Nama Lengkap</p>
                        <p>: {lpjDetail?.user?.nama ?? 'N/A'}</p>
                        <p>Department</p>
                        <p>
                            :{' '}
                            {Array.isArray(lpjDetail?.user?.department) && lpjDetail.user.department.length > 0
                                ? lpjDetail.user.department.join(', ')
                                : ''}
                        </p>
                        <p>Unit Bisnis</p>
                        <p>: {lpjDetail?.user?.unit ?? 'N/A'}</p>
                        {lpjDetail?.kategori?.toLowerCase() === 'marketing/operasional' && (
                            <>
                                <p>Project</p>
                                <p>: {lpjDetail?.project ?? 'N/A'}</p>
                                <p>Customer</p>
                                <p>: {lpjDetail?.customer ?? 'N/A'}</p>
                                <p>Tanggal Kegiatan</p>
                                <p>: {formatDate(lpjDetail.tanggal) ?? 'N/A'}</p>
                            </>
                        )}
                        <p>Tanggal Pengajuan</p>
                        <p>: {formatDate(lpjDetail?.tanggalPengajuan) ?? 'N/A'}</p>
                    </div>
                    <div className="hidden xl:grid grid-cols-[auto_1fr] gap-x-16 text-base">
                        <p>Kategori LPJ Bon Sementara</p>
                        <p>: {lpjDetail?.kategori ?? 'N/A'}</p>
                        <p>Nomor Bon Sementara</p>
                        <p>: {lpjDetail?.nomorBS ?? 'N/A'}</p>
                        <p>Jumlah Bon Sementara</p>
                        <p>: Rp{lpjDetail?.jumlahBS.toLocaleString('id-ID') ?? 'N/A'}</p>
                        {lpjDetail?.kategori?.toLowerCase() === 'marketing/operasional' && (
                            <>
                                <p>Nomor Job Order</p>
                                <p>: {lpjDetail?.nomorJO ?? 'N/A'}</p>
                                <p>Lokasi</p>
                                <p>: {lpjDetail?.lokasi ?? 'N/A'}</p>
                            </>
                        )}
                        <p>Status</p>
                        <p>: {lpjDetail?.status ?? 'N/A'}</p>
                        <p>
                            {lpjDetail?.status === 'Ditolak'
                                ? 'Ditolak Oleh'
                                : lpjDetail?.status === 'Divalidasi'
                                  ? 'Divalidasi Oleh'
                                  : 'Disetujui Oleh'}
                        </p>
                        <p>: {getDetailedApprovalStatus(lpjDetail, reviewers)}</p>
                        <p></p>
                        <p></p>
                    </div>
                </div>

                {/* Responsive table wrapper */}
                <div className="mb-8 overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-[640px] md:w-full p-4 md:p-0">
                        <table className="w-full bg-white border rounded-lg text-sm">
                            <thead>
                                <tr className="bg-gray-100 text-left">
                                    <th className="px-4 py-2 border text-center">No.</th>
                                    <th className="px-4 py-2 border">Item</th>
                                    <th className="px-4 py-2 border">Biaya</th>
                                    <th className="px-4 py-2 border">Jumlah</th>
                                    <th className="px-4 py-2 border">Keterangan</th>
                                    <th className="px-4 py-2 border">Jumlah Biaya</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lpjDetail?.lpj?.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-2 border w-12 text-center">{index + 1}</td>
                                        <td className="px-4 py-2 border min-w-32">{item.namaItem}</td>
                                        <td className="px-4 py-2 border">Rp{item.biaya.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-2 border w-24">{item.jumlah}</td>
                                        <td className="px-4 py-2 border">{item.keterangan ?? '-'}</td>
                                        <td className="px-4 py-2 border">
                                            Rp{item.jumlahBiaya.toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="6" className="px-4 py-4"></td>
                                </tr>

                                {lpjDetail?.status === 'Dibatalkan' && (
                                    <tr>
                                        <td colSpan="6" className="px-4 py-2 text-left border">
                                            <span className="font-semibold">Alasan Pembatalan :</span>{' '}
                                            {lpjDetail?.cancelReason}
                                        </td>
                                    </tr>
                                )}

                                <tr className="font-semibold">
                                    <td colSpan="5" className="px-4 py-2 text-right border">
                                        Total Biaya :
                                    </td>
                                    <td className="px-4 py-2 border">
                                        Rp{lpjDetail?.totalBiaya?.toLocaleString('id-ID')}
                                    </td>
                                </tr>
                                <tr className="font-semibold">
                                    <td colSpan="5" className="px-4 py-2 text-right border">
                                        Sisa Lebih Bon Sementara :
                                    </td>
                                    <td className="px-4 py-2 border">
                                        Rp{lpjDetail?.sisaLebih?.toLocaleString('id-ID')}
                                    </td>
                                </tr>
                                <tr className="font-semibold">
                                    <td colSpan="5" className="px-4 py-2 text-right border">
                                        Sisa Kurang Dibayarkan ke Pegawai :
                                    </td>
                                    <td className="px-4 py-2 border">
                                        Rp{lpjDetail?.sisaKurang?.toLocaleString('id-ID')}
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
                            userData?.uid === lpjDetail?.user.uid
                                ? 'text-red-600 bg-transparent hover:text-red-800 border border-red-600 hover:border-red-800'
                                : 'text-white bg-red-600 hover:bg-red-700 hover:text-gray-200'
                        }`}
                        onClick={() => handleViewAttachment(lpjDetail?.lampiranUrl)}
                    >
                        Lihat Lampiran
                    </button>

                    {userData?.uid === lpjDetail?.user.uid && (
                        <button
                            className={`w-full md:w-auto px-16 py-3 rounded ${
                                lpjDetail?.status === 'Disetujui'
                                    ? 'text-white bg-red-600 hover:bg-red-700 hover:text-gray-200'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            }`}
                            onClick={handleGenerateAndPreviewPDF}
                            disabled={lpjDetail?.status !== 'Disetujui' || isLoading}
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

export default DetailLpj
