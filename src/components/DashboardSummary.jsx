import React, { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebaseConfig'

const DashboardSummary = ({ uid, role }) => {
    const [summary, setSummary] = useState({
        jumlahBS: 0,
        nominalBS: 0,
        jumlahRbs: 0,
        nominalRbs: 0,
        totalSudahLpj: 0,
        jumlahBsSudahLpj: 0,
        jumlahBsBelumLpj: 0,
        selisih: 0,
        jumlahLpjDiproses: 0,
        nominalLpjDiproses: 0,
        jumlahRbsDiproses: 0,
        nominalRbsDiproses: 0,
        jumlahBsDiapprove: 0,
        nominalBsDiapprove: 0
    })
    const [loading, setLoading] = useState(true)

    const isValidator = role === 'Validator'
    const isReviewer = role === 'Reviewer'
    const isApprover = isValidator || isReviewer

    useEffect(() => {
        const fetchSummary = async () => {
            if (!uid) {
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                const today = new Date()
                const currentMonth = today.getMonth()
                const currentYear = today.getFullYear()

                const isThisMonth = (dateString) => {
                    if (!dateString) return false
                    const d = new Date(dateString)
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
                }

                // Bon Sementara milik user, difilter ke bulan berjalan
                const bsSnapshot = await getDocs(
                    query(collection(db, 'bonSementara'), where('user.uid', '==', uid))
                )
                const bsAll = bsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                const bsThisMonth = bsAll.filter((item) => isThisMonth(item.tanggalPengajuan))
                const totalNominalBS = bsThisMonth.reduce(
                    (sum, item) => sum + (item.bonSementara?.[0]?.jumlahBS || 0),
                    0
                )

                // Reimbursement milik user, difilter ke bulan berjalan
                const rbsSnapshot = await getDocs(
                    query(collection(db, 'reimbursement'), where('user.uid', '==', uid))
                )
                const rbsAll = rbsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                const rbsThisMonth = rbsAll.filter((item) => isThisMonth(item.tanggalPengajuan))
                const totalNominalRbs = rbsThisMonth.reduce(
                    (sum, item) => sum + (item.totalBiaya || 0),
                    0
                )

                // Dari BS bulan ini, ambil yang sudah Disetujui (uang sudah cair)
                const bsDisetujui = bsThisMonth.filter((item) => item.status === 'Disetujui')
                const totalDisetujui = bsDisetujui.reduce(
                    (sum, item) => sum + (item.bonSementara?.[0]?.jumlahBS || 0),
                    0
                )

                // Cek status LPJ untuk tiap BS yang sudah disetujui.
                // Ambil SEMUA lpj milik user sekali saja (query ini provable oleh Security Rules
                // karena difilter user.uid, sama seperti query bonSementara/reimbursement),
                // lalu cocokkan nomorBS-nya di JS - lebih hemat dan tidak kena permission-denied.
                const lpjSnapshot = await getDocs(
                    query(collection(db, 'lpj'), where('user.uid', '==', uid))
                )
                const lpjByNomorBS = {}
                lpjSnapshot.docs.forEach((docSnap) => {
                    const lpjData = docSnap.data()
                    if (lpjData.nomorBS) {
                        lpjByNomorBS[lpjData.nomorBS] = lpjData
                    }
                })

                let totalSudahLpj = 0
                let jumlahBsSudahLpj = 0
                for (const bs of bsDisetujui) {
                    if (!bs.displayId) continue
                    const lpjData = lpjByNomorBS[bs.displayId]
                    if (lpjData && lpjData.status === 'Disetujui') {
                        totalSudahLpj += bs.bonSementara?.[0]?.jumlahBS || 0
                        jumlahBsSudahLpj += 1
                    }
                }
                const jumlahBsBelumLpj = bsDisetujui.length - jumlahBsSudahLpj

                // Khusus role Validator/Reviewer: hitung LPJ & RBS yang sudah mereka
                // validasi/review bulan ini, beserta nominalnya. Query pakai array-contains
                // pada user.validator / user.reviewer1 / user.reviewer2 - ini bisa dibuktikan
                // Firestore Security Rules (sesuai isWorkflowApprover di rules Anda), berbeda
                // dengan query nomorBS tanpa filter kepemilikan yang selalu ditolak.
                let jumlahLpjDiproses = 0
                let nominalLpjDiproses = 0
                let jumlahRbsDiproses = 0
                let nominalRbsDiproses = 0
                let jumlahBsDiapprove = 0
                let nominalBsDiapprove = 0

                if (isApprover) {
                    const fetchAssignedThisMonth = async (collectionName, amountField) => {
                        let docs = []

                        if (isValidator) {
                            const snap = await getDocs(
                                query(collection(db, collectionName), where('user.validator', 'array-contains', uid))
                            )
                            docs = snap.docs
                                .map((d) => d.data())
                                .filter((item) => isThisMonth(item.tanggalPengajuan) && item.approvedByValidator === true)
                        } else {
                            // Reviewer bisa berada di slot reviewer1 atau reviewer2
                            const [snap1, snap2] = await Promise.all([
                                getDocs(query(collection(db, collectionName), where('user.reviewer1', 'array-contains', uid))),
                                getDocs(query(collection(db, collectionName), where('user.reviewer2', 'array-contains', uid)))
                            ])
                            const fromReviewer1 = snap1.docs
                                .map((d) => d.data())
                                .filter((item) => isThisMonth(item.tanggalPengajuan) && item.approvedByReviewer1 === true)
                            const fromReviewer2 = snap2.docs
                                .map((d) => d.data())
                                .filter((item) => isThisMonth(item.tanggalPengajuan) && item.approvedByReviewer2 === true)
                            // Gabungkan tanpa duplikat (jarang terjadi, tapi jaga-jaga)
                            const seen = new Set()
                            docs = [...fromReviewer1, ...fromReviewer2].filter((item) => {
                                if (seen.has(item.displayId)) return false
                                seen.add(item.displayId)
                                return true
                            })
                        }

                        const nominal = docs.reduce((sum, item) => sum + (amountField(item) || 0), 0)
                        return { count: docs.length, nominal }
                    }

                    const [lpjResult, rbsResult] = await Promise.all([
                        fetchAssignedThisMonth('lpj', (item) => item.bonSementara?.[0]?.jumlahBS),
                        fetchAssignedThisMonth('reimbursement', (item) => item.totalBiaya)
                    ])

                    jumlahLpjDiproses = lpjResult.count
                    nominalLpjDiproses = lpjResult.nominal
                    jumlahRbsDiproses = rbsResult.count
                    nominalRbsDiproses = rbsResult.nominal

                    // Khusus Reviewer: tambahan BS (Bon Sementara) yang mereka approve bulan ini
                    if (isReviewer) {
                        const bsResult = await fetchAssignedThisMonth(
                            'bonSementara',
                            (item) => item.bonSementara?.[0]?.jumlahBS
                        )
                        jumlahBsDiapprove = bsResult.count
                        nominalBsDiapprove = bsResult.nominal
                    }
                }

                setSummary({
                    jumlahBS: bsThisMonth.length,
                    nominalBS: totalNominalBS,
                    jumlahRbs: rbsThisMonth.length,
                    nominalRbs: totalNominalRbs,
                    totalSudahLpj,
                    jumlahBsSudahLpj,
                    jumlahBsBelumLpj,
                    selisih: totalDisetujui - totalSudahLpj,
                    jumlahLpjDiproses,
                    nominalLpjDiproses,
                    jumlahRbsDiproses,
                    nominalRbsDiproses,
                    jumlahBsDiapprove,
                    nominalBsDiapprove
                })
            } catch (error) {
                console.error('Error fetching dashboard summary:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSummary()
    }, [uid, role, isApprover, isReviewer, isValidator])

    const formatRupiah = (value) => `Rp${(value || 0).toLocaleString('id-ID')}`

    const approverLabel = isValidator ? 'divalidasi' : 'direview'

    const cards = [
        {
            label: 'Jumlah BS bulan ini',
            value: formatRupiah(summary.nominalBS),
            caption: `${summary.jumlahBS} pengajuan`,
            valueClass: 'text-gray-900',
            bgClass: 'bg-gray-50'
        },
        {
            label: 'Jumlah RBS bulan ini',
            value: formatRupiah(summary.nominalRbs),
            caption: `${summary.jumlahRbs} pengajuan`,
            valueClass: 'text-gray-900',
            bgClass: 'bg-gray-50'
        },
        {
            label: 'Sudah di-LPJ-kan',
            value: formatRupiah(summary.totalSudahLpj),
            caption: `${summary.jumlahBsSudahLpj} BS selesai LPJ`,
            valueClass: 'text-green-700',
            bgClass: 'bg-green-50'
        },
        {
            label: 'Selisih belum LPJ',
            value: formatRupiah(summary.selisih),
            caption:
                summary.jumlahBsBelumLpj > 0
                    ? `${summary.jumlahBsBelumLpj} BS belum dipertanggungjawabkan`
                    : 'Semua BS sudah dipertanggungjawabkan',
            valueClass: summary.selisih > 0 ? 'text-amber-700' : 'text-gray-900',
            bgClass: summary.selisih > 0 ? 'bg-amber-50' : 'bg-gray-50'
        },
        ...(isApprover
            ? [
                {
                    label: `LPJ ${approverLabel} bulan ini`,
                    value: formatRupiah(summary.nominalLpjDiproses),
                    caption: `${summary.jumlahLpjDiproses} LPJ`,
                    valueClass: 'text-blue-700',
                    bgClass: 'bg-blue-50'
                },
                {
                    label: `RBS ${approverLabel} bulan ini`,
                    value: formatRupiah(summary.nominalRbsDiproses),
                    caption: `${summary.jumlahRbsDiproses} RBS`,
                    valueClass: 'text-blue-700',
                    bgClass: 'bg-blue-50'
                }
            ]
            : []),
        ...(isReviewer
            ? [
                {
                    label: 'BS di-approve bulan ini',
                    value: formatRupiah(summary.nominalBsDiapprove),
                    caption: `${summary.jumlahBsDiapprove} BS`,
                    valueClass: 'text-blue-700',
                    bgClass: 'bg-blue-50'
                }
            ]
            : [])
    ]

    return (
        <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
            <h3 className="text-xl font-medium mb-4">
                Ringkasan bulan ini
                {isApprover && (
                    <span className="text-sm font-normal text-gray-400 ml-2">
                        (termasuk {isValidator ? 'validasi' : 'review'} Anda sebagai {role})
                    </span>
                )}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <div key={card.label} className={`rounded-lg p-4 ${card.bgClass}`}>
                        <p className="text-sm text-gray-500 mb-2">{card.label}</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
                        ) : (
                            <>
                                <p className={`text-2xl font-semibold ${card.valueClass}`}>{card.value}</p>
                                {card.caption && (
                                    <p className="text-xs text-gray-400 mt-1">{card.caption}</p>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default DashboardSummary