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
//
// Bagian CH: koreksi dari user -- nota Catat Nota yang sudah dicatat
// (belum dirangkai jadi LPJ sungguhan) HARUS ikut mengurangi sisa dana BS &
// Saldo Sistem, supaya "selisih" terlihat begitu nota dicatat, bukan nunggu
// sampai benar-benar disubmit. Juga: LPJ yang BARU dilaporkan bulan ini
// untuk BS dari bulan SEBELUMNYA dipisah ke kartu sendiri, tidak lagi
// bercampur dengan angka "bulan ini" (yang basis-nya tanggal BS, bukan
// tanggal LPJ).
const HIDDEN_LPJ_STATUSES = ['Ditolak', 'Dibatalkan']
const normalizeNomorBS = (value) => (value || '').toString().trim().toUpperCase()

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
        saldoSistem: 0,
        // Bagian CH: total nota Catat Nota (LPJ) yang sudah dicatat tapi
        // belum dirangkai jadi LPJ sungguhan, untuk BS bulan ini -- sudah
        // ikut dikurangi dari saldoSistem di atas, disimpan terpisah juga
        // supaya bisa ditampilkan sebagai keterangan.
        pendingNotaLpjNominal: 0,
        pendingNotaLpjCount: 0,
        pendingNotaRbsNominal: 0,
        pendingNotaRbsCount: 0
    })
    const [loading, setLoading] = useState(true)
    // Bagian CF: koreksi dari user -- card total saja tidak cukup, minta
    // rincian per BS (sisa dana tiap BS) dan per RBS (sudah/belum masuk)
    // ditampilkan sebagai daftar, bukan cuma 1 angka gabungan.
    const [bsBreakdown, setBsBreakdown] = useState([])
    const [rbsBreakdown, setRbsBreakdown] = useState([])
    // Bagian CH: LPJ yang baru dilaporkan bulan ini tapi BS-nya dari bulan
    // sebelumnya -- kartu terpisah, tidak campur dengan angka "bulan ini".
    const [lpjBulanSebelumnya, setLpjBulanSebelumnya] = useState([])

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
                // Bagian CH: nota Catat Nota (draft, BELUM jadi RBS/LPJ sungguhan)
                // milik user -- dipakai supaya sisa dana BS & Saldo Sistem ikut
                // mencerminkan pengeluaran yang sudah DICATAT walau belum resmi
                // di-LPJ-kan/di-submit.
                const notaDraftSnapshot = await getDocs(
                    query(collection(db, 'notaDraft'), where('user.uid', '==', uid))
                )
                const notaDraftAll = notaDraftSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
                const notaDraftLpj = notaDraftAll.filter((n) => n.jenis === 'lpj')
                const notaDraftRbs = notaDraftAll.filter((n) => n.jenis === 'rbs')

                // Bagian BB: nomorBS di LPJ dulu kolom teks bebas (sudah diganti
                // dropdown, lihat FormLpjUmum.jsx/FormLpjMarketing.jsx), tapi data
                // lama tetap bisa beda spasi/kapitalisasi dari displayId BS aslinya
                // -- normalisasi supaya konsisten dengan BsTable.jsx.

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

                // Bagian CF/CH: rincian per BS -- flatten SEMUA item di tiap
                // dokumen BS (bukan cuma item pertama, lihat catatan multi-item
                // Bagian CE di BsTable.jsx) supaya tiap nomorBS dapat baris
                // sendiri dengan sisa dananya sendiri. `id` per item (format
                // `${docId}__${index}`) dipakai buat mencocokkan `notaDraft.bsId`
                // yang disimpan CatatNota.jsx -- supaya nota yang sudah dicatat
                // (belum di-LPJ-kan) ikut mengurangi sisa dana di sini.
                const thisMonthBsItemIds = new Set()
                const newBsBreakdown = []
                bsDisetujui.forEach((bs) => {
                    const items = bs.bonSementara?.length ? bs.bonSementara : []
                    items.forEach((it, index) => {
                        const itemId = `${bs.id}__${index}`
                        thisMonthBsItemIds.add(itemId)
                        const lpjData = lpjByNomorBS[normalizeNomorBS(it.nomorBS)]
                        const jumlahBS = Number(it.jumlahBS) || 0
                        let lpjStatusLabel = 'Belum LPJ'
                        let lpjTotalBiaya = 0
                        if (lpjData && lpjData.status === 'Disetujui') {
                            lpjStatusLabel = 'Sudah LPJ'
                            lpjTotalBiaya = Number(lpjData.totalBiaya) || 0
                        } else if (lpjData && !['Dibatalkan', 'Ditolak'].includes(lpjData.status)) {
                            lpjStatusLabel = 'Sedang LPJ'
                            lpjTotalBiaya = Number(lpjData.totalBiaya) || 0
                        }
                        const pendingNota = notaDraftLpj
                            .filter((n) => n.bsId === itemId)
                            .reduce((sum, n) => sum + (Number(n.jumlahBiaya) || 0), 0)
                        newBsBreakdown.push({
                            key: `${bs.id}-${it.nomorBS}`,
                            nomorBS: it.nomorBS,
                            jumlahBS,
                            transferred: !!bs.transferred,
                            lpjStatus: lpjStatusLabel,
                            pendingNota,
                            sisa: jumlahBS - lpjTotalBiaya - pendingNota
                        })
                    })
                })

                // Bagian CF: rincian per RBS -- sudah/belum "Transferred" (uang
                // sudah masuk atau belum).
                const newRbsBreakdown = rbsThisMonth
                    .filter((item) => item.status === 'Disetujui')
                    .map((item) => ({
                        key: item.id,
                        displayId: item.displayId,
                        totalBiaya: Number(item.totalBiaya) || 0,
                        transferred: !!item.transferred
                    }))

                // Bagian CH: nota Catat Nota (LPJ) yang masuk hitungan sisa
                // dana/Saldo Sistem di atas -- cuma yang BS-nya "bulan ini"
                // (konsisten dengan skop semua angka lain di bawah). Nota untuk
                // BS bulan sebelumnya belum ikut ditampilkan di sini (lihat
                // catatan kartu "LPJ dari Bulan Sebelumnya").
                const pendingNotaLpjThisMonth = notaDraftLpj.filter((n) => thisMonthBsItemIds.has(n.bsId))
                const pendingNotaLpjNominal = pendingNotaLpjThisMonth.reduce((sum, n) => sum + (Number(n.jumlahBiaya) || 0), 0)
                const pendingNotaRbsNominal = notaDraftRbs.reduce((sum, n) => sum + (Number(n.jumlahBiaya) || 0), 0)

                // Bagian CH: LPJ yang BARU dilaporkan BULAN INI tapi BS yang
                // dirujuknya diajukan di BULAN SEBELUMNYA -- dipisah ke kartu
                // sendiri atas permintaan user, supaya tidak bercampur dengan
                // angka "bulan ini" (yang basisnya tanggal BS, bukan tanggal
                // LPJ-nya). Dicari dari SELURUH BS (bsAll), bukan cuma bulan
                // ini, karena justru BS-nya dari bulan LAIN.
                const bsInfoByNomorBS = {}
                bsAll.forEach((bs) => {
                    const items = bs.bonSementara?.length ? bs.bonSementara : []
                    items.forEach((it) => {
                        bsInfoByNomorBS[normalizeNomorBS(it.nomorBS)] = {
                            nomorBS: it.nomorBS,
                            tanggalPengajuan: bs.tanggalPengajuan
                        }
                    })
                })

                const lpjAll = lpjSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
                const lpjThisMonthRaw = lpjAll.filter(
                    (item) => isThisMonth(item.tanggalPengajuan) && !HIDDEN_LPJ_STATUSES.includes(item.status)
                )
                const newLpjBulanSebelumnya = []
                const lpjThisMonth = lpjThisMonthRaw.filter((item) => {
                    const bsInfo = bsInfoByNomorBS[normalizeNomorBS(item.nomorBS)]
                    if (bsInfo && !isThisMonth(bsInfo.tanggalPengajuan)) {
                        newLpjBulanSebelumnya.push({
                            key: item.id,
                            displayId: item.displayId,
                            nomorBS: item.nomorBS,
                            totalBiaya: Number(item.totalBiaya) || 0,
                            sisaLebih: Number(item.sisaLebih) || 0,
                            sisaKurang: Number(item.sisaKurang) || 0,
                            pengembalianOk: item.pengembalianStatus === 'valid' || item.pengembalianStatus === 'grandfathered',
                            sisaKurangDibayar: !!item.sisaKurangDibayar,
                            bsTanggal: bsInfo.tanggalPengajuan
                        })
                        return false
                    }
                    return true
                })

                // Bagian CB: rekonsiliasi dana bulan ini (sebelumnya di Mutasi Dana) --
                // hanya uang yang BENAR-BENAR sudah berpindah yang dihitung, sama
                // seperti prinsip Mutasi Dana Bagian BU: BS/RBS Disetujui tapi belum
                // "Transferred" belum dihitung masuk; LPJ sisaLebih yang belum
                // dikembalikan/terverifikasi & sisaKurang yang belum dibayar juga
                // belum dihitung -- semuanya masuk "Menunggu Konfirmasi" dulu.
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
                // sisaLebih yang sudah dikembalikan + nota Catat Nota yang sudah dicatat
                // tapi belum di-LPJ-kan -- Bagian CH, supaya selisih langsung terlihat
                // begitu nota dicatat, tidak perlu menunggu submit LPJ sungguhan).
                const lpjTotalBiayaThisMonth = lpjThisMonth.reduce((sum, item) => sum + (item.totalBiaya || 0), 0)
                const saldoSistem =
                    rbsBsMasukNominal +
                    lpjKekuranganDibayar.reduce((sum, item) => sum + (Number(item.sisaKurang) || 0), 0) -
                    lpjTotalBiayaThisMonth -
                    lpjSudahDikembalikan.reduce((sum, item) => sum + (Number(item.sisaLebih) || 0), 0) -
                    pendingNotaLpjNominal

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

                setBsBreakdown(newBsBreakdown)
                setRbsBreakdown(newRbsBreakdown)
                setLpjBulanSebelumnya(newLpjBulanSebelumnya)

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
                    saldoSistem,
                    pendingNotaLpjNominal,
                    pendingNotaLpjCount: pendingNotaLpjThisMonth.length,
                    pendingNotaRbsNominal,
                    pendingNotaRbsCount: notaDraftRbs.length
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

    const ringkasanCards = [
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

    // Bagian CH: "Rekonsiliasi Dana Bulan Ini" digabung jadi SATU grid (dulu
    // tersebar di 2 grid terpisah) + ditambah kartu "Saldo Sistem" eksplisit
    // (sebelumnya cuma dipakai diam-diam buat hitung Selisih, tidak pernah
    // ditampilkan sendiri) -- supaya user bisa langsung lihat angka yang
    // dipakai sistem, bukan cuma selisihnya.
    const rekonsiliasiCards = [
        {
            label: 'Saldo Sistem',
            value: formatRupiah(summary.saldoSistem),
            caption: summary.pendingNotaLpjNominal > 0
                ? `Termasuk ${formatRupiah(summary.pendingNotaLpjNominal)} dari ${summary.pendingNotaLpjCount} nota Catat Nota (belum di-LPJ-kan)`
                : 'Masuk terkonfirmasi dikurangi keluar bulan ini',
            valueClass: 'text-gray-900 dark:text-gray-100',
            bgClass: 'bg-gray-50 dark:bg-gray-700/50'
        },
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
        }
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
            {/* Bagian CG: angka di card "keluar" dari batasnya di mobile.
                Sumbernya 2 hal yang ketemu barengan: grid item lebar
                default-nya ikut lebar KONTEN (bukan ikut kolom grid) kalau
                tidak diberi `min-w-0`, dan `text-2xl` untuk nominal Rupiah
                yang panjang jadi kepanjangan buat kolom selebar itu di layar
                kecil -- `min-w-0` + ukuran font responsif + `break-words`
                sebagai jaring pengaman. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {ringkasanCards.map((card) => (
                    <div key={card.label} className={`rounded-lg p-4 min-w-0 ${card.bgClass}`}>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{card.label}</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        ) : (
                            <>
                                <p className={`text-lg sm:text-2xl font-semibold break-words ${card.valueClass}`}>{card.value}</p>
                                {card.caption && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.caption}</p>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Bagian CH: semua kartu rekonsiliasi (Saldo Sistem, RBS/BS Masuk,
                LPJ Dikembalikan, Menunggu Konfirmasi) digabung 1 grid dengan
                heading sendiri, Saldo Bank & Selisih menyusul di bawahnya. */}
            <h3 className="text-base font-medium mt-6 mb-3 dark:text-gray-100">Rekonsiliasi Dana Bulan Ini</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {rekonsiliasiCards.map((card) => (
                    <div key={card.label} className={`rounded-lg p-4 min-w-0 ${card.bgClass}`}>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{card.label}</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        ) : (
                            <>
                                <p className={`text-lg sm:text-2xl font-semibold break-words ${card.valueClass}`}>{card.value}</p>
                                {card.caption && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.caption}</p>
                                )}
                            </>
                        )}
                    </div>
                ))}

                <div className="rounded-lg p-4 min-w-0 bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Saldo Bank <span className="text-xs">(isi manual)</span>
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-base sm:text-lg text-gray-400 dark:text-gray-500 font-semibold flex-shrink-0">Rp</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={saldoBankInput === '' ? '' : Number(saldoBankInput).toLocaleString('id-ID')}
                            onChange={handleSaldoBankChange}
                            onBlur={handleSaldoBankBlur}
                            placeholder={loadingBalance ? '...' : '0'}
                            disabled={loadingBalance}
                            className="text-lg sm:text-2xl font-semibold bg-transparent outline-none w-full min-w-0 dark:text-gray-100 tabular-nums focus:text-blue-600 dark:focus:text-blue-400 disabled:opacity-50"
                        />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {loadingBalance ? 'Memuat...' : savingBalance ? 'Menyimpan...' : 'Cek dari mutasi rekening, lalu ketik di sini'}
                    </p>
                </div>
                <div className={`rounded-lg p-4 min-w-0 ${selisihBank === null ? 'bg-gray-50 dark:bg-gray-700/50' : selisihBank === 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Selisih (Bank vs Sistem)</p>
                    <p className={`text-lg sm:text-2xl font-semibold break-words ${selisihBank === null ? 'text-gray-900 dark:text-gray-100' : selisihBank === 0 ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
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
                {summary.pendingNotaRbsNominal > 0 && (
                    <div className="rounded-lg p-4 min-w-0 bg-blue-50 dark:bg-blue-900/20">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Draft RBS Belum Disubmit</p>
                        <p className="text-lg sm:text-2xl font-semibold break-words text-blue-700 dark:text-blue-400">{formatRupiah(summary.pendingNotaRbsNominal)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {summary.pendingNotaRbsCount} nota di Catat Nota -- belum ikut Saldo Sistem (belum tentu jadi RBS)
                        </p>
                    </div>
                )}
            </div>

            {/* Bagian CF/CH: rincian per BS & per RBS bulan ini -- card total saja
                dianggap tidak cukup untuk menyusuri selisih sampai ke sumbernya.
                Rincian BS sekarang ikut menampilkan nota Catat Nota yang sudah
                dicatat tapi belum di-LPJ-kan. */}
            {!loading && (bsBreakdown.length > 0 || rbsBreakdown.length > 0) && (
                <>
                    <h3 className="text-base font-medium mt-6 mb-3 dark:text-gray-100">Rincian Bulan Ini</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {bsBreakdown.length > 0 && (
                            <div className="rounded-lg border dark:border-gray-700 p-4">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Rincian BS Bulan Ini</p>
                                <div className="flex flex-col gap-2">
                                    {bsBreakdown.map((bs) => (
                                        <div key={bs.key} className="flex items-center justify-between gap-3 text-xs border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-gray-700 dark:text-gray-200 truncate">{bs.nomorBS}</div>
                                                <div className="text-gray-400 dark:text-gray-500">
                                                    {bs.transferred ? 'Sudah Transferred' : 'Belum Transferred'} &middot; {bs.lpjStatus}
                                                </div>
                                                {bs.pendingNota > 0 && (
                                                    <div className="text-blue-500 dark:text-blue-400">
                                                        {formatRupiah(bs.pendingNota)} via Catat Nota (belum di-LPJ-kan)
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatRupiah(bs.jumlahBS)}</div>
                                                <div className={`tabular-nums ${bs.sisa > 0 ? 'text-amber-600 dark:text-amber-400' : bs.sisa < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                    Sisa {formatRupiah(bs.sisa)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {rbsBreakdown.length > 0 && (
                            <div className="rounded-lg border dark:border-gray-700 p-4">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Rincian RBS Bulan Ini</p>
                                <div className="flex flex-col gap-2">
                                    {rbsBreakdown.map((rbs) => (
                                        <div key={rbs.key} className="flex items-center justify-between gap-3 text-xs border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                            <div className="font-semibold text-gray-700 dark:text-gray-200 truncate min-w-0">{rbs.displayId}</div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatRupiah(rbs.totalBiaya)}</div>
                                                <div className={rbs.transferred ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                                    {rbs.transferred ? 'Sudah Masuk' : 'Belum Masuk'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Bagian CH: LPJ yang baru dilaporkan BULAN INI untuk BS dari
                BULAN SEBELUMNYA -- kartu terpisah atas permintaan user, supaya
                tidak bercampur dengan angka "bulan ini" di atas (yang basisnya
                tanggal BS, bukan tanggal LPJ). */}
            {!loading && lpjBulanSebelumnya.length > 0 && (
                <>
                    <h3 className="text-base font-medium mt-6 mb-3 dark:text-gray-100">LPJ dari Bulan Sebelumnya</h3>
                    <div className="rounded-lg border dark:border-gray-700 p-4">
                        <div className="flex flex-col gap-2">
                            {lpjBulanSebelumnya.map((lpj) => (
                                <div key={lpj.key} className="flex items-center justify-between gap-3 text-xs border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-gray-700 dark:text-gray-200 truncate">{lpj.displayId}</div>
                                        <div className="text-gray-400 dark:text-gray-500">
                                            BS: {lpj.nomorBS} &middot; diajukan {new Date(lpj.bsTanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatRupiah(lpj.totalBiaya)}</div>
                                        {lpj.sisaLebih > 0 && (
                                            <div className={lpj.pengembalianOk ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                                Sisa lebih {lpj.pengembalianOk ? 'dikembalikan' : 'belum dikembalikan'}
                                            </div>
                                        )}
                                        {lpj.sisaKurang > 0 && (
                                            <div className={lpj.sisaKurangDibayar ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                                                Kekurangan {lpj.sisaKurangDibayar ? 'sudah dibayar' : 'belum dibayar'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default DashboardSummary
