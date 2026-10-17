import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import Modal from './Modal'
import { WORKFLOW_TYPES, canActOnApproval } from '../utils/approvalRules'
import { approveWorkflowDoc, rejectWorkflowDoc } from '../utils/approvalWorkflow'

// Bagian BO: tujuan "kembali" dari halaman Detail. Kalau Detail dibuka dari
// halaman Cek Pengajuan, Link-nya membawa state { from, tab } -- kembali ke
// daftar itu dengan tab yang sama. Kalau dibuka dari tempat lain (tabel milik
// sendiri, dashboard), cukup mundur satu langkah di riwayat browser; dan kalau
// halaman dibuka langsung (mis. dari link email, tidak ada riwayat), ke
// Dashboard.
const useBackToOrigin = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const from = location.state?.from
    const tab = location.state?.tab

    return (fallbackPath) => {
        if (from) {
            navigate(from, { state: { tab } })
        } else if (fallbackPath) {
            navigate(fallbackPath)
        } else if (window.history.state?.idx > 0) {
            navigate(-1)
        } else {
            navigate('/dashboard')
        }
    }
}

export const DetailBackButton = () => {
    const goBack = useBackToOrigin()

    return (
        <button
            type="button"
            onClick={() => goBack()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 mb-3"
        >
            <FontAwesomeIcon icon={faArrowLeft} />
            Kembali
        </button>
    )
}

// Tombol Setujui/Tolak di halaman Detail -- cuma muncul untuk approver yang
// sedang ditunggu pada tahap ini (atau Super Admin), memakai aturan yang sama
// persis dengan halaman Cek Pengajuan (utils/approvalRules.js). Setelah
// berhasil, user dibawa kembali ke daftar Cek Pengajuan.
export const DetailApprovalActions = ({ docType, item }) => {
    const goBack = useBackToOrigin()
    const [showApproveModal, setShowApproveModal] = useState(false)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectReason, setRejectReason] = useState('')

    const uid = localStorage.getItem('userUid')
    const role = localStorage.getItem('userRole')
    const workflow = WORKFLOW_TYPES[docType]

    if (!item?.id || !canActOnApproval(docType, item, uid, role)) return null

    const handleApprove = async () => {
        try {
            const result = await approveWorkflowDoc(docType, item)
            if (!result) {
                toast.error('Anda tidak berhak menyetujui dokumen ini pada tahap saat ini.')
                return
            }
            toast.success(`${workflow.label} berhasil disetujui`)
            if (result.notifyError) {
                toast.warning('Disetujui, tapi email ke Finance (form + lampiran) gagal terkirim. Coba cetak & kirim manual.')
            }
            setShowApproveModal(false)
            goBack(workflow.listPath)
        } catch (error) {
            console.error(`Error approving ${docType}:`, error?.code, error?.message, error)
            toast.error(`Gagal menyetujui ${workflow.label}`)
        }
    }

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.warning('Harap isi alasan penolakan terlebih dahulu!')
            return
        }
        try {
            await rejectWorkflowDoc(docType, item, rejectReason.trim())
            toast.success(`${workflow.label} berhasil ditolak`)
            setShowRejectModal(false)
            goBack(workflow.listPath)
        } catch (error) {
            console.error(`Error rejecting ${docType}:`, error?.code, error?.message, error)
            toast.error(error?.message?.includes('tidak') ? error.message : `Gagal menolak ${workflow.label}`)
        }
    }

    return (
        <>
            <button
                type="button"
                className="w-full md:w-auto px-12 py-3 rounded text-red-600 bg-transparent hover:text-red-800 border border-red-600 hover:border-red-800"
                onClick={() => setShowRejectModal(true)}
            >
                Tolak
            </button>
            <button
                type="button"
                className="w-full md:w-auto px-12 py-3 rounded text-white bg-green-600 hover:bg-green-700"
                onClick={() => setShowApproveModal(true)}
            >
                Setujui
            </button>

            <Modal
                showModal={showApproveModal}
                title="Konfirmasi Approve"
                message={`Apakah Anda yakin ingin menyetujui ${workflow.label} dengan Nomor ${item.displayId}?`}
                onClose={() => setShowApproveModal(false)}
                onConfirm={handleApprove}
                cancelText="Batal"
                confirmText="Setujui"
            />
            <Modal
                showModal={showRejectModal}
                title="Konfirmasi Penolakan"
                message={`Tolak ${workflow.label} dengan Nomor ${item.displayId}?`}
                onClose={() => {
                    setShowRejectModal(false)
                    setRejectReason('')
                }}
                onConfirm={handleReject}
                cancelText="Batal"
                confirmText="Tolak"
                showCancelReason={true}
                cancelReason={rejectReason}
                setCancelReason={setRejectReason}
                reasonLabel="Alasan Penolakan"
                reasonPlaceholder="Masukkan alasan penolakan..."
            />
        </>
    )
}
