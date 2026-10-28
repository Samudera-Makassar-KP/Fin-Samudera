import React, { useEffect, useState, useCallback } from 'react'
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'

// Bagian CB: menu "Mutasi Dana" dihapus (user: "agak kacau prosesnya" --
// dropdown/tab periode yang berganti-ganti bikin bingung). Rekonsiliasi
// dana (Saldo Bank/Selisih/RBS-BS sudah masuk/LPJ dikembalikan/menunggu
// konfirmasi) dipindah jadi kartu di sini, SELALU untuk bulan berjalan
// (konsisten dengan kartu "Ringkasan bulan ini" yang sudah ada) -- tidak
// ada lagi pemilihan periode independen yang bisa mismatch. Tombol
// konfirmasi "Transferred" (BS/RBS) & "Kekurangan Dibayar" (LPJ) dipindah
// ke tabelnya masing-masing (BsTable.jsx/ReimbursementTable.jsx sudah ada
// sejak lama/LpjBsTable.jsx) -- halaman ini murni tampilan, tidak ada
// tombol aksi.
const HIDDEN_LPJ_STATUSES = ['Ditolak', 'Dibatalkan']

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
        nominalBsDiapprove: 0,
        // Bagian CB: rekonsiliasi dana bulan ini (sebelumnya di Mutasi Dana)
        rbsBsMasukNominal: 0,
        rbsBsMasukCount: 0,
        lpjDikembalikanNominal: 0,
        lpjDikembalikanCount: 0,
        pendingNominal: 0,
        pendingCount: 0,
        saldoSistem: 0
    })
    const [loading, setLoading] = useState(true)

    // Bagian CB: Saldo Bank diisi manual per bulan -- dipakai docId yang
    // SAMA dengan yang dulu dipakai Mutasi Dana (`mutasiDanaSaldoBank`,
    // pola `{uid}_{MM-YYYY}`), supaya nilai yang sudah pernah diisi bulan-
    // bulan sebelumnya tidak hilang & tidak perlu rule Firestore baru.
    const today = new Date()
    const periodKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
    const saldoBankDocId = uid ? `${uid}_${periodKey}` : null
    const [saldoBankInput, setSaldoBankInput] = useState('')
    const [loadingBalance, setLoadingBalance] = useState(false)
    const [savingBalance, setSavingBalance] = useState(false)

    useEffect(() => {
        if (!saldoBankDocId) return
        let cancelled = false
        setLoadingBalance(true)
        getDoc(doc(db, 'mutasiDanaSaldoBank', saldoBankDocId))
            .then((snap) => {
                if (cancelled) return
                setSaldoBankInput(snap.exists() ? String(snap.data().saldoBank ?? '') : '')
            })
            .catch((error) => console.error('Error fetching saldo bank:', error))
            .finally(() => { if (!cancelled) setLoadingBalance(false) })
        return () => { cancelled = true }
    }, [saldoBankDocId])

    const handleSaldoBankChange = (e) => {
        const digits = e.target.value.replace(/[^\d]/g, '')
        setSaldoBankInput(digits)
    }

    const handleSaldoBankBlur = useCallback(async () => {
        if (!saldoBankDocId || saldoBankInput === '') return
        setSavingBalance(true)
        try {
            await setDoc(doc(db, 'mutasiDanaSaldoBank', saldoBankDocId), {
                saldoBank: Number(saldoBankInput) || 0,
                updatedAt: new Date().toISOString()
            })
        } catch (error) {
            console.error('Error saving saldo bank:', error)
        } finally {
            setSavingBalance(false)
        }
    }, [saldoBankDocId, saldoBankInput])

    // Bagian CB: dinamakan `selisihBank` (bukan `selisih` saja) supaya tidak
    // bentrok secara nama dengan `summary.selisih` ("Selisih belum LPJ" --
    // konsep lain, tidak berhubungan dengan Saldo Bank).
    const saldoBankNumber = saldoBankInput === '' ? null : Number(saldoBankInput)
    const selisihBank = saldoBankNumber === null ? null : saldoBankNumber - summary.saldoSistem

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
                // Bagian BB: nomorBS di LPJ dulu kolom teks bebas (sudah diganti
                // dropdown, lihat FormLpjUmum.jsx/FormLpjMarketing.jsx), tapi data
                // lama tetap bisa beda spasi/kapitalisasi dari displayId BS aslinya
                // -- normalisasi supaya konsisten dengan BsTable.jsx.
                const normalizeNomorBS = (value) => (value || '').toString().trim().toUpperCase()

                // Bagian BE: SATU BS bisa punya LEBIH DARI SATU dokumen LPJ dengan
                // nomorBS yang sama (mis. LPJ pertama Dibatalkan, lalu diajukan
                // ulang) -- prioritaskan status paling relevan, bukan overwrite
                // berdasarkan urutan Firestore yang tidak dijamin. Lihat catatan
                // sama di BsTable.jsx (Bagian BE).
                const lpjStatusPriority = (status) => {
                    if (status === 'Disetujui') return 3
                    if (status === 'Dibatalkan' || status === 'Ditolak') return 1
                    return 2
                }
                const lpjTimestamp = (d) => {
                    const value = d.tanggalPengajuan || d.createdAt
                    const parsed = value ? new Date(value).getTime() : NaN
                    return isNaN(parsed) ? 0 : parsed
                }

                const lpjByNomorBS = {}
                lpjSnapshot.docs.forEach((docSnap) => {
                    const lpjData = docSnap.data()
                    const key = normalizeNomorBS(lpjData.nomorBS)
                    if (!key) return
                    const existing = lpjByNomorBS[key]
                    if (!existing) {
                        lpjByNomorBS[key] = lpjData
                        return
                    }
                    const newPriority = lpjStatusPriority(lpjData.status)
                    const existingPriority = lpjStatusPriority(existing.status)
                    if (newPriority > existingPriority) {
                        lpjByNomorBS[key] = lpjData
                    } else if (newPriority === existingPriority && lpjTimestamp(lpjData) > lpjTimestamp(existing)) {
                        lpjByNomorBS[key] = lpjData
                    }
                })

                let totalSudahLpj = 0
                let jumlahBsSudahLpj = 0
                for (const bs of bsDisetujui) {
                    if (!bs.displayId) continue
                    const lpjData = lpjByNomorBS[normalizeNomorBS(bs.displayId)]
                    if (lpjData && lpjData.status === 'Disetujui') {
                        totalSudahLpj += bs.bonSementara?.[0]?.jumlahBS || 0
                        jumlahBsSudahLpj += 1
                    }
                }
                const jumlahBsBelumLpj = bsDisetujui.length - jumlahBsSudahLpj

                // Bagian CB: rekonsiliasi dana bulan ini (sebelumnya di Mutasi Dana) --
                // hanya uang yang BENAR-BENAR sudah berpindah yang dihitung, sama
                // seperti prinsip Mutasi Dana Bagian BU: BS/RBS Disetujui tapi belum
                // "Transferred" belum dihitung masuk; LPJ sisaLebih yang belum
                // dikembalikan/terverifikasi & sisaKurang yang belum dibayar juga
                // belum dihitung -- semuanya masuk "Menunggu Konfirmasi" dulu.
                const lpjAll = lpjSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
                const lpjThisMonth = lpjAll.filter(
                    (item) => isThisMonth(item.tanggalPengajuan) && !HIDDEN_LPJ_STATUSES.includes(item.status)
                )

                const bsTransferredThisMonth = bsDisetujui.filter((item) => item.transferred)
                const rbsDisetujuiThisMonth = rbsThisMonth.filter((item) => item.status === 'Disetujui')
                const rbsTransferredThisMonth = rbsDisetujuiThisMonth.filter((item) => item.transferred)
                const rbsBsMasukNominal =
                    bsTransferredThisMonth.reduce((sum, item) => sum + (item.bonSementara?.[0]?.jumlahBS || 0), 0) +
                    rbsTransferredThisMonth.reduce((sum, item) => sum + (item.totalBiaya || 0), 0)
                const rbsBsMasukCount = bsTransferredThisMonth.length + rbsTransferredThisMonth.length

                const lpjSisaKurangThisMonth = lpjThisMonth.filter((item) => (Number(item.sisaKurang) || 0) > 0)
                const lpjKekuranganDibayar = lpjSisaKurangThisMonth.filter((item) => item.sisaKurangDibayar)
                const lpjSisaLebihThisMonth = lpjThisMonth.filter((item) => (Number(item.sisaLebih) || 0) > 0)
                const lpjSudahDikembalikan = lpjSisaLebihThisMonth.filter(
                    (item) => item.pengembalianStatus === 'valid' || item.pengembalianStatus === 'grandfathered'
                )
                const lpjDikembalikanNominal =
                    lpjKekuranganDibayar.reduce((sum, item) => sum + (Number(item.sisaKurang) || 0), 0) +
                    lpjSudahDikembalikan.reduce((sum, item) => sum + (Number(item.sisaLebih) || 0), 0)
                const lpjDikembalikanCount = lpjKekuranganDibayar.length + lpjSudahDikembalikan.length

                const bsBelumTransfer = bsDisetujui.filter((item) => !item.transferred)
                const rbsBelumTransfer = rbsDisetujuiThisMonth.filter((item) => !item.transferred)
                const lpjSisaKurangBelumDibayar = lpjSisaKurangThisMonth.filter((item) => !item.sisaKurangDibayar)
                const lpjSisaLebihBelumKembali = lpjSisaLebihThisMonth.filter(
                    (item) => !(item.pengembalianStatus === 'valid' || item.pengembalianStatus === 'grandfathered')
                )
                const pendingNominal =
                    bsBelumTransfer.reduce((sum, item) => sum + (item.bonSementara?.[0]?.jumlahBS || 0), 0) +
                    rbsBelumTransfer.reduce((sum, item) => sum + (item.totalBiaya || 0), 0) +
                    lpjSisaKurangBelumDibayar.reduce((sum, item) => sum + (Number(item.sisaKurang) || 0), 0) +
                    lpjSisaLebihBelumKembali.reduce((sum, item) => sum + (Number(item.sisaLebih) || 0), 0)
                const pendingCount = bsBelumTransfer.length + rbsBelumTransfer.length + lpjSisaKurangBelumDibayar.length + lpjSisaLebihBelumKembali.length

                // Saldo Sistem = uang masuk terkonfirmasi (BS/RBS Transferred + sisaKurang
                // yang sudah dibayar) dikurangi uang keluar (total biaya LPJ bulan ini +
                // sisaLebih yang sudah dikembalikan).
                const lpjTotalBiayaThisMonth = lpjThisMonth.reduce((sum, item) => sum + (item.totalBiaya || 0), 0)
                const saldoSistem =
                    rbsBsMasukNominal +
                    lpjKekuranganDibayar.reduce((sum, item) => sum + (Number(item.sisaKurang) || 0), 0) -
                    lpjTotalBiayaThisMonth -
                    lpjSudahDikembalikan.reduce((sum, item) => sum + (Number(item.sisaLebih) || 0), 0)

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
                    nominalBsDiapprove,
                    rbsBsMasukNominal,
                    rbsBsMasukCount,
                    lpjDikembalikanNominal,
                    lpjDikembalikanCount,
                    pendingNominal,
                    pendingCount,
                    saldoSistem
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
            valueClass: 'text-gray-900 dark:text-gray-100',
            bgClass: 'bg-gray-50 dark:bg-gray-700/50'
        },
        {
            label: 'Jumlah RBS bulan ini',
            value: formatRupiah(summary.nominalRbs),
            caption: `${summary.jumlahRbs} pengajuan`,
            valueClass: 'text-gray-900 dark:text-gray-100',
            bgClass: 'bg-gray-50 dark:bg-gray-700/50'
        },
        {
            label: 'Sudah di-LPJ-kan',
            value: formatRupiah(summary.totalSudahLpj),
            caption: `${summary.jumlahBsSudahLpj} BS selesai LPJ`,
            valueClass: 'text-green-700 dark:text-green-400',
            bgClass: 'bg-green-50 dark:bg-green-900/20'
        },
        {
            label: 'Selisih belum LPJ',
            value: formatRupiah(summary.selisih),
            caption:
                summary.jumlahBsBelumLpj > 0
                    ? `${summary.jumlahBsBelumLpj} BS belum dipertanggungjawabkan`
                    : 'Semua BS sudah dipertanggungjawabkan',
            valueClass: summary.selisih > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100',
            bgClass: summary.selisih > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
        },
        // Bagian CB: rekonsiliasi dana (sebelumnya di Mutasi Dana, sekarang
        // kartu di sini -- selalu bulan berjalan).
        {
            label: 'RBS/BS Sudah Masuk',
            value: formatRupiah(summary.rbsBsMasukNominal),
            caption: `${summary.rbsBsMasukCount} transaksi -- sudah "Transferred"`,
            valueClass: 'text-green-700 dark:text-green-400',
            bgClass: 'bg-green-50 dark:bg-green-900/20'
        },
        {
            label: 'LPJ Dikembalikan/Dibayar',
            value: formatRupiah(summary.lpjDikembalikanNominal),
            caption: `${summary.lpjDikembalikanCount} LPJ -- sisa lebih dikembalikan / kekurangan dibayar`,
            valueClass: 'text-green-700 dark:text-green-400',
            bgClass: 'bg-green-50 dark:bg-green-900/20'
        },
        {
            label: 'Menunggu Konfirmasi',
            value: formatRupiah(summary.pendingNominal),
            caption:
                summary.pendingCount > 0
                    ? `${summary.pendingCount} transaksi -- BS/RBS belum masuk atau LPJ belum dikembalikan/dibayar`
                    : 'Semua transaksi bulan ini sudah dikonfirmasi',
            valueClass: summary.pendingCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100',
            bgClass: summary.pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
        },
        ...(isApprover
            ? [
                {
                    label: `LPJ ${approverLabel} bulan ini`,
                    value: formatRupiah(summary.nominalLpjDiproses),
                    caption: `${summary.jumlahLpjDiproses} LPJ`,
                    valueClass: 'text-blue-700 dark:text-blue-400',
                    bgClass: 'bg-blue-50 dark:bg-blue-900/20'
                },
                {
                    label: `RBS ${approverLabel} bulan ini`,
                    value: formatRupiah(summary.nominalRbsDiproses),
                    caption: `${summary.jumlahRbsDiproses} RBS`,
                    valueClass: 'text-blue-700 dark:text-blue-400',
                    bgClass: 'bg-blue-50 dark:bg-blue-900/20'
                }
            ]
            : []),
        ...(isReviewer
            ? [
                {
                    label: 'BS di-approve bulan ini',
                    value: formatRupiah(summary.nominalBsDiapprove),
                    caption: `${summary.jumlahBsDiapprove} BS`,
                    valueClass: 'text-blue-700 dark:text-blue-400',
                    bgClass: 'bg-blue-50 dark:bg-blue-900/20'
                }
            ]
            : [])
    ]

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg mb-6 shadow-sm transition-colors">
            <h3 className="text-xl font-medium mb-4 dark:text-gray-100">
                Ringkasan bulan ini
                {isApprover && (
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">
                        (termasuk {isValidator ? 'validasi' : 'review'} Anda sebagai {role})
                    </span>
                )}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <div key={card.label} className={`rounded-lg p-4 ${card.bgClass}`}>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{card.label}</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        ) : (
                            <>
                                <p className={`text-2xl font-semibold ${card.valueClass}`}>{card.value}</p>
                                {card.caption && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.caption}</p>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Bagian CB: Saldo Bank (isi manual) & Selisih -- sebelumnya di
                Mutasi Dana, sekarang di sini, selalu untuk bulan berjalan. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Saldo Bank <span className="text-xs">(isi manual)</span>
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg text-gray-400 dark:text-gray-500 font-semibold">Rp</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={saldoBankInput === '' ? '' : Number(saldoBankInput).toLocaleString('id-ID')}
                            onChange={handleSaldoBankChange}
                            onBlur={handleSaldoBankBlur}
                            placeholder={loadingBalance ? '...' : '0'}
                            disabled={loadingBalance}
                            className="text-2xl font-semibold bg-transparent outline-none w-full dark:text-gray-100 tabular-nums focus:text-blue-600 dark:focus:text-blue-400 disabled:opacity-50"
                        />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {loadingBalance ? 'Memuat...' : savingBalance ? 'Menyimpan...' : 'Cek dari mutasi rekening, lalu ketik di sini'}
                    </p>
                </div>
                <div className={`rounded-lg p-4 ${selisihBank === null ? 'bg-gray-50 dark:bg-gray-700/50' : selisihBank === 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Selisih (Bank vs Sistem)</p>
                    <p className={`text-2xl font-semibold ${selisihBank === null ? 'text-gray-900 dark:text-gray-100' : selisihBank === 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {selisihBank === null ? '-' : formatRupiah(selisihBank)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {selisihBank === null
                            ? 'Isi Saldo Bank dulu'
                            : selisihBank === 0
                                ? 'Saldo sistem & bank sudah sama'
                                : selisihBank > 0 ? 'Bank lebih besar dari sistem' : 'Sistem lebih besar dari bank'}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default DashboardSummary