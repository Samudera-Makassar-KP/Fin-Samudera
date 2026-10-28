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
import { BBM_PRICE_PER_LITER } from '../constants/bbmPrice'

// Bagian CC: koreksi dari user -- item nota disamakan dengan field form
// RBS/LPJ ASLI (dropdown jenis per varian, bukan kategori bebas teks) +
// bisa tambah beberapa item sekaligus sebelum disimpan, supaya lebih
// familiar untuk user yang sudah biasa pakai form RBS/LPJ. Daftar jenis di
// bawah disalin APA ADANYA dari masing-masing form (FormRbsUmum.jsx,
// FormRbsOperasional.jsx, FormRbsBbm.jsx, FormLpjUmum.jsx,
// FormLpjMarketing.jsx) -- kalau form aslinya berubah, daftar ini ikut
// disesuaikan manual (belum ada satu sumber bersama di codebase ini).
const RBS_VARIANTS = {
    umum: {
        label: 'GA/Umum',
        route: '/reimbursement/umum',
        jenisOptions: [
            { value: 'ATK', label: 'ATK' },
            { value: 'RTG', label: 'RTG' },
            { value: 'RTK', label: 'RTK' },
            { value: 'Entertaint', label: 'Entertaint' },
            { value: 'Parkir', label: 'Parkir' },
            { value: 'E-Toll', label: 'E-Toll' },
            { value: 'BBM Pertalite', label: 'BBM Pertalite' },
            { value: 'BBM Pertamax', label: 'BBM Pertamax' },
            { value: 'BBM Pertamax Turbo', label: 'BBM Pertamax Turbo' },
            { value: 'BBM Solar', label: 'BBM Solar' },
            { value: 'Meals Lembur', label: 'Meals Lembur' },
            { value: 'Meals Meeting', label: 'Meals Meeting' },
            { value: 'CSR', label: 'CSR' },
            { value: 'Utilitas', label: 'Utilitas' },
            { value: 'Fasilitas', label: 'Fasilitas' },
            { value: 'IT M&R', label: 'IT M&R' },
            { value: 'Lainnya', label: 'Lainnya' }
        ]
    },
    operasional: {
        label: 'Operasional',
        route: '/reimbursement/operasional',
        jenisOptions: [
            { value: 'BBM Pertalite', label: 'BBM Pertalite' },
            { value: 'BBM Pertamax', label: 'BBM Pertamax' },
            { value: 'Meeting', label: 'Meeting' },
            { value: 'Entertaint', label: 'Entertaint' },
            { value: 'Parkir', label: 'Parkir' },
            { value: 'Biaya Buruh', label: 'Biaya Buruh' },
            { value: 'Meal Buruh', label: 'Meal Buruh' },
            { value: 'Meal Lembur', label: 'Meal Lembur' },
            { value: 'Lainnya', label: 'Lainnya' }
        ]
    },
    bbm: {
        label: 'BBM',
        route: '/reimbursement/bbm',
        jenisOptions: [
            { value: 'BBM Pertalite', label: 'BBM Pertalite' },
            { value: 'BBM Pertamax', label: 'BBM Pertamax' },
            { value: 'BBM Pertamax Turbo', label: 'BBM Pertamax Turbo' },
            { value: 'BBM Solar', label: 'BBM Solar' },
            { value: 'BBM Dexlite', label: 'BBM Dexlite' },
            { value: 'Lainnya', label: 'Lainnya' }
        ]
    }
}

const LPJ_JENIS_BY_KATEGORI = {
    'GA/Umum': RBS_VARIANTS.umum.jenisOptions,
    'Marketing/Operasional': RBS_VARIANTS.operasional.jenisOptions
}

const HIDDEN_LPJ_STATUSES_FOR_BS = ['Ditolak', 'Dibatalkan']
// Bagian BB (lihat BsTable.jsx/DashboardSummary.jsx): nomorBS di LPJ dulu
// kolom teks bebas -- normalisasi (trim+uppercase) sebelum dicocokkan
// supaya beda spasi/kapitalisasi tetap ketemu.
const normalizeNomorBS = (value) => (value || '').toString().trim().toUpperCase()
const formatRupiah = (n) => 'Rp' + Math.round(Math.abs(n || 0)).toLocaleString('id-ID')
const todayIso = () => new Date().toISOString().split('T')[0]
const formatDate = (iso) => {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
const parseDigits = (value) => Number((value || '0').toString().replace(/[^\d]/g, '')) || 0

const emptyRow = () => ({
    namaItemOption: null,
    isLainnya: false,
    jenisLain: '',
    biaya: '',
    jumlah: '',
    liter: '',
    item: '',
    keterangan: '',
    lokasi: '',
    plat: '',
    tanggal: todayIso()
})

const isBbmRow = (row) => !row.isLainnya && !!BBM_PRICE_PER_LITER[row.namaItemOption?.value]

const CatatNota = () => {
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const uid = typeof window !== 'undefined' ? localStorage.getItem('userUid') : null

    const [loading, setLoading] = useState(true)
    const [bsList, setBsList] = useState([])
    const [notas, setNotas] = useState([])

    const [jenis, setJenis] = useState(null) // 'rbs' | 'lpj'
    const [rbsVariant, setRbsVariant] = useState(null) // 'umum' | 'operasional' | 'bbm'
    const [selectedBsId, setSelectedBsId] = useState(null)
    const [rows, setRows] = useState([emptyRow()])
    const [editingId, setEditingId] = useState(null)
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
            const nomorBsTerpakai = new Set(
                lpjSnap.docs
                    .map((d) => d.data())
                    .filter((d) => !HIDDEN_LPJ_STATUSES_FOR_BS.includes(d.status))
                    .map((d) => normalizeNomorBS(d.nomorBS))
            )
            // Bagian CE: koreksi dari user -- satu dokumen BS bisa punya LEBIH
            // DARI SATU item (nomorBS/jumlahBS berbeda-beda, lihat FormBs.jsx
            // `multipleItems`). Sebelumnya cuma item pertama (`bonSementara[0]`)
            // yang ditawarkan di sini -- item ke-2 dst (mis. nomorBS "...508"
            // dalam dokumen yang displayId-nya "...507") tidak pernah muncul
            // sebagai pilihan BS sama sekali. Sekarang setiap item di-flatten
            // jadi entri BS tersendiri (id = `${docId}__${index}`), masing-
            // masing dicek & dikecualikan terpisah kalau sudah ada LPJ-nya.
            const bs = []
            bsSnap.docs.forEach((d) => {
                const data = d.data()
                const items = data.bonSementara?.length ? data.bonSementara : []
                items.forEach((item, index) => {
                    if (nomorBsTerpakai.has(normalizeNomorBS(item.nomorBS))) return
                    bs.push({
                        id: `${d.id}__${index}`,
                        nomorBS: item.nomorBS,
                        jumlahBS: Number(item.jumlahBS) || 0,
                        kategori: item.kategori || ''
                    })
                })
            })
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
        label: `${b.nomorBS} -- ${b.kategori}`
    })), [bsList])

    const selectedBs = bsList.find((b) => b.id === selectedBsId)
    const lpjKategori = selectedBs?.kategori || null
    const jenisOptions = jenis === 'rbs'
        ? (rbsVariant ? RBS_VARIANTS[rbsVariant].jenisOptions : [])
        : (lpjKategori ? (LPJ_JENIS_BY_KATEGORI[lpjKategori] || RBS_VARIANTS.umum.jenisOptions) : [])

    const sisaDana = useCallback((bsId, excludeNotaId) => {
        const bs = bsList.find((b) => b.id === bsId)
        if (!bs) return 0
        const jumlahBS = bs.jumlahBS
        const terpakaiDraft = notas
            .filter((n) => n.jenis === 'lpj' && n.bsId === bsId && n.id !== excludeNotaId)
            .reduce((sum, n) => sum + (Number(n.jumlahBiaya) || 0), 0)
        return jumlahBS - terpakaiDraft
    }, [bsList, notas])

    const resetRows = () => {
        setRows([emptyRow()])
        setEditingId(null)
    }

    const pilihJenis = (j) => {
        setJenis(j)
        setRbsVariant(null)
        resetRows()
    }

    const pilihRbsVariant = (v) => {
        setRbsVariant(v)
        resetRows()
    }

    const updateRow = (index, patch) => {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    }

    const handleNamaItemChange = (index, selectedOption) => {
        if (!selectedOption || selectedOption.value === 'Lainnya') {
            updateRow(index, { namaItemOption: null, isLainnya: true, jenisLain: '', liter: '', biaya: jenis === 'lpj' ? '' : rows[index].biaya })
            return
        }
        const bbmPrice = BBM_PRICE_PER_LITER[selectedOption.value]
        if (jenis === 'rbs') {
            // RBS: biaya = TOTAL yang dikeluarkan (user input), liter cuma info
            // turunan dari biaya/harga -- pola identik FormRbsUmum.jsx.
            const biayaNumber = parseDigits(rows[index].biaya)
            const liter = bbmPrice && biayaNumber ? (biayaNumber / bbmPrice).toFixed(2) : rows[index].liter
            updateRow(index, { namaItemOption: selectedOption, isLainnya: false, jenisLain: '', liter: bbmPrice ? liter : '' })
        } else {
            // LPJ: biaya = harga satuan (auto kalau BBM), jumlah = kuantitas/liter,
            // jumlahBiaya = biaya x jumlah -- pola identik FormLpjUmum.jsx.
            updateRow(index, {
                namaItemOption: selectedOption,
                isLainnya: false,
                jenisLain: '',
                biaya: bbmPrice ? String(bbmPrice) : rows[index].biaya
            })
        }
    }

    const handleBiayaChange = (index, value) => {
        const digits = value.replace(/[^\d]/g, '')
        const row = rows[index]
        if (jenis === 'rbs' && isBbmRow(row)) {
            const price = BBM_PRICE_PER_LITER[row.namaItemOption.value]
            const liter = price && digits ? (Number(digits) / price).toFixed(2) : ''
            updateRow(index, { biaya: digits, liter })
        } else {
            updateRow(index, { biaya: digits })
        }
    }

    const addRow = () => setRows((prev) => [...prev, emptyRow()])
    const removeRow = (index) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

    const mulaiEdit = (nota) => {
        setJenis(nota.jenis)
        if (nota.jenis === 'rbs') setRbsVariant(nota.rbsVariant)
        if (nota.jenis === 'lpj') setSelectedBsId(nota.bsId)
        setEditingId(nota.id)
        setRows([{
            namaItemOption: nota.isLainnya ? null : { value: nota.namaItem, label: nota.namaItem },
            isLainnya: nota.isLainnya,
            jenisLain: nota.jenisLain || '',
            biaya: String(nota.biaya || ''),
            jumlah: String(nota.jumlah || ''),
            liter: String(nota.jumlah || ''),
            item: nota.item || '',
            keterangan: nota.keterangan || '',
            lokasi: nota.lokasi || '',
            plat: nota.plat || '',
            tanggal: nota.tanggal || todayIso()
        }])
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const hapusNota = async (nota) => {
        if (!window.confirm('Hapus nota ini?')) return
        try {
            await deleteDoc(doc(db, 'notaDraft', nota.id))
            toast.success('Nota dihapus')
            if (editingId === nota.id) resetRows()
            await fetchData()
        } catch (error) {
            console.error('Error deleting nota:', error)
            toast.error('Gagal menghapus nota')
        }
    }

    const validateRows = () => {
        for (const row of rows) {
            if (!row.isLainnya && !row.namaItemOption) { toast.warning('Pilih jenis dulu untuk setiap item'); return false }
            if (row.isLainnya && !row.jenisLain.trim()) { toast.warning('Isi jenis (Lainnya) dulu untuk setiap item'); return false }
            if (!parseDigits(row.biaya)) { toast.warning('Isi biaya dulu untuk setiap item'); return false }
            if (jenis === 'rbs' && rbsVariant === 'bbm' && !row.lokasi.trim()) { toast.warning('Isi lokasi dulu untuk setiap item BBM'); return false }
            if (jenis === 'rbs' && rbsVariant !== 'bbm' && !isBbmRow(row) && !row.item.trim() && !row.keterangan.trim()) { toast.warning('Isi Item/Keterangan dulu untuk setiap baris'); return false }
            if (jenis === 'lpj' && !parseDigits(row.jumlah)) { toast.warning('Isi jumlah dulu untuk setiap item'); return false }
            if ((rbsVariant === 'bbm' || isBbmRow(row)) && !row.plat.trim()) { toast.warning('Isi plat kendaraan dulu untuk item BBM'); return false }
            if (!row.tanggal) { toast.warning('Isi tanggal dulu untuk setiap item'); return false }
        }
        if (jenis === 'lpj' && !selectedBsId) { toast.warning('Pilih BS dulu'); return false }
        return true
    }

    const rowToPayload = (row) => {
        const biaya = parseDigits(row.biaya)
        const jumlah = jenis === 'lpj' ? parseDigits(row.jumlah) : (parseDigits(row.liter) || 1)
        const jumlahBiaya = jenis === 'lpj' ? biaya * jumlah : biaya
        return {
            user: { uid },
            jenis,
            rbsVariant: jenis === 'rbs' ? rbsVariant : null,
            bsId: jenis === 'lpj' ? selectedBsId : null,
            nomorBS: jenis === 'lpj' ? (selectedBs?.nomorBS || null) : null,
            lpjKategori: jenis === 'lpj' ? lpjKategori : null,
            namaItem: row.isLainnya ? null : (row.namaItemOption?.value || null),
            isLainnya: row.isLainnya,
            jenisLain: row.isLainnya ? row.jenisLain.trim() : '',
            biaya,
            jumlah,
            jumlahBiaya,
            keterangan: row.keterangan.trim() || row.item.trim(),
            item: row.item.trim() || row.keterangan.trim(),
            plat: row.plat.trim(),
            lokasi: row.lokasi.trim(),
            tanggal: row.tanggal,
            updatedAt: new Date().toISOString()
        }
    }

    const simpanSemua = async () => {
        if (jenis === 'rbs' && !rbsVariant) { toast.warning('Pilih jenis RBS dulu (GA/Umum, Operasional, atau BBM)'); return }
        if (!validateRows()) return

        setSaving(true)
        try {
            if (editingId) {
                await updateDoc(doc(db, 'notaDraft', editingId), rowToPayload(rows[0]))
                toast.success('Nota diperbarui')
            } else {
                await Promise.all(rows.map((row) =>
                    addDoc(collection(db, 'notaDraft'), { ...rowToPayload(row), createdAt: new Date().toISOString() })
                ))
                toast.success(`${rows.length} nota tersimpan`)
            }
            resetRows()
            await fetchData()
        } catch (error) {
            console.error('Error saving nota:', error)
            toast.error('Gagal menyimpan nota')
        } finally {
            setSaving(false)
        }
    }

    const rbsDraftByVariant = useMemo(() => {
        const map = { umum: [], operasional: [], bbm: [] }
        notas.filter((n) => n.jenis === 'rbs').forEach((n) => { if (map[n.rbsVariant]) map[n.rbsVariant].push(n) })
        return map
    }, [notas])

    const lpjByBs = useMemo(() => {
        const map = {}
        notas.filter((n) => n.jenis === 'lpj').forEach((n) => {
            if (!map[n.bsId]) map[n.bsId] = []
            map[n.bsId].push(n)
        })
        return map
    }, [notas])

    // Bagian CC: "merangkai" draft RBS per varian jadi pengajuan RBS
    // sungguhan -- navigasi ke form yang sesuai (GA/Umum, Operasional, atau
    // BBM) dengan baris item pre-filled, field-per-field meniru skema
    // reimbursements form aslinya masing-masing.
    const rangkaiRbs = (variant) => {
        const list = rbsDraftByVariant[variant]
        if (!list || list.length === 0) return
        navigate(RBS_VARIANTS[variant].route, {
            state: {
                prefillRbsItems: list.map((n) => ({
                    isLainnya: n.isLainnya,
                    namaItem: n.namaItem,
                    jenisLain: n.jenisLain,
                    biaya: n.biaya,
                    liter: n.jumlah,
                    item: n.item,
                    keterangan: n.keterangan,
                    lokasi: n.lokasi,
                    plat: n.plat,
                    tanggal: n.tanggal
                })),
                prefillNotaDraftIds: list.map((n) => n.id)
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

    const inputClass = 'w-full text-sm border dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:text-gray-100'
    const labelClass = 'text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1'

    if (loading) {
        return (
            <div className="container mx-auto py-10 md:py-8">
                <Skeleton height={28} width={220} className="mb-4" />
                <Skeleton height={140} className="mb-4" />
                <Skeleton count={3} height={60} className="mb-2" />
            </div>
        )
    }

    const renderRow = (row, index) => {
        const bbm = isBbmRow(row)
        const showBbmFields = jenis === 'rbs' ? (rbsVariant === 'bbm' || bbm) : bbm
        return (
            <div key={index} className="border dark:border-gray-700 rounded-md p-4 mb-3 relative">
                {rows.length > 1 && (
                    <button onClick={() => removeRow(index)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                        <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                    </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                        <label className={labelClass}>Jenis</label>
                        {row.isLainnya ? (
                            <input
                                type="text" value={row.jenisLain}
                                onChange={(e) => updateRow(index, { jenisLain: e.target.value })}
                                placeholder="Ketik jenis pengeluaran"
                                className={inputClass}
                            />
                        ) : (
                            <Select
                                options={jenisOptions}
                                value={row.namaItemOption}
                                onChange={(opt) => handleNamaItemChange(index, opt)}
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="absolute"
                                isSearchable={false}
                                placeholder="Pilih jenis..."
                            />
                        )}
                        {row.isLainnya && (
                            <button onClick={() => updateRow(index, { isLainnya: false, jenisLain: '' })} className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Pilih dari daftar
                            </button>
                        )}
                    </div>

                    <div>
                        <label className={labelClass}>{jenis === 'rbs' ? 'Biaya (Total)' : 'Biaya (Harga Satuan)'}</label>
                        <input
                            type="text" inputMode="decimal"
                            value={row.biaya ? Number(row.biaya).toLocaleString('id-ID') : ''}
                            onChange={(e) => handleBiayaChange(index, e.target.value)}
                            placeholder="150.000"
                            className={inputClass}
                        />
                    </div>

                    {jenis === 'lpj' && (
                        <div>
                            <label className={labelClass}>{bbm ? 'Liter' : 'Jumlah'}</label>
                            <input
                                type="text" inputMode="decimal" value={row.jumlah}
                                onChange={(e) => updateRow(index, { jumlah: e.target.value.replace(/[^\d.,]/g, '') })}
                                placeholder={bbm ? 'mis. 10,5' : '1'}
                                className={inputClass}
                            />
                        </div>
                    )}

                    {jenis === 'rbs' && bbm && (
                        <div>
                            <label className={labelClass}>Liter (otomatis)</label>
                            <input
                                type="text" inputMode="decimal" value={row.liter}
                                onChange={(e) => updateRow(index, { liter: e.target.value.replace(/[^\d.,]/g, '') })}
                                className={inputClass}
                            />
                        </div>
                    )}

                    {showBbmFields && (
                        <div>
                            <label className={labelClass}>Plat Kendaraan</label>
                            <input
                                type="text" value={row.plat}
                                onChange={(e) => updateRow(index, { plat: e.target.value.toUpperCase() })}
                                placeholder="mis. DD 1234 AB"
                                className={inputClass}
                            />
                        </div>
                    )}

                    {jenis === 'rbs' && rbsVariant === 'bbm' ? (
                        <div className="sm:col-span-2">
                            <label className={labelClass}>Lokasi</label>
                            <input
                                type="text" value={row.lokasi}
                                onChange={(e) => updateRow(index, { lokasi: e.target.value })}
                                placeholder="contoh: SPBU Pertamina Jl. Sudirman"
                                className={inputClass}
                            />
                        </div>
                    ) : jenis === 'rbs' && !bbm ? (
                        <div className="sm:col-span-2">
                            <label className={labelClass}>Item</label>
                            <input
                                type="text" value={row.item}
                                onChange={(e) => updateRow(index, { item: e.target.value })}
                                placeholder="contoh: Bensin mobil operasional"
                                className={inputClass}
                            />
                        </div>
                    ) : null}

                    <div className={jenis === 'rbs' && !bbm ? '' : 'sm:col-span-2'}>
                        <label className={labelClass}>Keterangan</label>
                        <input
                            type="text" value={row.keterangan}
                            onChange={(e) => updateRow(index, { keterangan: e.target.value })}
                            placeholder="opsional"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Tanggal</label>
                        <input
                            type="date" value={row.tanggal}
                            onChange={(e) => updateRow(index, { tanggal: e.target.value })}
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 md:py-8 max-w-3xl">
            <h2 className="text-xl font-bold dark:text-gray-100 mb-1">Catat Nota</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xl">Input cepat setiap nota begitu diterima -- formatnya sama dengan form RBS/LPJ yang biasa dipakai. Menumpuk jadi draft, nanti dirangkai jadi RBS/LPJ saat sudah siap submit.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
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

            {jenis === 'rbs' && (
                <div className="flex gap-2 mb-4">
                    {Object.entries(RBS_VARIANTS).map(([key, v]) => (
                        <button
                            key={key}
                            onClick={() => pilihRbsVariant(key)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${rbsVariant === key ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            )}

            {jenis === 'lpj' && (
                <div className="mb-4">
                    <label className={labelClass}>Pilih BS</label>
                    {bsOptions.length === 0 ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Tidak ada BS Disetujui yang belum dilaporkan.</p>
                    ) : (
                        <>
                            <Select
                                options={bsOptions}
                                value={bsOptions.find((o) => o.value === selectedBsId) || null}
                                onChange={(opt) => { setSelectedBsId(opt?.value || null); resetRows() }}
                                styles={selectStyles}
                                menuPortalTarget={document.body}
                                menuPosition="absolute"
                                isSearchable={false}
                            />
                            {selectedBsId && (
                                <div className="mt-2 flex items-center justify-between bg-gray-50 dark:bg-gray-900/40 border dark:border-gray-700 rounded-md px-3 py-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Sisa dana BS ini ({lpjKategori})</span>
                                    <span className={`text-sm font-bold tabular-nums ${sisaDana(selectedBsId, editingId) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatRupiah(sisaDana(selectedBsId, editingId))}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {jenis && (jenis === 'lpj' ? selectedBsId : rbsVariant) && (
                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 shadow-sm mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold dark:text-gray-100">{editingId ? 'Edit Nota' : 'Nota Baru'}</h3>
                        {editingId && <button onClick={resetRows} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">Batal edit</button>}
                    </div>

                    {rows.map((row, index) => renderRow(row, index))}

                    <div className="flex items-center gap-2 flex-wrap">
                        {!editingId && (
                            <button onClick={addRow} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                                <FontAwesomeIcon icon={faPlus} className="w-3 h-3" /> Tambah Item
                            </button>
                        )}
                        <button
                            onClick={simpanSemua}
                            disabled={saving}
                            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={editingId ? faPen : faPlus} className="w-3.5 h-3.5" />
                            {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : `Simpan ${rows.length > 1 ? `${rows.length} Nota` : 'Nota'}`}
                        </button>
                    </div>
                </div>
            )}

            {/* Draft RBS per varian */}
            {['umum', 'operasional', 'bbm'].map((variant) => {
                const list = rbsDraftByVariant[variant]
                if (!list || list.length === 0) return null
                return (
                    <div key={variant} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 shadow-sm mb-6">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <h3 className="text-sm font-bold dark:text-gray-100">Draft RBS {RBS_VARIANTS[variant].label} <span className="text-gray-400 font-normal">(belum disubmit)</span></h3>
                            <button onClick={() => rangkaiRbs(variant)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                                Rangkai jadi RBS ({list.length} item) <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {list.map((n) => (
                                <div key={n.id} className="flex items-center justify-between gap-3 px-3 py-2 border dark:border-gray-700 rounded-md">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium dark:text-gray-100 truncate">{n.isLainnya ? n.jenisLain : n.namaItem}{n.item || n.keterangan ? ` -- ${n.item || n.keterangan}` : ''}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">{formatDate(n.tanggal)}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-sm font-semibold tabular-nums dark:text-gray-100">{formatRupiah(n.jumlahBiaya)}</span>
                                        <button onClick={() => mulaiEdit(n)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><FontAwesomeIcon icon={faPen} className="w-3 h-3" /></button>
                                        <button onClick={() => hapusNota(n)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"><FontAwesomeIcon icon={faTrash} className="w-3 h-3" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}

            {/* Per BS (LPJ) */}
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 shadow-sm">
                <h3 className="text-sm font-bold dark:text-gray-100 mb-3">Nota LPJ per Bon Sementara</h3>
                {Object.keys(lpjByBs).length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Belum ada nota LPJ tersimpan.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {Object.entries(lpjByBs).map(([bsId, list]) => {
                            const bs = bsList.find((b) => b.id === bsId)
                            const total = list.reduce((s, n) => s + n.jumlahBiaya, 0)
                            return (
                                <div key={bsId} className="border dark:border-gray-700 rounded-md p-3">
                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                        <div className="text-sm font-semibold dark:text-gray-100">{bs?.nomorBS || bsId}</div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{list.length} nota &middot; total {formatRupiah(total)} &middot; sisa <span className={sisaDana(bsId) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{formatRupiah(sisaDana(bsId))}</span></span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {list.map((n) => (
                                            <div key={n.id} className="flex items-center justify-between gap-3 text-xs">
                                                <span className="text-gray-600 dark:text-gray-300 truncate">{n.isLainnya ? n.jenisLain : n.namaItem}{n.keterangan ? ` -- ${n.keterangan}` : ''} ({formatDate(n.tanggal)})</span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="font-semibold tabular-nums dark:text-gray-200">{formatRupiah(n.jumlahBiaya)}</span>
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
