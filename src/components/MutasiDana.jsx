import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import Select from 'react-select'
import { useTheme } from '../context/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faCircleCheck, faArrowUp, faArrowDown, faTriangleExclamation, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons'

// Bagian BW: Saldo Sistem & Selisih sekarang per periode (bulan+tahun) --
// koreksi dari user karena siklus BS/LPJ memang bulanan, menjumlahkan
// SEMUA histori langsung jadi tidak representatif. "Semua Bulan" + "Semua
// Tahun" sekaligus = tampilan kumulatif seperti sebelumnya (Bagian BT/BU).
const BULAN_OPTIONS = [
    { value: null, label: 'Semua Bulan' },
    { value: 0, label: 'Januari' }, { value: 1, label: 'Februari' }, { value: 2, label: 'Maret' },
    { value: 3, label: 'April' }, { value: 4, label: 'Mei' }, { value: 5, label: 'Juni' },
    { value: 6, label: 'Juli' }, { value: 7, label: 'Agustus' }, { value: 8, label: 'September' },
    { value: 9, label: 'Oktober' }, { value: 10, label: 'November' }, { value: 11, label: 'Desember' }
]

// Bagian BT: "Mutasi Dana" -- buku kas pribadi milik user yang login, dihitung
// dari BS/RBS/LPJ miliknya sendiri (tidak ada koleksi transaksi baru di
// Firestore -- murni turunan dari data yang sudah ada), supaya user bisa
// mencocokkan saldo yang dihitung sistem dengan saldo di rekening bank
// pribadinya. Lihat mockup Artifact yang disetujui user sebelum implementasi
// ini (https://claude.ai/artifact/LAD96H44SL5cZrsY85BU5G).
//
// Catatan skop v1 (sengaja disederhanakan dulu, lihat pesan ke user): grafik
// tren saldo di mockup BELUM dibuat di versi nyata ini -- fokus awal ke
// rekonsiliasi (saldo sistem/bank/selisih) + buku besarnya, karena itu inti
// permintaan user. Bisa ditambah menyusul kalau diminta.

// Sama seperti BsTable.jsx/ReimbursementTable.jsx/LpjPdf.jsx -- belum ada
// helper terpusat untuk "kapan dokumen ini disetujui penuh" di codebase ini
// (dicek sebelum menulis file ini), jadi pola pencarian statusHistory ini
// terpaksa diduplikasi lagi di sini mengikuti pola yang sudah ada.
const getApprovalTimestamp = (item) => {
    const entry = item.statusHistory?.find(
        (h) => h.status === 'Disetujui oleh Reviewer 2' || h.status === 'Disetujui oleh Super Admin (Pengganti Reviewer 2)'
    )
    return entry?.timestamp || item.tanggalPengajuan
}

const HIDDEN_LPJ_STATUSES = ['Ditolak', 'Dibatalkan']

const formatRupiah = (n) => 'Rp' + Math.round(Math.abs(n || 0)).toLocaleString('id-ID')

const formatDate = (iso) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MutasiDana = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [loading, setLoading] = useState(true)
    const [bsDocs, setBsDocs] = useState([])
    const [rbsDocs, setRbsDocs] = useState([])
    const [lpjDocs, setLpjDocs] = useState([])

    const [saldoBankInput, setSaldoBankInput] = useState('')
    const [loadingBalance, setLoadingBalance] = useState(false)
    const [savingBalance, setSavingBalance] = useState(false)
    const [filter, setFilter] = useState('semua')

    const today = new Date()
    const [selectedBulan, setSelectedBulan] = useState(BULAN_OPTIONS[today.getMonth() + 1])
    const [selectedTahun, setSelectedTahun] = useState({ value: today.getFullYear(), label: String(today.getFullYear()) })

    const uid = typeof window !== 'undefined' ? localStorage.getItem('userUid') : null

    const fetchData = useCallback(async () => {
        if (!uid) { setLoading(false); return }
        setLoading(true)
        try {
            const [bsSnap, rbsSnap, lpjSnap] = await Promise.all([
                getDocs(query(collection(db, 'bonSementara'), where('user.uid', '==', uid))),
                getDocs(query(collection(db, 'reimbursement'), where('user.uid', '==', uid))),
                getDocs(query(collection(db, 'lpj'), where('user.uid', '==', uid)))
            ])
            setBsDocs(bsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
            setRbsDocs(rbsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
            setLpjDocs(lpjSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('Error fetching data Mutasi Dana:', error)
            toast.error('Gagal mengambil data Mutasi Dana')
        } finally {
            setLoading(false)
        }
    }, [uid])

    useEffect(() => { fetchData() }, [fetchData])

    // Opsi Tahun dibangun dinamis dari tahun yang benar-benar ada di data
    // (pola sama dengan BsTable.jsx/dll), ditambah "Semua Tahun" di awal.
    const tahunOptions = useMemo(() => {
        const years = new Set([today.getFullYear()])
        ;[...bsDocs, ...rbsDocs, ...lpjDocs].forEach((item) => {
            const y = new Date(item.tanggalPengajuan || 0).getFullYear()
            if (!Number.isNaN(y) && y > 1970) years.add(y)
        })
        const sorted = Array.from(years).sort((a, b) => b - a)
        return [{ value: null, label: 'Semua Tahun' }, ...sorted.map((y) => ({ value: y, label: String(y) }))]
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bsDocs, rbsDocs, lpjDocs])

    const isAllTime = selectedBulan?.value == null && selectedTahun?.value == null
    const matchesPeriod = useCallback((isoDate) => {
        if (isAllTime) return true
        const d = new Date(isoDate || 0)
        if (selectedBulan?.value != null && d.getMonth() !== selectedBulan.value) return false
        if (selectedTahun?.value != null && d.getFullYear() !== selectedTahun.value) return false
        return true
    }, [isAllTime, selectedBulan, selectedTahun])

    // Bagian BW: Saldo Bank disimpan PER PERIODE (bukan satu angka tunggal
    // lagi) -- docId mutasiDanaSaldoBank diberi akhiran periode supaya tiap
    // kombinasi bulan/tahun (atau "ALL" untuk tampilan kumulatif) punya
    // angka sendiri-sendiri. Lihat firestore.rules -- pola uid-prefix sama
    // dengan /drafts/{draftId}.
    const periodKey = `${selectedBulan?.value == null ? 'ALL' : String(selectedBulan.value + 1).padStart(2, '0')}-${selectedTahun?.value == null ? 'ALL' : selectedTahun.value}`
    const saldoBankDocId = uid ? `${uid}_${periodKey}` : null

    useEffect(() => {
        if (!saldoBankDocId) return
        let cancelled = false
        setLoadingBalance(true)
        setSaldoBankInput('')
        getDoc(doc(db, 'mutasiDanaSaldoBank', saldoBankDocId))
            .then((snap) => {
                if (cancelled) return
                setSaldoBankInput(snap.exists() ? String(snap.data().saldoBank ?? '') : '')
            })
            .catch((error) => console.error('Error fetching saldo bank:', error))
            .finally(() => { if (!cancelled) setLoadingBalance(false) })
        return () => { cancelled = true }
    }, [saldoBankDocId])

    // Turunkan daftar transaksi dari BS/RBS/LPJ milik user -- lihat catatan
    // skop di atas komponen ini untuk penjelasan tiap jenis baris.
    // Bagian BU: koreksi dari user -- hanya uang yang BENAR-BENAR sudah
    // berpindah yang masuk hitungan saldo/ledger, supaya tidak ada selisih
    // palsu dibanding mutasi bank sungguhan:
    // - BS/RBS Disetujui TAPI belum dicentang "Transferred" -> BELUM dihitung
    //   sebagai uang masuk (dipindah ke "Menunggu Konfirmasi", ada tombol
    //   centang di sana, ikut field `transferred` yang sama dengan yang
    //   dipakai ReimbursementTable.jsx -- lihat canMarkTransferred() di
    //   firestore.rules, sudah generik untuk semua koleksi workflow sehingga
    //   tidak perlu rule baru).
    // - Pengembalian sisa lebih LPJ yang BELUM valid/terverifikasi -> BELUM
    //   dihitung sebagai uang keluar (dipindah ke "Menunggu Konfirmasi" juga,
    //   tanpa tombol -- konfirmasinya lewat alur upload bukti yang sudah ada).
    const { allRows, allPending } = useMemo(() => {
        const rows = []
        const pending = []

        bsDocs.forEach((item) => {
            if (item.status !== 'Disetujui') return
            const amount = item.bonSementara?.[0]?.jumlahBS || 0
            if (item.transferred) {
                rows.push({
                    id: `bs-${item.id}`,
                    date: item.transferredAt || getApprovalTimestamp(item),
                    ket: 'BS Disetujui',
                    doc: item.displayId,
                    src: 'bs',
                    in: amount,
                    out: 0,
                    link: `/bon-sementara/${item.id}`
                })
            } else {
                pending.push({
                    id: `pending-bs-${item.id}`,
                    date: getApprovalTimestamp(item),
                    ket: 'BS Disetujui, uang belum dikonfirmasi masuk',
                    doc: item.displayId,
                    src: 'bs',
                    amount, direction: 'in',
                    link: `/bon-sementara/${item.id}`,
                    confirmCollection: 'bonSementara', confirmId: item.id
                })
            }
        })

        rbsDocs.forEach((item) => {
            if (item.status !== 'Disetujui') return
            const amount = item.totalBiaya || 0
            if (item.transferred) {
                rows.push({
                    id: `rbs-${item.id}`,
                    date: item.transferredAt || getApprovalTimestamp(item),
                    ket: 'Reimbursement Disetujui',
                    doc: item.displayId,
                    src: 'rbs',
                    in: amount,
                    out: 0,
                    link: `/reimbursement/${item.id}`
                })
            } else {
                pending.push({
                    id: `pending-rbs-${item.id}`,
                    date: getApprovalTimestamp(item),
                    ket: 'Reimbursement Disetujui, uang belum dikonfirmasi masuk',
                    doc: item.displayId,
                    src: 'rbs',
                    amount, direction: 'in',
                    link: `/reimbursement/${item.id}`,
                    confirmCollection: 'reimbursement', confirmId: item.id
                })
            }
        })

        lpjDocs.forEach((item) => {
            if (HIDDEN_LPJ_STATUSES.includes(item.status)) return

            // Uang yang sudah dibelanjakan pakai dana BS -- sudah terjadi
            // secara fisik begitu LPJ dibuat, tidak perlu konfirmasi tambahan.
            rows.push({
                id: `lpj-${item.id}`,
                date: item.tanggalPengajuan,
                ket: `LPJ ${item.nomorBS ? '- ' + item.nomorBS : ''}`.trim(),
                doc: item.displayId,
                src: 'lpj',
                in: 0,
                out: item.totalBiaya || 0,
                link: `/lpj/${item.id}`
            })

            const sisaLebih = Number(item.sisaLebih) || 0
            if (sisaLebih > 0) {
                const done = item.pengembalianStatus === 'valid' || item.pengembalianStatus === 'grandfathered'
                if (done) {
                    rows.push({
                        id: `lpj-${item.id}-pengembalian`,
                        date: item.pengembalianUploadedAt || item.tanggalPengajuan,
                        ket: 'Sisa LPJ dikembalikan ke kas',
                        doc: item.displayId,
                        src: 'lpj',
                        in: 0,
                        out: sisaLebih,
                        link: `/lpj/${item.id}`,
                        flag: 'good'
                    })
                } else {
                    pending.push({
                        id: `pending-lpj-${item.id}-pengembalian`,
                        date: item.tanggalPengajuan,
                        ket: 'Sisa LPJ belum dikembalikan/terverifikasi',
                        doc: item.displayId,
                        src: 'lpj',
                        amount: sisaLebih, direction: 'out',
                        link: `/lpj/${item.id}`
                    })
                }
            }

            const sisaKurang = Number(item.sisaKurang) || 0
            if (sisaKurang > 0) {
                rows.push({
                    id: `lpj-${item.id}-kurang`,
                    date: item.tanggalPengajuan,
                    ket: 'Kekurangan LPJ dibayar ke Anda',
                    doc: item.displayId,
                    src: 'lpj',
                    in: sisaKurang,
                    out: 0,
                    link: `/lpj/${item.id}`
                })
            }
        })

        rows.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
        return { allRows: rows, allPending: pending }
    }, [bsDocs, rbsDocs, lpjDocs])

    // Bagian BW: saldo berjalan dihitung ULANG dari 0 khusus untuk transaksi
    // DI DALAM periode yang dipilih (bukan kumulatif sejak awal) -- siklus
    // BS/LPJ memang bulanan, jadi "saldo" yang berguna adalah pergerakan
    // bersih bulan itu, bukan akumulasi sepanjang masa. Kalau "Semua Bulan"
    // + "Semua Tahun" dipilih, ini otomatis jadi saldo kumulatif sungguhan
    // (matchesPeriod selalu true, seluruh riwayat masuk, saldo tetap
    // berjalan terus seperti versi sebelumnya).
    const { transactions, pendingItems } = useMemo(() => {
        const periodRows = allRows.filter((r) => matchesPeriod(r.date))
        let running = 0
        periodRows.forEach((r) => { running += r.in - r.out; r.saldo = running })
        const periodPending = allPending.filter((p) => matchesPeriod(p.date))
        return { transactions: periodRows, pendingItems: periodPending }
    }, [allRows, allPending, matchesPeriod])

    const totalMasuk = useMemo(() => transactions.reduce((sum, r) => sum + r.in, 0), [transactions])
    const totalKeluar = useMemo(() => transactions.reduce((sum, r) => sum + r.out, 0), [transactions])
    const saldoSistem = totalMasuk - totalKeluar

    const [confirmingId, setConfirmingId] = useState(null)
    const handleConfirmTransferred = async (pendingItem) => {
        setConfirmingId(pendingItem.id)
        try {
            await updateDoc(doc(db, pendingItem.confirmCollection, pendingItem.confirmId), {
                transferred: true,
                transferredAt: new Date().toISOString()
            })
            toast.success('Ditandai sebagai sudah masuk')
            await fetchData()
        } catch (error) {
            console.error('Error confirming transferred:', error)
            toast.error('Gagal menandai sudah masuk')
        } finally {
            setConfirmingId(null)
        }
    }

    // Bagian BV: field "Transferred" baru ada mulai sekarang -- BS/RBS lama
    // yang sebenarnya sudah lama settle ikut nongol di "Menunggu Konfirmasi"
    // cuma karena belum pernah ditandai, bukan karena benar-benar belum
    // masuk. Daripada user klik satu-satu, sediakan tombol borongan khusus
    // untuk transaksi SEBELUM bulan berjalan -- transaksi bulan ini tetap
    // perlu dicek manual satu-satu (uangnya baru/masih mungkin benar-benar
    // belum masuk). transferredAt diisi tanggal APPROVAL aslinya (bukan hari
    // ini) supaya urutan di buku besar tetap sesuai kronologi sungguhan.
    const currentMonthStart = useMemo(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), 1)
    }, [])

    // Dihitung dari allPending (BUKAN pendingItems yang sudah difilter
    // periode) -- tombol borongan ini urusan maintenance data lintas waktu,
    // independen dari periode yang sedang dilihat di layar.
    const oldPendingBsRbs = useMemo(
        () => allPending.filter((p) => p.confirmCollection && p.date && new Date(p.date) < currentMonthStart),
        [allPending, currentMonthStart]
    )

    const [bulkConfirming, setBulkConfirming] = useState(false)
    const handleBulkConfirmOld = async () => {
        if (oldPendingBsRbs.length === 0) return
        setBulkConfirming(true)
        try {
            await Promise.all(oldPendingBsRbs.map((p) =>
                updateDoc(doc(db, p.confirmCollection, p.confirmId), {
                    transferred: true,
                    transferredAt: p.date
                })
            ))
            toast.success(`${oldPendingBsRbs.length} transaksi sebelum bulan ini ditandai sudah masuk`)
            await fetchData()
        } catch (error) {
            console.error('Error bulk confirming transferred:', error)
            toast.error('Gagal menandai transaksi lama')
        } finally {
            setBulkConfirming(false)
        }
    }

    const saldoBankNumber = saldoBankInput === '' ? null : Number(saldoBankInput.replace(/[^\d-]/g, ''))
    const selisih = saldoBankNumber === null ? null : saldoBankNumber - saldoSistem

    const handleSaldoBankChange = (e) => {
        const digits = e.target.value.replace(/[^\d]/g, '')
        setSaldoBankInput(digits)
    }

    const handleSaldoBankBlur = async () => {
        if (!saldoBankDocId || saldoBankInput === '') return
        setSavingBalance(true)
        try {
            await setDoc(doc(db, 'mutasiDanaSaldoBank', saldoBankDocId), {
                saldoBank: Number(saldoBankInput) || 0,
                updatedAt: new Date().toISOString()
            })
        } catch (error) {
            console.error('Error saving saldo bank:', error)
            toast.error('Gagal menyimpan saldo bank')
        } finally {
            setSavingBalance(false)
        }
    }

    const visibleTransactions = useMemo(() => {
        const sorted = transactions.slice().reverse()
        if (filter === 'masuk') return sorted.filter((r) => r.in > 0)
        if (filter === 'keluar') return sorted.filter((r) => r.out > 0)
        return sorted
    }, [transactions, filter])

    const srcBadgeClass = {
        bs: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        rbs: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
        lpj: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
    }
    const srcLabel = { bs: 'BS', rbs: 'RBS', lpj: 'LPJ' }

    const selectStyles = {
        control: (base) => ({
            ...base,
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            fontSize: '13px',
            minHeight: '36px',
            borderRadius: '8px'
        }),
        singleValue: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        input: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        placeholder: (base) => ({ ...base, color: isDark ? '#9ca3af' : '#6b7280' }),
        menu: (base) => ({ ...base, zIndex: 100, backgroundColor: isDark ? '#1f2937' : '#ffffff' }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        option: (base, state) => ({
            ...base,
            fontSize: '13px',
            backgroundColor: isDark
                ? (state.isSelected ? '#374151' : state.isFocused ? '#2d3748' : '#1f2937')
                : base.backgroundColor,
            color: isDark ? '#f3f4f6' : base.color
        })
    }

    if (loading) {
        return (
            <div className="container mx-auto py-10 md:py-8">
                <Skeleton height={28} width={260} className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Skeleton height={90} />
                    <Skeleton height={90} />
                    <Skeleton height={90} />
                </div>
                <Skeleton count={6} height={44} className="mb-2" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
                <h2 className="text-xl font-bold dark:text-gray-100">Mutasi Dana Bon Sementara</h2>
                <div className="flex gap-2">
                    <div className="w-36">
                        <Select
                            options={BULAN_OPTIONS}
                            value={selectedBulan}
                            onChange={setSelectedBulan}
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                            isSearchable={false}
                        />
                    </div>
                    <div className="w-32">
                        <Select
                            options={tahunOptions}
                            value={selectedTahun}
                            onChange={setSelectedTahun}
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                            isSearchable={false}
                        />
                    </div>
                </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-2xl">
                {isAllTime
                    ? 'Menampilkan SEMUA periode (kumulatif sejak awal).'
                    : `Menampilkan periode ${selectedBulan?.value != null ? BULAN_OPTIONS[selectedBulan.value + 1].label : 'semua bulan'} ${selectedTahun?.value != null ? selectedTahun.value : '(semua tahun)'} -- Saldo Sistem & Selisih dihitung khusus untuk periode ini. Pilih "Semua Bulan" + "Semua Tahun" untuk lihat kumulatif.`}
            </p>

            {pendingItems.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3 mb-5 text-sm text-gray-800 dark:text-gray-100">
                    <div className="flex items-start gap-3 mb-2">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 mt-0.5 w-4 h-4 flex-shrink-0" />
                        <div className="flex-1">
                            <strong>{pendingItems.length} transaksi {isAllTime ? '' : 'di periode ini '}menunggu konfirmasi</strong> -- belum dihitung di Saldo Sistem supaya tidak selisih dengan mutasi bank sungguhan.
                        </div>
                    </div>
                    {oldPendingBsRbs.length > 0 && (
                        <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-md px-3 py-2 mb-2 ml-7">
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                                {oldPendingBsRbs.length} transaksi dari sebelum bulan berjalan (lintas semua periode, bukan cuma yang sedang ditampilkan) kemungkinan besar sudah settle, cuma belum pernah ditandai.
                            </span>
                            <button
                                onClick={handleBulkConfirmOld}
                                disabled={bulkConfirming}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex-shrink-0"
                            >
                                <FontAwesomeIcon icon={faCircleCheck} className="w-3 h-3" />
                                {bulkConfirming ? 'Memproses...' : `Tandai ${oldPendingBsRbs.length} Transaksi Lama Sudah Masuk`}
                            </button>
                        </div>
                    )}
                    <ul className="divide-y divide-amber-200 dark:divide-amber-800">
                        {pendingItems.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-3 py-2 pl-7">
                                <div>
                                    <Link to={p.link} className="font-medium hover:underline">{p.ket}</Link>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {p.doc} &middot; {p.direction === 'in' ? 'Masuk' : 'Keluar'} {formatRupiah(p.amount)}
                                    </div>
                                </div>
                                {p.confirmCollection ? (
                                    <button
                                        onClick={() => handleConfirmTransferred(p)}
                                        disabled={confirmingId === p.id}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 flex-shrink-0"
                                    >
                                        <FontAwesomeIcon icon={faMoneyBillWave} className="w-3 h-3" />
                                        {confirmingId === p.id ? 'Menyimpan...' : 'Tandai Sudah Masuk'}
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">Upload bukti transfer di LPJ</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Saldo Menurut Sistem</div>
                    <div className="text-2xl font-bold mt-1 dark:text-gray-100 tabular-nums">{formatRupiah(saldoSistem)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Masuk {formatRupiah(totalMasuk)} &minus; Keluar {formatRupiah(totalKeluar)}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Saldo Menurut Bank <span className="normal-case font-normal">(isi manual)</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-lg text-gray-400 dark:text-gray-500 font-semibold">Rp</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={saldoBankInput === '' ? '' : Number(saldoBankInput).toLocaleString('id-ID')}
                            onChange={handleSaldoBankChange}
                            onBlur={handleSaldoBankBlur}
                            placeholder={loadingBalance ? '...' : '0'}
                            disabled={loadingBalance}
                            className="text-2xl font-bold bg-transparent outline-none w-full dark:text-gray-100 tabular-nums focus:text-blue-600 dark:focus:text-blue-400 disabled:opacity-50"
                        />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {loadingBalance ? 'Memuat...' : savingBalance ? 'Menyimpan...' : `Untuk periode ${isAllTime ? 'semua' : (selectedBulan?.label || 'semua') + ' ' + (selectedTahun?.label || '')} -- cek dari mutasi rekening, lalu ketik di sini.`}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Selisih</div>
                        {selisih !== null && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                selisih === 0
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}>
                                <FontAwesomeIcon icon={selisih === 0 ? faCircleCheck : faCircleExclamation} className="w-3 h-3" />
                                {selisih === 0 ? 'Cocok' : 'Cek'}
                            </span>
                        )}
                    </div>
                    <div className="text-2xl font-bold mt-1 dark:text-gray-100 tabular-nums">
                        {selisih === null ? '-' : formatRupiah(selisih)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {selisih === null
                            ? 'Isi saldo bank dulu di atas'
                            : selisih === 0
                                ? 'Saldo sistem & bank sudah sama'
                                : selisih > 0 ? 'Bank lebih besar dari sistem' : 'Sistem lebih besar dari bank'}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
                <div className="inline-flex bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-1 gap-1">
                    {[
                        { value: 'semua', label: 'Semua' },
                        { value: 'masuk', label: 'Masuk Saja' },
                        { value: 'keluar', label: 'Keluar Saja' }
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                                filter === opt.value
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{visibleTransactions.length} transaksi</span>
            </div>

            {visibleTransactions.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Belum ada transaksi BS/RBS/LPJ yang Disetujui.
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/60 text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                    <th className="px-4 py-2 font-semibold">Tanggal</th>
                                    <th className="px-4 py-2 font-semibold">Keterangan</th>
                                    <th className="px-4 py-2 font-semibold">Sumber</th>
                                    <th className="px-4 py-2 font-semibold text-right">Masuk</th>
                                    <th className="px-4 py-2 font-semibold text-right">Keluar</th>
                                    <th className="px-4 py-2 font-semibold text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTransactions.map((r) => (
                                    <tr key={r.id} className="border-t dark:border-gray-700">
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-300 tabular-nums">{formatDate(r.date)}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1.5 font-medium dark:text-gray-100">
                                                {r.flag === 'good' && <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 w-3.5 h-3.5 flex-shrink-0" title="Bukti pengembalian sudah terverifikasi" />}
                                                <Link to={r.link} className="hover:underline">{r.ket}</Link>
                                            </div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{r.doc}</div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex text-xs font-bold px-1.5 py-0.5 rounded border ${srcBadgeClass[r.src]}`}>
                                                {srcLabel[r.src]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
                                            {r.in > 0 ? (
                                                <span className="text-green-600 dark:text-green-400">
                                                    <FontAwesomeIcon icon={faArrowUp} className="w-2.5 h-2.5 mr-1" />
                                                    {formatRupiah(r.in)}
                                                </span>
                                            ) : <span className="text-gray-300 dark:text-gray-600">&ndash;</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">
                                            {r.out > 0 ? (
                                                <span className="text-gray-500 dark:text-gray-400">
                                                    <FontAwesomeIcon icon={faArrowDown} className="w-2.5 h-2.5 mr-1" />
                                                    {formatRupiah(r.out)}
                                                </span>
                                            ) : <span className="text-gray-300 dark:text-gray-600">&ndash;</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">{formatRupiah(r.saldo)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 border-t dark:border-gray-700">
                        Urut dari transaksi terbaru. Hanya uang yang sudah benar-benar berpindah (BS/RBS tercentang "Transferred", pengembalian LPJ sudah terverifikasi) yang dihitung di sini -- lihat bagian "Menunggu Konfirmasi" di atas untuk yang belum. Tanda <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 w-3 h-3 mx-0.5" /> = pengembalian LPJ sudah terverifikasi.
                    </div>
                </div>
            )}
        </div>
    )
}

export default MutasiDana
