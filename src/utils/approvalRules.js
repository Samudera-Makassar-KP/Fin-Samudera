// Bagian BO: aturan transisi approve/tolak untuk BS, RBS, dan LPJ -- dulu
// tersalin tiga kali (BsCheck.jsx, ReimbursementCheck.jsx, LpjBsCheck.jsx),
// sekarang satu sumber supaya tombol approval di halaman Detail memakai
// aturan yang PERSIS sama dengan halaman Cek Pengajuan. Modul ini murni (tanpa
// Firebase) supaya bisa dites langsung; eksekusinya ada di approvalWorkflow.js.
//
// Alur:
//  - BS (2 tahap)      : Diajukan -(Reviewer 1)-> Diproses -(Reviewer 2)-> Disetujui
//  - RBS & LPJ (3 tahap): Diajukan -(Validator)-> Divalidasi -(Reviewer 1)-> Diproses
//                         -(Reviewer 2)-> Disetujui. Validator yang sekaligus
//                         Reviewer 1 melompat langsung Diajukan -> Diproses.
// Super Admin bisa menggantikan approver di tahap mana pun.

export const WORKFLOW_TYPES = {
    bs: {
        collection: 'bonSementara',
        label: 'Bon Sementara',
        hasValidator: false,
        listPath: '/bon-sementara/cek-pengajuan'
    },
    rbs: {
        collection: 'reimbursement',
        label: 'Reimbursement',
        hasValidator: true,
        listPath: '/reimbursement/cek-pengajuan'
    },
    lpj: {
        collection: 'lpj',
        label: 'LPJ Bon Sementara',
        hasValidator: true,
        listPath: '/lpj/cek-pengajuan'
    }
}

const DEFAULT_REASON = 'Alasan tidak diberikan'

const getRoles = (item, uid, role) => {
    const user = item?.user || {}
    const includes = (field) => Array.isArray(user[field]) && user[field].includes(uid)
    return {
        isSuperAdmin: role === 'Super Admin',
        isValidator: includes('validator'),
        isReviewer1: includes('reviewer1'),
        isReviewer2: includes('reviewer2')
    }
}

const reviewer1Done = (item) =>
    item?.approvedByReviewer1Status === 'reviewer' || item?.approvedByReviewer1Status === 'superadmin'

const getWorkflow = (docType) => {
    const workflow = WORKFLOW_TYPES[docType]
    if (!workflow) throw new Error(`Jenis dokumen tidak dikenali: ${docType}`)
    return workflow
}

const approval = (status, historyStatus, fields, uid, now) => ({
    updateData: { status, ...fields },
    historyEntry: { status: historyStatus, timestamp: now, actor: uid }
})

// Mengembalikan { updateData, historyEntry } kalau user ini boleh menyetujui
// dokumen pada status saat ini, atau null kalau tidak (dipakai juga untuk
// memutuskan apakah tombol Setujui/Tolak ditampilkan di halaman Detail).
export const buildApprovalUpdate = (docType, item, uid, role, now = new Date().toISOString()) => {
    const workflow = getWorkflow(docType)
    if (!item || !uid) return null
    const { isSuperAdmin, isValidator, isReviewer1, isReviewer2 } = getRoles(item, uid, role)
    const status = item.status

    if (!workflow.hasValidator) {
        if (isSuperAdmin) {
            if (status === 'Diajukan') {
                return approval('Diproses', 'Disetujui oleh Super Admin (Pengganti Reviewer 1)', {
                    approvedByReviewer1Status: 'superadmin',
                    approvedBySuperAdmin: true
                }, uid, now)
            }
            if (status === 'Diproses') {
                return approval('Disetujui', 'Disetujui oleh Super Admin (Pengganti Reviewer 2)', {
                    approvedByReviewer2Status: 'superadmin',
                    approvedBySuperAdmin: true
                }, uid, now)
            }
            return null
        }
        if (status === 'Diajukan' && isReviewer1) {
            return approval('Diproses', 'Disetujui oleh Reviewer 1', {
                approvedByReviewer1: true,
                approvedByReviewer1Status: 'reviewer'
            }, uid, now)
        }
        if (status === 'Diproses' && isReviewer2 && reviewer1Done(item)) {
            return approval('Disetujui', 'Disetujui oleh Reviewer 2', {
                approvedByReviewer2: true,
                approvedByReviewer2Status: 'reviewer'
            }, uid, now)
        }
        return null
    }

    if (isSuperAdmin) {
        if (status === 'Diajukan') {
            return approval('Divalidasi', 'Disetujui oleh Super Admin (Pengganti Validator)', {
                approvedByValidator: false,
                approvedBySuperAdmin: true
            }, uid, now)
        }
        if (status === 'Divalidasi') {
            return approval('Diproses', 'Disetujui oleh Super Admin (Pengganti Reviewer 1)', {
                approvedByReviewer1Status: 'superadmin',
                approvedBySuperAdmin: true
            }, uid, now)
        }
        if (status === 'Diproses') {
            return approval('Disetujui', 'Disetujui oleh Super Admin (Pengganti Reviewer 2)', {
                approvedByReviewer2Status: 'superadmin',
                approvedBySuperAdmin: true
            }, uid, now)
        }
        return null
    }

    if (status === 'Diajukan') {
        if (isValidator && isReviewer1) {
            return approval('Diproses', 'Disetujui oleh Reviewer 1 Sekaligus Validator', {
                approvedByValidator: true,
                approvedByReviewer1: true,
                approvedByReviewer1Status: 'reviewer'
            }, uid, now)
        }
        if (isValidator) {
            return approval('Divalidasi', 'Disetujui oleh Validator', {
                approvedByValidator: true
            }, uid, now)
        }
        return null
    }
    if (status === 'Divalidasi' && isReviewer1) {
        return approval('Diproses', 'Disetujui oleh Reviewer 1', {
            approvedByReviewer1: true,
            approvedByReviewer1Status: 'reviewer'
        }, uid, now)
    }
    if (status === 'Diproses' && isReviewer2 && reviewer1Done(item)) {
        return approval('Disetujui', 'Disetujui oleh Reviewer 2', {
            approvedByReviewer2: true,
            approvedByReviewer2Status: 'reviewer'
        }, uid, now)
    }
    return null
}

const rejection = (historyStatus, fields, uid, reason, now) => {
    const finalReason = reason || DEFAULT_REASON
    return {
        updateData: { status: 'Ditolak', ...fields, rejectReason: finalReason },
        historyEntry: { status: historyStatus, timestamp: now, actor: uid, reason: finalReason }
    }
}

// Mengembalikan { updateData, historyEntry }, atau melempar Error kalau user
// tidak berhak menolak dokumen ini pada status saat ini (pesan error-nya
// ditampilkan apa adanya ke user).
export const buildRejectionUpdate = (docType, item, uid, role, reason, now = new Date().toISOString()) => {
    const workflow = getWorkflow(docType)
    const { isSuperAdmin, isValidator, isReviewer1, isReviewer2 } = getRoles(item, uid, role)
    const status = item?.status
    const noAccess = new Error(`Anda tidak memiliki akses untuk menolak ${workflow.label} ini.`)
    const wrongStatus = new Error(`${workflow.label} ini tidak bisa ditolak pada status saat ini.`)

    if (!workflow.hasValidator) {
        // BS: dicabangkan dari approvedByReviewer1Status (bukan status), sama
        // persis dengan perilaku BsCheck.jsx sebelum dipindah ke sini.
        if (isSuperAdmin) {
            if (!item.approvedByReviewer1Status) {
                return rejection('Ditolak oleh Super Admin (Pengganti Reviewer 1)', {
                    approvedByReviewer1Status: 'superadmin',
                    rejectedBySuperAdmin: true
                }, uid, reason, now)
            }
            if (reviewer1Done(item)) {
                return rejection('Ditolak oleh Super Admin (Pengganti Reviewer 2)', {
                    approvedByReviewer2Status: 'superadmin',
                    rejectedBySuperAdmin: true
                }, uid, reason, now)
            }
            throw wrongStatus
        }
        if (isReviewer1) {
            return rejection('Ditolak oleh Reviewer 1', { approvedByReviewer1Status: 'reviewer' }, uid, reason, now)
        }
        if (isReviewer2 && reviewer1Done(item)) {
            return rejection('Ditolak oleh Reviewer 2', {}, uid, reason, now)
        }
        throw noAccess
    }

    // RBS/LPJ: dicabangkan dari STATUS saat ini -- lihat catatan panjang di
    // riwayat ReimbursementCheck.jsx (approvedBy*Status tidak pernah diisi saat
    // approve normal, jadi tidak bisa dipakai untuk menentukan tahap).
    if (isSuperAdmin) {
        if (status === 'Diajukan') {
            return rejection('Ditolak oleh Super Admin (Pengganti Validator)', {
                approvedByValidatorStatus: 'superadmin',
                rejectedBySuperAdmin: true
            }, uid, reason, now)
        }
        if (status === 'Divalidasi') {
            return rejection('Ditolak oleh Super Admin (Pengganti Reviewer 1)', {
                approvedByReviewer1Status: 'superadmin',
                rejectedBySuperAdmin: true
            }, uid, reason, now)
        }
        if (status === 'Diproses') {
            return rejection('Ditolak oleh Super Admin (Pengganti Reviewer 2)', {
                approvedByReviewer2Status: 'superadmin',
                rejectedBySuperAdmin: true
            }, uid, reason, now)
        }
        throw wrongStatus
    }
    if (status === 'Diajukan') {
        if (isValidator && isReviewer1) {
            return rejection('Ditolak oleh Reviewer 1', {
                approvedByValidatorStatus: 'validator',
                approvedByReviewer1Status: 'reviewer'
            }, uid, reason, now)
        }
        if (isValidator) {
            return rejection('Ditolak oleh Validator', { approvedByValidatorStatus: 'validator' }, uid, reason, now)
        }
        throw noAccess
    }
    if (status === 'Divalidasi') {
        if (isReviewer1) {
            return rejection('Ditolak oleh Reviewer 1', { approvedByReviewer1Status: 'reviewer' }, uid, reason, now)
        }
        throw noAccess
    }
    if (status === 'Diproses') {
        if (isReviewer2) {
            return rejection('Ditolak oleh Reviewer 2', {}, uid, reason, now)
        }
        throw noAccess
    }
    throw wrongStatus
}

// Tombol Setujui/Tolak di Detail cuma tampil untuk approver yang memang sedang
// ditunggu pada tahap ini.
export const canActOnApproval = (docType, item, uid, role) =>
    buildApprovalUpdate(docType, item, uid, role, '') !== null
