import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation, faCircleCheck, faArrowUp, faArrowDown, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'

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
    const [loading, setLoading] = useState(true)
    const [bsDocs, setBsDocs] = useState([])
    const [rbsDocs, setRbsDocs] = useState([])
    const [lpjDocs, setLpjDocs] = useState([])

    const [saldoBankInput, setSaldoBankInput] = useState('')
    const [savingBalance, setSavingBalance] = useState(false)
    const [filter, setFilter] = useState('semua')

    const uid = typeof window !== 'undefined' ? localStorage.getItem('userUid') : null

    const fetchData = useCallback(async () => {
        if (!uid) { setLoading(false); return }
        setLoading(true)
        try {
            const [bsSnap, rbsSnap, lpjSnap, saldoDoc] = await Promise.all([
                getDocs(query(collection(db, 'bonSementara'), where('user.uid', '==', uid))),
                getDocs(query(collection(db, 'reimbursement'), where('user.uid', '==', uid))),
                getDocs(query(collection(db, 'lpj'), where('user.uid', '==', uid))),
                getDoc(doc(db, 'mutasiDanaSaldoBank', uid))
            ])
            setBsDocs(bsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
            setRbsDocs(rbsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
            setLpjDocs(lpjSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
            if (saldoDoc.exists()) {
                setSaldoBankInput(String(saldoDoc.data().saldoBank ?? ''))
            }
        } catch (error) {
            console.error('Error fetching data Mutasi Dana:', error)
            toast.error('Gagal mengambil data Mutasi Dana')
        } finally {
            setLoading(false)
        }
    }, [uid])

    useEffect(() => { fetchData() }, [fetchData])

    // Turunkan daftar transaksi dari BS/RBS/LPJ milik user -- lihat catatan
    // skop di atas komponen ini untuk penjelasan tiap jenis baris.
    const transactions = useMemo(() => {
        const rows = []

        bsDocs.forEach((item) => {
            if (item.status !== 'Disetujui') return
            rows.push({
                id: `bs-${item.id}`,
                date: getApprovalTimestamp(item),
                ket: 'BS Disetujui',
                doc: item.displayId,
                src: 'bs',
                in: item.bonSementara?.[0]?.jumlahBS || 0,
                out: 0,
                link: `/bon-sementara/${item.id}`
            })
        })

        rbsDocs.forEach((item) => {
            if (item.status !== 'Disetujui') return
            rows.push({
                id: `rbs-${item.id}`,
                date: getApprovalTimestamp(item),
                ket: 'Reimbursement Disetujui',
                doc: item.displayId,
                src: 'rbs',
                in: item.totalBiaya || 0,
                out: 0,
                link: `/reimbursement/${item.id}`
            })
        })

        lpjDocs.forEach((item) => {
            if (HIDDEN_LPJ_STATUSES.includes(item.status)) return

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
                rows.push({
                    id: `lpj-${item.id}-pengembalian`,
                    date: item.tanggalPengajuan,
                    ket: 'Sisa LPJ dikembalikan ke kas',
                    doc: item.displayId,
                    src: 'lpj',
                    in: 0,
                    out: sisaLebih,
                    link: `/lpj/${item.id}`,
                    flag: done ? 'good' : 'warn'
                })
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
        let running = 0
        rows.forEach((r) => { running += r.in - r.out; r.saldo = running })
        return rows
    }, [bsDocs, rbsDocs, lpjDocs])

    const totalMasuk = useMemo(() => transactions.reduce((sum, r) => sum + r.in, 0), [transactions])
    const totalKeluar = useMemo(() => transactions.reduce((sum, r) => sum + r.out, 0), [transactions])
    const saldoSistem = totalMasuk - totalKeluar

    const pendingPengembalian = useMemo(
        () => transactions.filter((r) => r.flag === 'warn'),
        [transactions]
    )

    const saldoBankNumber = saldoBankInput === '' ? null : Number(saldoBankInput.replace(/[^\d-]/g, ''))
    const selisih = saldoBankNumber === null ? null : saldoBankNumber - saldoSistem

    const handleSaldoBankChange = (e) => {
        const digits = e.target.value.replace(/[^\d]/g, '')
        setSaldoBankInput(digits)
    }

    const handleSaldoBankBlur = async () => {
        if (!uid || saldoBankInput === '') return
        setSavingBalance(true)
        try {
            await setDoc(doc(db, 'mutasiDanaSaldoBank', uid), {
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
            <h2 className="text-xl font-bold dark:text-gray-100 mb-1">Mutasi Dana Bon Sementara</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-2xl">
                Uang masuk (BS &amp; Reimbursement cair) dan uang keluar (dipakai lewat LPJ) dari dana Bon Sementara Anda sendiri, dengan saldo berjalan -- supaya gampang dicocokkan dengan mutasi rekening bank.
            </p>

            {pendingPengembalian.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3 mb-5 text-sm text-gray-800 dark:text-gray-100">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 mt-0.5 w-4 h-4 flex-shrink-0" />
                    <div>
                        <strong>{pendingPengembalian.length} pengembalian LPJ</strong> senilai {formatRupiah(pendingPengembalian.reduce((s, r) => s + r.out, 0))} masih menunggu verifikasi bukti transfer -- lihat tanda seru di tabel di bawah.
                    </div>
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
                            placeholder="0"
                            className="text-2xl font-bold bg-transparent outline-none w-full dark:text-gray-100 tabular-nums focus:text-blue-600 dark:focus:text-blue-400"
                        />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {savingBalance ? 'Menyimpan...' : 'Cek dari mutasi rekening, lalu ketik di sini.'}
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
                                                {r.flag === 'warn' && <FontAwesomeIcon icon={faCircleExclamation} className="text-amber-500 w-3.5 h-3.5 flex-shrink-0" title="Bukti pengembalian belum diproses" />}
                                                {r.flag === 'good' && <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 w-3.5 h-3.5 flex-shrink-0" title="Bukti pengembalian sudah diproses" />}
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
                        Urut dari transaksi terbaru. Tanda <FontAwesomeIcon icon={faCircleExclamation} className="text-amber-500 w-3 h-3 mx-0.5" /> = bukti pengembalian belum diproses, <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 w-3 h-3 mx-0.5" /> = sudah valid.
                    </div>
                </div>
            )}
        </div>
    )
}

export default MutasiDana
