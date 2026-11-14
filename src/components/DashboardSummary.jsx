import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
// Bagian CL: satu dokumen bonSementara bisa punya LEBIH DARI SATU item
// (lihat FormBs.jsx multipleItems) -- jumlah total dokumen harus menjumlahkan
// SEMUA item, bukan cuma bonSementara[0], supaya konsisten dengan
// newBsBreakdown (sudah di-flatten per item sejak Bagian CE/CF).
const sumBonSementaraItems = (bs) =>
    (bs.bonSementara || []).reduce((sum, it) => sum + (Number(it.jumlahBS) || 0), 0)
// Bagian CO: RBS titipan untuk orang lain (mis. pimpinan/rekan) -- begitu
// cair, uangnya langsung diteruskan, bukan nyangkut jadi uang pribadi
// pengaju. Ditandai PER NOTA (per item di `reimbursements[]`), bukan per
// dokumen RBS, karena 1 pengajuan bisa berisi campuran nota titipan & nota
// milik sendiri sekaligus (lihat FormRbsUmum/Operasional/Bbm.jsx). Porsi
// titipan dikecualikan dari Saldo Sistem/Dana Talangan di Dashboard supaya
// tidak bikin Selisih Bank vs Sistem salah terbaca seolah uang pribadi.
const rbsNonTitipanAmount = (rbs) =>
    (rbs.reimbursements || []).reduce((sum, it) => sum + (it.isTitipan ? 0 : (Number(it.biaya) || 0)), 0)
const rbsTitipanAmount = (rbs) =>
    (rbs.reimbursements || []).reduce((sum, it) => sum + (it.isTitipan ? (Number(it.biaya) || 0) : 0), 0)
const formatDateShort = (iso) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
// Bagian CK: list panjang (Rincian BS/RBS, LPJ Bulan Sebelumnya) cuma
// menampilkan N item dulu + tombol "Tampilkan lainnya", supaya halaman
// tidak kepanjangan kalau datanya banyak (tetap bisa lihat semua kalau mau).
const VISIBLE_LIMIT = 5
// Bagian CM: label tampilan nota Catat Nota -- sama persis pola yang sudah
// dipakai di CatatNota.jsx supaya konsisten ("Lainnya" pakai jenisLain,
// selain itu pakai namaItem, ditambah item/keterangan kalau ada).
const notaDisplayLabel = (n) =>
    `${n.isLainnya ? n.jenisLain : n.namaItem}${n.item || n.keterangan ? ` -- ${n.item || n.keterangan}` : ''}`

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
        // Bagian CN/CO: dipecah per BS/RBS (bukan 1 angka gabungan) + porsi
        // titipan per nota dikecualikan -- lihat rbsNonTitipanAmount.
        rbsBsMasukNominal: 0,
        rbsBsMasukCount: 0,
        bsMasukNominal: 0,
        rbsMasukNominal: 0,
        pendingNominal: 0,
        pendingCount: 0,
        bsPendingNominal: 0,
        rbsPendingNominal: 0,
        saldoSistem: 0,
        saldoSistemMasuk: 0,
        saldoSistemKeluar: 0,
        // Bagian CH: total nota Catat Nota (LPJ) yang sudah dicatat tapi
        // belum dirangkai jadi LPJ sungguhan, untuk BS bulan ini -- sudah
        // ikut dikurangi dari saldoSistem di atas, disimpan terpisah juga
        // supaya bisa ditampilkan sebagai keterangan.
        pendingNotaLpjNominal: 0,
        pendingNotaLpjCount: 0,
        pendingNotaRbsNominal: 0,
        pendingNotaRbsCount: 0,
        // Bagian CN: nominal RBS titipan bulan ini -- bukan uang pribadi,
        // ditampilkan sebagai keterangan saja di kartu "Jumlah RBS bulan ini".
        rbsTitipanThisMonthNominal: 0,
        // Bagian CK: 2 arah dana yang berlawanan, semua periode. Bagian CN:
        // *SudahNominal = lawan arahnya yang SUDAH selesai (semua periode),
        // ditampilkan sebagai keterangan dalam kurung di kartu yang sama --
        // menggantikan kartu "LPJ Dikembalikan/Dibayar" yang terpisah.
        belumSettleNominal: 0,
        belumSettleCount: 0,
        settleSudahNominal: 0,
        belumBayarKekuranganNominal: 0,
        belumBayarKekuranganCount: 0,
        kekuranganSudahNominal: 0,
        // Bagian CM: uang pribadi/talangan yang sudah dikeluarkan user untuk
        // RBS/BS tapi belum diganti kantor -- semua periode, lihat catatan di
        // perhitungannya (sekitar rbsBelumCairAll/notaDraftLpjBelumCair).
        danaTalanganNominal: 0,
        danaTalanganCount: 0
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
    // Bagian CK: koreksi dari user -- "kekurangan BS" (perusahaan BAYAR
    // TAMBAHAN ke karyawan) dan "pengembalian/settle BS" (karyawan
    // KEMBALIKAN sisa ke perusahaan) adalah 2 ARAH DANA YANG BERLAWANAN,
    // dibedakan tegas di sini sebagai 2 list & kartu terpisah. SEMUA
    // PERIODE (bukan cuma bulan ini) -- ini daftar tindak lanjut yang masih
    // outstanding, user perlu lihat semua yang belum selesai terlepas kapan
    // LPJ-nya diajukan.
    const [belumSettleList, setBelumSettleList] = useState([])
    const [belumBayarKekuranganList, setBelumBayarKekuranganList] = useState([])
    // Bagian CM: gabungan 4 sumber talangan pribadi -- RBS yang sudah
    // diajukan tapi belum cair, draft RBS yang belum disubmit, kekurangan BS
    // yang belum dibayar kantor, dan nota LPJ yang dicatat untuk BS yang
    // sendiri belum "Transferred". Lihat perhitungannya di fetchData().
    const [danaTalanganList, setDanaTalanganList] = useState([])
    // Bagian CN: isi modal untuk kartu "RBS/BS Sudah Masuk" & "Menunggu
    // Konfirmasi" -- dibangun dari breakdown BS/RBS bulan ini yang sama.
    const [sudahMasukList, setSudahMasukList] = useState([])
    const [menungguKonfirmasiList, setMenungguKonfirmasiList] = useState([])
    // Bagian CN: satu state modal untuk SEMUA kartu yang punya daftar rincian
    // (Jumlah BS/RBS, Sudah Masuk, Menunggu Konfirmasi, Perlu Ditindaklanjuti)
    // -- lihat `allModalCards` di bawah, digabung dari beberapa sumber supaya
    // satu komponen modal bisa melayani semuanya.
    const [activeModal, setActiveModal] = useState(null)
    const [expandedSections, setExpandedSections] = useState(new Set())
    const toggleSection = (key) => setExpandedSections((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key); else next.add(key)
        return next
    })

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
                const totalNominalBS = bsThisMonth.reduce((sum, item) => sum + sumBonSementaraItems(item), 0)

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
                // Bagian CO: nominal porsi titipan dari RBS bulan ini -- sudah
                // ikut "Jumlah RBS bulan ini" di atas (tetap dihitung sebagai
                // aktivitas pengajuan), tapi TIDAK ikut Saldo Sistem/Dana
                // Talangan di bawah -- dicatat terpisah untuk keterangan.
                const rbsTitipanThisMonthNominal = rbsThisMonth.reduce((sum, item) => sum + rbsTitipanAmount(item), 0)

                // Dari BS bulan ini, ambil yang sudah Disetujui (uang sudah cair)
                const bsDisetujui = bsThisMonth.filter((item) => item.status === 'Disetujui')
                const totalDisetujui = bsDisetujui.reduce((sum, item) => sum + sumBonSementaraItems(item), 0)

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
                            docId: bs.id,
                            nomorBS: it.nomorBS,
                            jumlahBS,
                            transferred: !!bs.transferred,
                            lpjStatus: lpjStatusLabel,
                            pendingNota,
                            sisa: jumlahBS - lpjTotalBiaya - pendingNota,
                            tanggal: bs.tanggalPengajuan
                        })
                    })
                })

                // Bagian CL: "Sudah di-LPJ-kan"/"Selisih belum LPJ" sekarang
                // dihitung per ITEM dari newBsBreakdown (bukan per dokumen BS
                // seperti sebelumnya) -- sebelumnya hanya mengecek displayId
                // (item pertama), jadi BS multi-item kehilangan nominal/status
                // LPJ item ke-2 dst dari kedua kartu ini.
                const totalSudahLpj = newBsBreakdown
                    .filter((it) => it.lpjStatus === 'Sudah LPJ')
                    .reduce((sum, it) => sum + it.jumlahBS, 0)
                const jumlahBsSudahLpj = newBsBreakdown.filter((it) => it.lpjStatus === 'Sudah LPJ').length
                const jumlahBsBelumLpj = newBsBreakdown.length - jumlahBsSudahLpj

                // Bagian CF: rincian per RBS -- sudah/belum "Transferred" (uang
                // sudah masuk atau belum).
                const newRbsBreakdown = rbsThisMonth
                    .filter((item) => item.status === 'Disetujui')
                    .map((item) => ({
                        key: item.id,
                        docId: item.id,
                        displayId: item.displayId,
                        totalBiaya: Number(item.totalBiaya) || 0,
                        transferred: !!item.transferred,
                        // Bagian CO: titipan per nota (bukan whole-doc) -- simpan
                        // porsi non-titipan/titipan supaya kartu rekonsiliasi &
                        // Dana Talangan cuma menghitung porsi milik pengaju sendiri.
                        nonTitipanAmount: rbsNonTitipanAmount(item),
                        titipanAmount: rbsTitipanAmount(item),
                        tanggal: item.tanggalPengajuan
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
                // Bagian CM: transferred flag per ITEM BS, SEMUA periode (bukan
                // cuma bulan ini) -- dipakai buat tahu nota LPJ mana yang masih
                // "talangan" (dicatat tapi BS-nya sendiri belum cair).
                const bsTransferredByItemId = {}
                bsAll.forEach((bs) => {
                    const items = bs.bonSementara?.length ? bs.bonSementara : []
                    items.forEach((it, index) => {
                        bsInfoByNomorBS[normalizeNomorBS(it.nomorBS)] = {
                            nomorBS: it.nomorBS,
                            tanggalPengajuan: bs.tanggalPengajuan
                        }
                        bsTransferredByItemId[`${bs.id}__${index}`] = !!bs.transferred
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
                            docId: item.id,
                            displayId: item.displayId,
                            nomorBS: item.nomorBS,
                            status: item.status,
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

                // Bagian CK: dua daftar tindak lanjut, SEMUA PERIODE (bukan cuma
                // bulan ini) -- supaya user bisa lihat SEMUA yang masih
                // outstanding, bukan cuma yang kebetulan LPJ-nya diajukan bulan
                // ini. Dibedakan tegas: "Belum Settle" = karyawan belum
                // mengembalikan sisa lebih dana BS ke perusahaan (uang MASUK ke
                // kas). "Kekurangan Belum Dibayar" = perusahaan belum membayar
                // TAMBAHAN ke karyawan (uang KELUAR dari kas) -- arah yang
                // berlawanan, jangan sampai tercampur jadi satu angka.
                const lpjActiveAll = lpjAll.filter((item) => !HIDDEN_LPJ_STATUSES.includes(item.status))
                const newBelumSettleList = lpjActiveAll
                    .filter((item) => (Number(item.sisaLebih) || 0) > 0 && !(item.pengembalianStatus === 'valid' || item.pengembalianStatus === 'grandfathered'))
                    .map((item) => ({
                        key: item.id,
                        title: item.displayId,
                        sub: `BS: ${item.nomorBS}`,
                        amount: Number(item.sisaLebih) || 0,
                        tanggal: item.tanggalPengajuan,
                        linkTo: `/lpj/${item.id}`
                    }))
                const newBelumBayarKekuranganList = lpjActiveAll
                    .filter((item) => (Number(item.sisaKurang) || 0) > 0 && !item.sisaKurangDibayar)
                    .map((item) => ({
                        key: item.id,
                        title: item.displayId,
                        sub: `BS: ${item.nomorBS}`,
                        amount: Number(item.sisaKurang) || 0,
                        tanggal: item.tanggalPengajuan,
                        linkTo: `/lpj/${item.id}`
                    }))
                const belumBayarKekuranganNominalValue = newBelumBayarKekuranganList.reduce((sum, item) => sum + item.amount, 0)

                // Bagian CN: lawan dari 2 daftar di atas -- SUDAH selesai (semua
                // periode), dipakai sebagai keterangan "(Rp X sudah
                // dikembalikan/dibayar)" di kartu yang sama, menggantikan kartu
                // "LPJ Dikembalikan/Dibayar" yang terpisah supaya tampilan tidak
                // terlalu ramai (permintaan user).
                const settleSudahNominal = lpjActiveAll
                    .filter((item) => (Number(item.sisaLebih) || 0) > 0 && (item.pengembalianStatus === 'valid' || item.pengembalianStatus === 'grandfathered'))
                    .reduce((sum, item) => sum + (Number(item.sisaLebih) || 0), 0)
                const kekuranganSudahNominal = lpjActiveAll
                    .filter((item) => (Number(item.sisaKurang) || 0) > 0 && item.sisaKurangDibayar)
                    .reduce((sum, item) => sum + (Number(item.sisaKurang) || 0), 0)

                // Bagian CM: "Dana Talangan Belum Diganti" -- user keluar uang
                // duluan (pribadi atau rekening belanja operasional) untuk
                // RBS/BS sebelum uangnya benar-benar cair/diganti kantor.
                // Digabung dari 4 sumber, SEMUA PERIODE:
                // 1) RBS yang sudah diajukan tapi belum "Transferred"
                // 2) Draft RBS di Catat Nota yang belum disubmit sama sekali
                // 3) Kekurangan BS yang belum dibayar kantor (reuse list di atas)
                // 4) Nota LPJ yang dicatat untuk BS yang BS-nya sendiri belum
                //    "Transferred" (ditandai false eksplisit di
                //    bsTransferredByItemId -- bsId yang tidak dikenal/BS sudah
                //    dihapus tidak ikut dihitung supaya tidak salah hitung).
                // Bagian CO: porsi titipan (per nota) dikecualikan di sini --
                // RBS yang SEMUA notanya titipan (nonTitipanAmount == 0) tidak
                // ikut sama sekali; yang campuran cuma menghitung porsi sendiri.
                const rbsBelumCairAll = rbsAll
                    .filter((item) => !HIDDEN_LPJ_STATUSES.includes(item.status) && !item.transferred)
                    .map((item) => ({ item, nonTitipanAmount: rbsNonTitipanAmount(item) }))
                    .filter(({ nonTitipanAmount }) => nonTitipanAmount > 0)
                const talanganRbsBelumCair = rbsBelumCairAll.map(({ item, nonTitipanAmount }) => ({
                    key: `rbs-${item.id}`,
                    title: item.displayId,
                    sub: rbsTitipanAmount(item) > 0 ? 'RBS sudah diajukan, belum cair (sebagian titipan)' : 'RBS sudah diajukan, belum cair',
                    amount: nonTitipanAmount,
                    tanggal: item.tanggalPengajuan,
                    linkTo: `/reimbursement/${item.id}`
                }))
                const talanganDraftRbs = notaDraftRbs.map((n) => ({
                    key: `draft-rbs-${n.id}`,
                    title: notaDisplayLabel(n),
                    sub: 'Draft RBS, belum disubmit',
                    amount: Number(n.jumlahBiaya) || 0,
                    tanggal: n.tanggal,
                    linkTo: '/catat-nota'
                }))
                const talanganKekurangan = newBelumBayarKekuranganList.map((item) => ({
                    key: `kekurangan-${item.key}`,
                    title: item.title,
                    sub: 'Kekurangan BS belum dibayar kantor',
                    amount: item.amount,
                    tanggal: item.tanggal,
                    linkTo: item.linkTo
                }))
                const notaDraftLpjBelumCair = notaDraftLpj.filter((n) => bsTransferredByItemId[n.bsId] === false)
                const talanganNotaLpj = notaDraftLpjBelumCair.map((n) => ({
                    key: `nota-lpj-${n.id}`,
                    title: notaDisplayLabel(n),
                    sub: `BS: ${n.nomorBS} -- belum cair`,
                    amount: Number(n.jumlahBiaya) || 0,
                    tanggal: n.tanggal,
                    linkTo: '/catat-nota'
                }))
                const newDanaTalanganList = [
                    ...talanganRbsBelumCair,
                    ...talanganDraftRbs,
                    ...talanganKekurangan,
                    ...talanganNotaLpj
                ].sort((a, b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0))
                const danaTalanganNominal = newDanaTalanganList.reduce((sum, item) => sum + item.amount, 0)

                // Bagian CB: rekonsiliasi dana bulan ini (sebelumnya di Mutasi Dana) --
                // hanya uang yang BENAR-BENAR sudah berpindah yang dihitung, sama
                // seperti prinsip Mutasi Dana Bagian BU: BS/RBS Disetujui tapi belum
                // "Transferred" belum dihitung masuk.
                // Bagian CK: "Menunggu Konfirmasi" di bawah ini DIPERSEMPIT jadi
                // cuma BS/RBS yang belum Transferred -- sisaLebih/sisaKurang yang
                // belum selesai sekarang punya kartu & daftar sendiri di atas
                // (semua periode), supaya tidak tercampur dalam 1 angka yang
                // membingungkan arah dananya.
                // Bagian CN/CO: dipisah tegas jadi BS vs RBS (bukan 1 angka
                // gabungan lagi, permintaan user) + porsi titipan per nota
                // dikecualikan (lihat rbsNonTitipanAmount di atas) supaya tidak
                // bikin Saldo Sistem naik padahal uangnya bukan untuk pengaju
                // sendiri. RBS yang SEMUA notanya titipan otomatis ikut keluar
                // (nonTitipanAmount == 0 -> difilter).
                const bsTransferredThisMonth = bsDisetujui.filter((item) => item.transferred)
                const rbsDisetujuiThisMonth = rbsThisMonth.filter((item) => item.status === 'Disetujui')
                const rbsTransferredThisMonth = rbsDisetujuiThisMonth.filter((item) => item.transferred && rbsNonTitipanAmount(item) > 0)
                const bsMasukNominal = bsTransferredThisMonth.reduce((sum, item) => sum + sumBonSementaraItems(item), 0)
                const rbsMasukNominal = rbsTransferredThisMonth.reduce((sum, item) => sum + rbsNonTitipanAmount(item), 0)
                const rbsBsMasukNominal = bsMasukNominal + rbsMasukNominal
                const rbsBsMasukCount = bsTransferredThisMonth.length + rbsTransferredThisMonth.length

                const lpjSisaKurangThisMonth = lpjThisMonth.filter((item) => (Number(item.sisaKurang) || 0) > 0)
                const lpjKekuranganDibayar = lpjSisaKurangThisMonth.filter((item) => item.sisaKurangDibayar)
                const lpjSisaLebihThisMonth = lpjThisMonth.filter((item) => (Number(item.sisaLebih) || 0) > 0)
                const lpjSudahDikembalikan = lpjSisaLebihThisMonth.filter(
                    (item) => item.pengembalianStatus === 'valid' || item.pengembalianStatus === 'grandfathered'
                )

                const bsBelumTransfer = bsDisetujui.filter((item) => !item.transferred)
                const rbsBelumTransfer = rbsDisetujuiThisMonth.filter((item) => !item.transferred && rbsNonTitipanAmount(item) > 0)
                // Bagian CK: sisaKurang/sisaLebih belum dihitung di sini lagi --
                // sudah punya kartu & daftar sendiri (semua periode) di atas.
                const bsPendingNominal = bsBelumTransfer.reduce((sum, item) => sum + sumBonSementaraItems(item), 0)
                const rbsPendingNominal = rbsBelumTransfer.reduce((sum, item) => sum + rbsNonTitipanAmount(item), 0)
                const pendingNominal = bsPendingNominal + rbsPendingNominal
                const pendingCount = bsBelumTransfer.length + rbsBelumTransfer.length

                // Bagian CN/CO: daftar isi untuk modal "RBS/BS Sudah Masuk" &
                // "Menunggu Konfirmasi" -- dibangun dari breakdown BS/RBS yang
                // sudah ada (newBsBreakdown/newRbsBreakdown) supaya tidak perlu
                // query ulang. Nominal RBS yang dipakai di sini SELALU porsi
                // non-titipan saja (`nonTitipanAmount`), bukan `totalBiaya`.
                const toBsModalItem = (b) => ({
                    key: `bs-${b.key}`, title: b.nomorBS, sub: 'BS', amount: b.jumlahBS,
                    tanggal: b.tanggal, linkTo: `/bon-sementara/${b.docId}`
                })
                const toRbsModalItem = (r) => ({
                    key: `rbs-${r.key}`, title: r.displayId,
                    sub: r.titipanAmount > 0 ? 'RBS (sebagian titipan)' : 'RBS',
                    amount: r.nonTitipanAmount,
                    tanggal: r.tanggal, linkTo: `/reimbursement/${r.docId}`
                })
                const byTanggalDesc = (a, b) => new Date(b.tanggal || 0) - new Date(a.tanggal || 0)
                const newSudahMasukList = [
                    ...newBsBreakdown.filter((b) => b.transferred).map(toBsModalItem),
                    ...newRbsBreakdown.filter((r) => r.transferred && r.nonTitipanAmount > 0).map(toRbsModalItem)
                ].sort(byTanggalDesc)
                const newMenungguKonfirmasiList = [
                    ...newBsBreakdown.filter((b) => !b.transferred).map(toBsModalItem),
                    ...newRbsBreakdown.filter((r) => !r.transferred && r.nonTitipanAmount > 0).map(toRbsModalItem)
                ].sort(byTanggalDesc)

                // Saldo Sistem = uang masuk terkonfirmasi (BS/RBS Transferred + sisaKurang
                // yang sudah dibayar) dikurangi uang keluar (total biaya LPJ bulan ini +
                // sisaLebih yang sudah dikembalikan + nota Catat Nota yang sudah dicatat
                // tapi belum di-LPJ-kan -- Bagian CH, supaya selisih langsung terlihat
                // begitu nota dicatat, tidak perlu menunggu submit LPJ sungguhan).
                const lpjTotalBiayaThisMonth = lpjThisMonth.reduce((sum, item) => sum + (item.totalBiaya || 0), 0)
                const lpjKekuranganDibayarNominal = lpjKekuranganDibayar.reduce((sum, item) => sum + (Number(item.sisaKurang) || 0), 0)
                const lpjSudahDikembalikanNominal = lpjSudahDikembalikan.reduce((sum, item) => sum + (Number(item.sisaLebih) || 0), 0)
                // Bagian CN: masuk/keluar dipisah jadi variabel sendiri supaya bisa
                // ditampilkan sebagai sumber angka Saldo Sistem di caption kartu
                // (permintaan user -- "tampilkan dalam kurung sumbernya dari mana").
                const saldoSistemMasuk = rbsBsMasukNominal + lpjKekuranganDibayarNominal
                const saldoSistemKeluar = lpjTotalBiayaThisMonth + lpjSudahDikembalikanNominal + pendingNotaLpjNominal
                const saldoSistem = saldoSistemMasuk - saldoSistemKeluar

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
                        // Bagian CL: dokumen `lpj` tidak punya field `bonSementara` sendiri
                        // (itu field dokumen `bonSementara`) -- nominalnya ada di `totalBiaya`,
                        // sama seperti dipakai di tempat lain (lpjTotalBiayaThisMonth dst).
                        fetchAssignedThisMonth('lpj', (item) => item.totalBiaya),
                        fetchAssignedThisMonth('reimbursement', (item) => item.totalBiaya)
                    ])

                    jumlahLpjDiproses = lpjResult.count
                    nominalLpjDiproses = lpjResult.nominal
                    jumlahRbsDiproses = rbsResult.count
                    nominalRbsDiproses = rbsResult.nominal

                    // Khusus Reviewer: tambahan BS (Bon Sementara) yang mereka approve bulan ini
                    if (isReviewer) {
                        const bsResult = await fetchAssignedThisMonth('bonSementara', sumBonSementaraItems)
                        jumlahBsDiapprove = bsResult.count
                        nominalBsDiapprove = bsResult.nominal
                    }
                }

                setBsBreakdown(newBsBreakdown)
                setRbsBreakdown(newRbsBreakdown)
                // Bagian CN: LPJ bulan sebelumnya yang statusnya sudah
                // "Disetujui" tidak ditampilkan lagi di sini -- sisa lebih/
                // kurangnya (kalau ada) sudah punya kartu tindak lanjut sendiri
                // (semua periode) di atas, jadi daftar ini cukup fokus ke yang
                // MASIH menunggu approval (permintaan user).
                setLpjBulanSebelumnya(newLpjBulanSebelumnya.filter((item) => item.status !== 'Disetujui'))
                setBelumSettleList(newBelumSettleList)
                setBelumBayarKekuranganList(newBelumBayarKekuranganList)
                setDanaTalanganList(newDanaTalanganList)
                setSudahMasukList(newSudahMasukList)
                setMenungguKonfirmasiList(newMenungguKonfirmasiList)

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
                    bsMasukNominal,
                    rbsMasukNominal,
                    pendingNominal,
                    pendingCount,
                    bsPendingNominal,
                    rbsPendingNominal,
                    saldoSistem,
                    saldoSistemMasuk,
                    saldoSistemKeluar,
                    pendingNotaLpjNominal,
                    pendingNotaLpjCount: pendingNotaLpjThisMonth.length,
                    pendingNotaRbsNominal,
                    pendingNotaRbsCount: notaDraftRbs.length,
                    rbsTitipanThisMonthNominal,
                    belumSettleNominal: newBelumSettleList.reduce((sum, item) => sum + item.amount, 0),
                    belumSettleCount: newBelumSettleList.length,
                    settleSudahNominal,
                    belumBayarKekuranganNominal: belumBayarKekuranganNominalValue,
                    belumBayarKekuranganCount: newBelumBayarKekuranganList.length,
                    kekuranganSudahNominal,
                    danaTalanganNominal,
                    danaTalanganCount: newDanaTalanganList.length
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

    // Bagian CN: "Rincian BS/RBS Bulan Ini" (dulu seksi terpisah full-width,
    // selalu terbuka -- dikeluhkan user kepanjangan) sekarang jadi isi modal
    // kartu "Jumlah BS/RBS bulan ini" di bawah, dipakai bareng `allModalCards`.
    // Bentuk item disamakan sejauh mungkin dengan kartu modal lain
    // ({title,sub,amount,tanggal,linkTo}), ditambah `extra`/`amountSub`
    // opsional untuk info tambahan (status LPJ, sisa dana) yang sebelumnya
    // ada di seksi lama.
    const rincianBsList = bsBreakdown.map((b) => ({
        key: b.key,
        title: b.nomorBS,
        sub: `${b.transferred ? 'Sudah Transferred' : 'Belum Transferred'} · ${b.lpjStatus}`,
        extra: b.pendingNota > 0 ? `${formatRupiah(b.pendingNota)} via Catat Nota (belum di-LPJ-kan)` : null,
        amount: b.jumlahBS,
        amountSub: `Sisa ${formatRupiah(b.sisa)}`,
        amountSubClass: b.sisa > 0 ? 'text-amber-600 dark:text-amber-400' : b.sisa < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
        tanggal: b.tanggal,
        linkTo: `/bon-sementara/${b.docId}`
    }))
    const rincianRbsList = rbsBreakdown.map((r) => ({
        key: r.key,
        title: r.displayId,
        sub: r.titipanAmount > 0
            ? (r.nonTitipanAmount > 0 ? `Sebagian titipan (${formatRupiah(r.titipanAmount)})` : 'Semua nota titipan untuk orang lain')
            : null,
        amount: r.totalBiaya,
        amountSub: r.transferred ? 'Sudah Masuk' : 'Belum Masuk',
        amountSubClass: r.transferred ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400',
        tanggal: r.tanggal,
        linkTo: `/reimbursement/${r.docId}`
    }))

    const ringkasanCards = [
        {
            key: 'rincianBs',
            label: 'Jumlah BS bulan ini',
            value: formatRupiah(summary.nominalBS),
            caption: `${summary.jumlahBS} pengajuan${summary.jumlahBS > 0 ? ' -- klik untuk lihat rincian' : ''}`,
            valueClass: 'text-gray-900 dark:text-gray-100',
            bgClass: 'bg-gray-50 dark:bg-gray-700/50',
            list: rincianBsList
        },
        {
            key: 'rincianRbs',
            label: 'Jumlah RBS bulan ini',
            value: formatRupiah(summary.nominalRbs),
            caption: `${summary.jumlahRbs} pengajuan${summary.rbsTitipanThisMonthNominal > 0 ? ` (termasuk ${formatRupiah(summary.rbsTitipanThisMonthNominal)} titipan, tidak masuk Saldo Sistem)` : summary.jumlahRbs > 0 ? ' -- klik untuk lihat rincian' : ''}`,
            valueClass: 'text-gray-900 dark:text-gray-100',
            bgClass: 'bg-gray-50 dark:bg-gray-700/50',
            list: rincianRbsList
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
    // Bagian CN: "LPJ Dikembalikan/Dibayar" (kartu terpisah, bulan ini saja)
    // dihapus -- angkanya sekarang jadi keterangan "(Rp X sudah
    // dikembalikan/dibayar)" di kartu "BS Belum Settle"/"Kekurangan Belum
    // Dibayar" (semua periode) supaya tidak ada 2 kartu untuk 1 topik yang
    // sama (permintaan user, mengurangi jumlah kartu). "RBS/BS Sudah
    // Masuk"/"Menunggu Konfirmasi" dipisah BS vs RBS di caption + jadi
    // clickable (modal) supaya kelihatan dari mana saja angkanya.
    const rekonsiliasiCards = [
        {
            label: 'Saldo Sistem',
            value: formatRupiah(summary.saldoSistem),
            caption: `(Masuk ${formatRupiah(summary.saldoSistemMasuk)} − Keluar ${formatRupiah(summary.saldoSistemKeluar)})${summary.pendingNotaLpjNominal > 0 ? ` -- termasuk ${formatRupiah(summary.pendingNotaLpjNominal)} dari ${summary.pendingNotaLpjCount} nota Catat Nota belum di-LPJ-kan` : ''}`,
            valueClass: 'text-gray-900 dark:text-gray-100',
            bgClass: 'bg-gray-50 dark:bg-gray-700/50'
        },
        {
            key: 'sudahMasuk',
            label: 'RBS/BS Sudah Masuk',
            value: formatRupiah(summary.rbsBsMasukNominal),
            caption: `BS: ${formatRupiah(summary.bsMasukNominal)} · RBS: ${formatRupiah(summary.rbsMasukNominal)} (${summary.rbsBsMasukCount} transaksi, sudah "Transferred")${summary.rbsBsMasukCount > 0 ? '. Klik untuk lihat daftar.' : ''}`,
            valueClass: 'text-green-700 dark:text-green-400',
            bgClass: 'bg-green-50 dark:bg-green-900/20',
            list: sudahMasukList
        },
        {
            // Bagian CK: dipersempit jadi cuma BS/RBS belum Transferred --
            // sisaLebih/sisaKurang sekarang di kartu "Perlu Ditindaklanjuti"
            // (semua periode) supaya arah dananya tidak tercampur di sini.
            key: 'menunggu',
            label: 'Menunggu Konfirmasi',
            value: formatRupiah(summary.pendingNominal),
            caption:
                summary.pendingCount > 0
                    ? `BS: ${formatRupiah(summary.bsPendingNominal)} · RBS: ${formatRupiah(summary.rbsPendingNominal)} (${summary.pendingCount} belum "Transferred"). Klik untuk lihat daftar.`
                    : 'Semua BS/RBS bulan ini sudah masuk',
            valueClass: summary.pendingCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100',
            bgClass: summary.pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-700/50',
            list: menungguKonfirmasiList
        }
    ]

    // Bagian CK: 2 kartu "Perlu Ditindaklanjuti" -- SEMUA PERIODE, bukan cuma
    // bulan ini, supaya tidak ada yang "hilang" dari pantauan hanya karena
    // LPJ-nya diajukan bulan lalu. Diklik untuk lihat daftar lengkapnya lewat
    // modal (`activeModal`). Dibedakan tegas dari arah uangnya: "Belum
    // Settle" = karyawan belum kembalikan sisa ke perusahaan (uang MASUK).
    // "Kekurangan Belum Dibayar" = perusahaan belum bayar tambahan ke
    // karyawan (uang KELUAR) -- kebalikan arahnya, jangan sampai tertukar.
    const tindakLanjutCards = [
        {
            key: 'settle',
            label: 'BS Belum Settle',
            value: formatRupiah(summary.belumSettleNominal),
            caption: summary.belumSettleCount > 0
                ? `${summary.belumSettleCount} BS belum dikembalikan ke kas${summary.settleSudahNominal > 0 ? ` (${formatRupiah(summary.settleSudahNominal)} sudah dikembalikan)` : ''}. Klik untuk lihat daftar.`
                : summary.settleSudahNominal > 0
                    ? `Semua sudah dikembalikan (${formatRupiah(summary.settleSudahNominal)})`
                    : 'Semua sisa lebih BS sudah dikembalikan',
            valueClass: summary.belumSettleCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100',
            bgClass: summary.belumSettleCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-700/50',
            list: belumSettleList
        },
        {
            key: 'kekurangan',
            label: 'Kekurangan Belum Dibayar',
            value: formatRupiah(summary.belumBayarKekuranganNominal),
            caption: summary.belumBayarKekuranganCount > 0
                ? `${summary.belumBayarKekuranganCount} BS belum dibayar ke karyawan${summary.kekuranganSudahNominal > 0 ? ` (${formatRupiah(summary.kekuranganSudahNominal)} sudah dibayar)` : ''}. Klik untuk lihat daftar.`
                : summary.kekuranganSudahNominal > 0
                    ? `Semua sudah dibayar (${formatRupiah(summary.kekuranganSudahNominal)})`
                    : 'Semua kekurangan sudah dibayar ke karyawan',
            valueClass: summary.belumBayarKekuranganCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100',
            bgClass: summary.belumBayarKekuranganCount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50',
            list: belumBayarKekuranganList
        },
        {
            // Bagian CM: permintaan user -- "saya ingin tahu selisih agar saya
            // tidak terus menggunakan uang pribadi untuk ganti". Beda dari
            // "Selisih (Bank vs Sistem)" (cuma pengecekan kecocokan saldo),
            // kartu ini langsung menjumlahkan uang yang SUDAH dikeluarkan
            // user (pribadi/rekening belanja) dan masih menunggu diganti
            // kantor -- naik begitu user keluar uang duluan, turun begitu
            // BS/RBS-nya benar-benar "Transferred"/kekurangannya dibayar.
            key: 'talangan',
            label: 'Dana Talangan Belum Diganti',
            value: formatRupiah(summary.danaTalanganNominal),
            caption: summary.danaTalanganCount > 0
                ? `${summary.danaTalanganCount} item -- uang Anda yang masih menunggu BS/RBS cair atau kekurangan dibayar. Klik untuk lihat rincian.`
                : 'Tidak ada dana talangan yang menunggu diganti',
            valueClass: summary.danaTalanganCount > 0 ? 'text-purple-700 dark:text-purple-400' : 'text-gray-900 dark:text-gray-100',
            bgClass: summary.danaTalanganCount > 0 ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-gray-700/50',
            list: danaTalanganList
        }
    ]

    // Bagian CN: satu sumber lookup untuk SEMUA modal di halaman ini --
    // digabung dari 3 grup kartu (ringkasan, rekonsiliasi, tindak lanjut)
    // yang masing-masing bisa punya kartu dengan `key`+`list`.
    const allModalCards = [...ringkasanCards, ...rekonsiliasiCards, ...tindakLanjutCards].filter((card) => card.key)

    const renderCard = (card) => {
        const clickable = Array.isArray(card.list) && card.list.length > 0
        const Tag = clickable ? 'button' : 'div'
        const tagProps = clickable
            ? { type: 'button', onClick: () => setActiveModal(card.key), className: `text-left rounded-lg p-4 min-w-0 ${card.bgClass} cursor-pointer hover:brightness-95 dark:hover:brightness-110` }
            : { className: `rounded-lg p-4 min-w-0 ${card.bgClass}` }
        return (
            <Tag key={card.key || card.label} {...tagProps}>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{card.label}</p>
                {loading ? (
                    <div className="h-7 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                ) : (
                    <>
                        <p className={`text-lg sm:text-2xl font-semibold break-words ${card.valueClass}`}>{card.value}</p>
                        {card.caption && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.caption}</p>}
                    </>
                )}
            </Tag>
        )
    }

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
                {ringkasanCards.map(renderCard)}
            </div>

            {/* Bagian CK: "Perlu Ditindaklanjuti" -- SEMUA PERIODE (bukan cuma
                bulan ini), diklik untuk lihat daftar lengkap lewat modal.
                Diletakkan di atas "Rekonsiliasi Dana Bulan Ini" karena
                sifatnya tindak lanjut yang mendesak, lintas waktu. */}
            <h3 className="text-base font-medium mt-6 mb-3 dark:text-gray-100">
                Perlu Ditindaklanjuti <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(semua periode)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {tindakLanjutCards.map(renderCard)}
            </div>

            {/* Bagian CH/CN: kartu rekonsiliasi (Saldo Sistem, RBS/BS Sudah
                Masuk, Menunggu Konfirmasi) digabung 1 grid dengan heading
                sendiri, Saldo Bank & Selisih menyusul di bawahnya. */}
            <h3 className="text-base font-medium mt-6 mb-3 dark:text-gray-100">Rekonsiliasi Dana Bulan Ini</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {rekonsiliasiCards.map(renderCard)}

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
                            : `(Bank ${formatRupiah(saldoBankNumber)} − Sistem ${formatRupiah(summary.saldoSistem)}) ${
                                selisihBank === 0
                                    ? '-- sudah sama'
                                    : selisihBank > 0
                                        ? '-- kemungkinan ada pengeluaran yang belum dicatat/di-LPJ-kan'
                                        : '-- cek kartu "Dana Talangan Belum Diganti" di atas'
                            }`}
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

            {/* Bagian CN: seksi "Rincian Bulan Ini" (selalu terbuka, full-width)
                dihapus -- isinya sekarang ada di modal kartu "Jumlah BS/RBS
                bulan ini" di atas (klik kartunya), supaya halaman tidak
                kepanjangan (keluhan user). */}

            {/* Bagian CH/CN: LPJ yang baru dilaporkan BULAN INI untuk BS dari
                BULAN SEBELUMNYA -- kartu terpisah atas permintaan user, supaya
                tidak bercampur dengan angka "bulan ini" di atas (yang basisnya
                tanggal BS, bukan tanggal LPJ). Hanya LPJ yang MASIH menunggu
                approval yang ditampilkan di sini (status != 'Disetujui',
                difilter saat setLpjBulanSebelumnya) -- yang sudah Disetujui
                sudah tercakup kartu "BS Belum Settle"/"Kekurangan Belum
                Dibayar" (semua periode) di atas, tidak perlu ditampilkan 2x. */}
            {!loading && lpjBulanSebelumnya.length > 0 && (
                <>
                    <h3 className="text-base font-medium mt-6 mb-3 dark:text-gray-100">LPJ dari Bulan Sebelumnya</h3>
                    <div className="rounded-lg border dark:border-gray-700 p-4">
                        <div className="flex flex-col gap-2">
                            {(expandedSections.has('lpjLama') ? lpjBulanSebelumnya : lpjBulanSebelumnya.slice(0, VISIBLE_LIMIT)).map((lpj) => (
                                <Link
                                    key={lpj.key}
                                    to={`/lpj/${lpj.docId}`}
                                    className="flex items-center justify-between gap-3 text-xs border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0 -mx-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <div className="font-semibold text-gray-700 dark:text-gray-200 truncate">{lpj.displayId}</div>
                                        <div className="text-gray-400 dark:text-gray-500">
                                            BS: {lpj.nomorBS} &middot; diajukan {new Date(lpj.bsTanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                        <div className="text-blue-500 dark:text-blue-400">Menunggu approval: {lpj.status}</div>
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
                                </Link>
                            ))}
                        </div>
                        {lpjBulanSebelumnya.length > VISIBLE_LIMIT && (
                            <button onClick={() => toggleSection('lpjLama')} className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-3">
                                {expandedSections.has('lpjLama') ? 'Sembunyikan' : `Tampilkan ${lpjBulanSebelumnya.length - VISIBLE_LIMIT} lainnya`}
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Bagian CK/CN: satu modal untuk SEMUA kartu yang punya daftar
                rincian (lihat `allModalCards`) -- dibangun manual (bukan
                pakai Modal.jsx yang ada) karena Modal.jsx dirancang untuk
                dialog konfirmasi (title+message+tombol), bukan daftar
                panjang yang bisa di-scroll. Tiap baris diklik untuk langsung
                ke halaman detailnya (`item.linkTo`), kalau ada -- permintaan
                user supaya modal tidak jadi jalan buntu. */}
            {activeModal && (() => {
                const activeCard = allModalCards.find((card) => card.key === activeModal)
                if (!activeCard) return null
                return (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setActiveModal(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-lg p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">{activeCard.label}</h3>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {activeCard.list.map((item) => {
                                const Row = item.linkTo ? Link : 'div'
                                const rowProps = item.linkTo ? { to: item.linkTo, onClick: () => setActiveModal(null) } : {}
                                return (
                                    <Row
                                        key={item.key}
                                        {...rowProps}
                                        className={`flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0 ${item.linkTo ? '-mx-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <div className="font-semibold text-gray-700 dark:text-gray-200 truncate">{item.title}</div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                                {item.sub ? `${item.sub} · ` : ''}{formatDateShort(item.tanggal)}
                                            </div>
                                            {item.extra && (
                                                <div className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{item.extra}</div>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className={`font-semibold tabular-nums ${activeCard.valueClass}`}>
                                                {formatRupiah(item.amount)}
                                            </div>
                                            {item.amountSub && (
                                                <div className={`tabular-nums text-xs ${item.amountSubClass || 'text-gray-400 dark:text-gray-500'}`}>
                                                    {item.amountSub}
                                                </div>
                                            )}
                                        </div>
                                    </Row>
                                )
                            })}
                        </div>
                    </div>
                </div>
                )
            })()}
        </div>
    )
}

export default DashboardSummary
