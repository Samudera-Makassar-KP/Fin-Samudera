import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import Select from 'react-select'
import { useTheme } from '../context/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faPen, faTrash, faArrowRight } from '@fortawesome/free-solid-svg-icons'

// Bagian CA: "Catat Nota" -- input cepat nota RBS/LPJ begitu diterima,
// menumpuk jadi draft (koleksi `notaDraft`), lalu "dirangkai" jadi pengajuan
// RBS/LPJ sungguhan: draft LPJ dirangkai dari halaman Detail BS (lihat
// DetailBs.jsx), draft RBS dirangkai dari tombol di halaman ini. SENGAJA
// tidak membangun jalur upload/merge lampiran baru -- data nota (nominal/
// kategori/keterangan/tanggal) jadi BARIS ITEM yang sudah terisi di form
// FormLpjUmum/FormLpjMarketing/FormRbsUmum yang SUDAH ADA (lewat
// location.state), supaya lampiran foto tetap lewat jalur upload yang sudah
// terbukti jalan -- tidak perlu ubah storage.rules/Cloud Functions sama
// sekali. Lihat mockup yang disetujui user: https://claude.ai/artifact/G5dz7t3284Qd3SZF4PhZGH

const HIDDEN_LPJ_STATUSES_FOR_BS = ['Ditolak', 'Dibatalkan']
const formatRupiah = (n) => 'Rp' + Math.round(Math.abs(n || 0)).toLocaleString('id-ID')
const todayIso = () => new Date().toISOString().split('T')[0]
const formatDate = (iso) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CatatNota = () => {
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const uid = typeof window !== 'undefined' ? localStorage.getItem('userUid') : null

    const [loading, setLoading] = useState(true)
    const [bsList, setBsList] = useState([])
    const [notas, setNotas] = useState([])

    const [jenis, setJenis] = useState(null) // 'rbs' | 'lpj'
    const [editingId, setEditingId] = useState(null) // id notaDraft yang sedang diedit, null = buat baru
    const [selectedBsId, setSelectedBsId] = useState(null)
    const [nominal, setNominal] = useState('')
    const [kategori, setKategori] = useState('')
    const [keterangan, setKeterangan] = useState('')
    const [tanggal, setTanggal] = useState(todayIso())
    const [saving, setSaving] = useState(false)

    const fetchData = useCallback(async () => {
        if (!uid) { setLoading(false); return }
        setLoading(true)
        try {
            const [bsSnap, lpjSnap, notaSnap] = await Promise.all([
                getDocs(query(collection(db, 'bonSementara'), where('user.uid', '==', uid), where('status', '==', 'Disetujui'))),
                getDocs(query(collection(db, 'lpj'), where('user.uid', '==', uid))),
                getDocs(query(collection(db, 'notaDraft'), where('user.uid', '==', uid)))
            ])
            // BS yang sudah punya LPJ (selain Ditolak/Dibatalkan) dianggap
            // sudah "dipakai"/sedang dilaporkan -- tidak ditawarkan lagi di
            // dropdown pemilihan BS, sama seperti isLpjApproved di DetailBs.jsx
            // tapi dilonggarkan: di sini cukup ADA LPJ non-ditolak, tidak harus
            // sudah Disetujui, supaya tidak dobel-rangkai sambil LPJ-nya masih
            // diproses reviewer.
            const nomorBsTerpakai = new Set(
                lpjSnap.docs
                    .map((d) => d.data())
                    .filter((d) => !HIDDEN_LPJ_STATUSES_FOR_BS.includes(d.status))
                    .map((d) => d.nomorBS)
            )
            const bs = bsSnap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((item) => !nomorBsTerpakai.has(item.bonSementara?.[0]?.nomorBS))
            setBsList(bs)
            setNotas(notaSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('Error fetching data Catat Nota:', error)
            toast.error('Gagal mengambil data')
        } finally {
            setLoading(false)
        }
    }, [uid])

    useEffect(() => { fetchData() }, [fetchData])

    const bsOptions = useMemo(() => bsList.map((b) => ({
        value: b.id,
        label: `${b.bonSementara?.[0]?.nomorBS || b.displayId} -- ${b.bonSementara?.[0]?.kategori || ''}`
    })), [bsList])

    const sisaDana = useCallback((bsId, excludeNotaId) => {
        const bs = bsList.find((b) => b.id === bsId)
        if (!bs) return 0
        const jumlahBS = Number(bs.bonSementara?.[0]?.jumlahBS) || 0
        const terpakaiDraft = notas
            .filter((n) => n.jenis === 'lpj' && n.bsId === bsId && n.id !== excludeNotaId)
            .reduce((sum, n) => sum + (Number(n.nominal) || 0), 0)
        return jumlahBS - terpakaiDraft
    }, [bsList, notas])

    const sisaPreview = useMemo(() => {
        if (jenis !== 'lpj' || !selectedBsId) return null
        const n = Number((nominal || '0').toString().replace(/[^\d]/g, '')) || 0
        return sisaDana(selectedBsId, editingId) - n
    }, [jenis, selectedBsId, nominal, editingId, sisaDana])

    const resetForm = () => {
        setEditingId(null)
        setNominal('')
        setKategori('')
        setKeterangan('')
        setTanggal(todayIso())
    }

    const pilihJenis = (j) => {
        setJenis(j)
        resetForm()
        if (j === 'lpj' && bsOptions.length > 0) setSelectedBsId(bsOptions[0].value)
    }

    const mulaiEdit = (nota) => {
        setJenis(nota.jenis)
        setEditingId(nota.id)
        setSelectedBsId(nota.bsId || null)
        setNominal(String(nota.nominal || ''))
        setKategori(nota.kategori || '')
        setKeterangan(nota.keterangan || '')
        setTanggal(nota.tanggal || todayIso())
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const hapusNota = async (nota) => {
        if (!window.confirm('Hapus nota ini?')) return
        try {
            await deleteDoc(doc(db, 'notaDraft', nota.id))
            toast.success('Nota dihapus')
            if (editingId === nota.id) resetForm()
            await fetchData()
        } catch (error) {
            console.error('Error deleting nota:', error)
            toast.error('Gagal menghapus nota')
        }
    }

    const simpanNota = async () => {
        const nominalNumber = Number((nominal || '0').toString().replace(/[^\d]/g, ''))
        if (!nominalNumber || nominalNumber <= 0) { toast.warning('Isi nominal dulu'); return }
        if (!kategori.trim()) { toast.warning('Isi kategori/jenis pengeluaran dulu'); return }
        if (jenis === 'lpj' && !selectedBsId) { toast.warning('Pilih BS dulu'); return }

        setSaving(true)
        try {
            const bs = jenis === 'lpj' ? bsList.find((b) => b.id === selectedBsId) : null
            const payload = {
                user: { uid },
                jenis,
                bsId: jenis === 'lpj' ? selectedBsId : null,
                nomorBS: jenis === 'lpj' ? (bs?.bonSementara?.[0]?.nomorBS || null) : null,
                nominal: nominalNumber,
                kategori: kategori.trim(),
                keterangan: keterangan.trim(),
                tanggal,
                updatedAt: new Date().toISOString()
            }
            if (editingId) {
                await updateDoc(doc(db, 'notaDraft', editingId), payload)
                toast.success('Nota diperbarui')
            } else {
                await addDoc(collection(db, 'notaDraft'), { ...payload, createdAt: new Date().toISOString() })
                toast.success('Nota tersimpan')
            }
            resetForm()
            await fetchData()
        } catch (error) {
            console.error('Error saving nota:', error)
            toast.error('Gagal menyimpan nota')
        } finally {
            setSaving(false)
        }
    }

    const rbsDraft = useMemo(() => notas.filter((n) => n.jenis === 'rbs'), [notas])
    const lpjByBs = useMemo(() => {
        const map = {}
        notas.filter((n) => n.jenis === 'lpj').forEach((n) => {
            if (!map[n.bsId]) map[n.bsId] = []
            map[n.bsId].push(n)
        })
        return map
    }, [notas])

    // Bagian CA: "merangkai" draft RBS jadi pengajuan RBS sungguhan -- navigasi
    // ke form RBS Umum yang SUDAH ADA dengan baris item pre-filled dari nota,
    // user tinggal cek/lengkapi lampiran lalu submit seperti biasa. Hanya
    // varian "Umum" yang didukung di v1 -- RBS BBM/Operasional (plat/liter
    // kendaraan) butuh field yang tidak mungkin diisi dari nota saja, jadi
    // untuk kasus itu tetap pakai form RBS biasa secara langsung.
    const rangkaiRbs = () => {
        if (rbsDraft.length === 0) return
        navigate('/reimbursement/umum', {
            state: {
                prefillRbsItems: rbsDraft.map((n) => ({ nominal: n.nominal, kategori: n.kategori, keterangan: n.keterangan, tanggal: n.tanggal })),
                prefillNotaDraftIds: rbsDraft.map((n) => n.id)
            }
        })
    }

    const selectStyles = {
        control: (base) => ({ ...base, backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#4b5563' : '#e5e7eb', fontSize: '13px', minHeight: '38px', borderRadius: '8px' }),
        singleValue: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        input: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        placeholder: (base) => ({ ...base, color: isDark ? '#9ca3af' : '#6b7280' }),
        menu: (base) => ({ ...base, zIndex: 100, backgroundColor: isDark ? '#1f2937' : '#ffffff' }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        option: (base, state) => ({ ...base, fontSize: '13px', backgroundColor: isDark ? (state.isSelected ? '#374151' : state.isFocused ? '#2d3748' : '#1f2937') : base.backgroundColor, color: isDark ? '#f3f4f6' : base.color })
    }

    if (loading) {
        return (
            <div className="container mx-auto py-10 md:py-8">
                <Skeleton height={28} width={220} className="mb-4" />
                <Skeleton height={140} className="mb-4" />
                <Skeleton count={3} height={60} className="mb-2" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 md:py-8 max-w-3xl">
            <h2 className="text-xl font-bold dark:text-gray-100 mb-1">Catat Nota</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xl">Input cepat setiap nota begitu diterima -- menumpuk jadi draft, nanti dirangkai jadi RBS/LPJ saat sudah siap submit.</p>

            {/* Pilih jenis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <button
                    onClick={() => pilihJenis('rbs')}
                    className={`text-left p-4 rounded-lg border-2 transition ${jenis === 'rbs' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                >
                    <div className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 mb-2">RBS</div>
                    <div className="text-sm font-semibold dark:text-gray-100">Reimbursement</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bayar pakai uang pribadi dulu, tidak terkait BS.</div>
                </button>
                <button
                    onClick={() => pilihJenis('lpj')}
                    className={`text-left p-4 rounded-lg border-2 transition ${jenis === 'lpj' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-green-300'}`}
                >
                    <div className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 mb-2">LPJ</div>
                    <div className="text-sm font-semibold dark:text-gray-100">Pakai Dana BS</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Belanja pakai sisa Bon Sementara yang sudah cair.</div>
                </button>
            </div>

            {/* Form nota */}
            {jenis && (
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 shadow-sm mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold dark:text-gray-100">{editingId ? 'Edit Nota' : 'Nota Baru'} -- {jenis === 'rbs' ? 'RBS' : 'LPJ'}</h3>
                        {editingId && <button onClick={resetForm} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">Batal edit</button>}
                    </div>

                    {jenis === 'lpj' && (
                        <div className="mb-3">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Pilih BS</label>
                            {bsOptions.length === 0 ? (
                                <p className="text-xs text-amber-600 dark:text-amber-400">Tidak ada BS Disetujui yang belum dilaporkan.</p>
                            ) : (
                                <>
                                    <Select
                                        options={bsOptions}
                                        value={bsOptions.find((o) => o.value === selectedBsId) || null}
                                        onChange={(opt) => setSelectedBsId(opt?.value || null)}
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                        menuPosition="absolute"
                                        isSearchable={false}
                                    />
                                    {selectedBsId && (
                                        <div className="mt-2 flex items-center justify-between bg-gray-50 dark:bg-gray-900/40 border dark:border-gray-700 rounded-md px-3 py-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Sisa dana BS ini</span>
                                            <span className={`text-sm font-bold tabular-nums ${sisaPreview >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {formatRupiah(sisaPreview)}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Nominal</label>
                            <input
                                type="text" inputMode="decimal" value={nominal ? Number(nominal).toLocaleString('id-ID') : ''}
                                onChange={(e) => setNominal(e.target.value.replace(/[^\d]/g, ''))}
                                placeholder="150.000"
                                className="w-full text-sm border dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Tanggal Nota</label>
                            <input
                                type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                                className="w-full text-sm border dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Kategori / Jenis Pengeluaran</label>
                            <input
                                type="text" value={kategori} onChange={(e) => setKategori(e.target.value)}
                                placeholder="contoh: Transportasi, BBM, Entertain Client"
                                className="w-full text-sm border dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Keterangan</label>
                            <input
                                type="text" value={keterangan} onChange={(e) => setKeterangan(e.target.value)}
                                placeholder="contoh: Grab ke kantor klien"
                                className="w-full text-sm border dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Foto nota dilampirkan nanti saat merangkai jadi RBS/LPJ (lampiran digabung otomatis di form itu seperti biasa).</p>

                    <button
                        onClick={simpanNota}
                        disabled={saving || (jenis === 'lpj' && bsOptions.length === 0)}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={editingId ? faPen : faPlus} className="w-3.5 h-3.5" />
                        {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Nota'}
                    </button>
                </div>
            )}

            {/* Draft RBS */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-bold dark:text-gray-100">Draft RBS <span className="text-gray-400 font-normal">(belum disubmit)</span></h3>
                    {rbsDraft.length > 0 && (
                        <button onClick={rangkaiRbs} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                            Rangkai jadi RBS ({rbsDraft.length} item) <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                        </button>
                    )}
                </div>
                {rbsDraft.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Belum ada nota RBS tersimpan.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rbsDraft.map((n) => (
                            <div key={n.id} className="flex items-center justify-between gap-3 px-3 py-2 border dark:border-gray-700 rounded-md">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium dark:text-gray-100 truncate">{n.kategori}{n.keterangan ? ` -- ${n.keterangan}` : ''}</div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">{formatDate(n.tanggal)}</div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm font-semibold tabular-nums dark:text-gray-100">{formatRupiah(n.nominal)}</span>
                                    <button onClick={() => mulaiEdit(n)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><FontAwesomeIcon icon={faPen} className="w-3 h-3" /></button>
                                    <button onClick={() => hapusNota(n)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"><FontAwesomeIcon icon={faTrash} className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Per BS */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 shadow-sm">
                <h3 className="text-sm font-bold dark:text-gray-100 mb-3">Nota LPJ per Bon Sementara</h3>
                {Object.keys(lpjByBs).length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Belum ada nota LPJ tersimpan.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {Object.entries(lpjByBs).map(([bsId, list]) => {
                            const bs = bsList.find((b) => b.id === bsId)
                            const total = list.reduce((s, n) => s + n.nominal, 0)
                            return (
                                <div key={bsId} className="border dark:border-gray-700 rounded-md p-3">
                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                        <div className="text-sm font-semibold dark:text-gray-100">{bs?.bonSementara?.[0]?.nomorBS || bsId}</div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{list.length} nota &middot; total {formatRupiah(total)} &middot; sisa <span className={sisaDana(bsId) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{formatRupiah(sisaDana(bsId))}</span></span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {list.map((n) => (
                                            <div key={n.id} className="flex items-center justify-between gap-3 text-xs">
                                                <span className="text-gray-600 dark:text-gray-300 truncate">{n.kategori}{n.keterangan ? ` -- ${n.keterangan}` : ''} ({formatDate(n.tanggal)})</span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="font-semibold tabular-nums dark:text-gray-200">{formatRupiah(n.nominal)}</span>
                                                    <button onClick={() => mulaiEdit(n)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><FontAwesomeIcon icon={faPen} className="w-2.5 h-2.5" /></button>
                                                    <button onClick={() => hapusNota(n)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"><FontAwesomeIcon icon={faTrash} className="w-2.5 h-2.5" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Buka halaman Detail BS untuk merangkai nota-nota ini jadi LPJ.</p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default CatatNota
