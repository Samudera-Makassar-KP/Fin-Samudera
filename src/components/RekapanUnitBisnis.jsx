import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import Select from 'react-select'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import html2canvas from 'html2canvas'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { db } from '../firebaseConfig'
import { useTheme } from '../context/ThemeContext'
import {
    MONTH_LABELS,
    sumMonths,
    aggregateByCategory,
    aggregateBbm,
    listBbmLineItems,
    listCategoryLineItems,
    listCategoryRawLabels,
    listAmbiguousBbmMentions
} from '../utils/rekapanAggregation'
import { SHARING_UNITS, PPNP_UNIT_NAME, computeAllEmployeeShares, computeProportionalSplit } from '../constants/rekapanSharing'

// Sama seperti BUSINESS_UNITS di FormBs.jsx -- daftar semua Unit Bisnis untuk opsi
// dropdown Admin/Super Admin ("Semua Unit Bisnis" melihat seluruhnya sekaligus).
const BUSINESS_UNITS = [
    { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
    { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
    { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
    { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
    { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
    { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
    { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
    { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' },
    { value: 'Samudera Indonesia', label: 'Samudera Indonesia' },
    { value: 'Panitia', label: 'Panitia' }
]

// Urutan tampil kategori yang diketahui (sesuai jenisOptions form RBS Umum/Operasional
// & LPJ Umum/Marketing yang sudah diseragamkan). Kategori tak dikenal (data lampau)
// tetap ditampilkan, disisipkan di akhir. Item berjenis BBM ("BBM ...") tidak pernah
// muncul di sini -- ditangani terpisah lewat tabel "BBM -- Total Biaya"/"BBM -- Liter
// per Plat Nomor" (lihat aggregateBbm).
const CATEGORY_ORDER = [
    'ATK', 'RTG', 'RTK',
    'Meals Meeting', 'Meeting',
    'Entertaint',
    'Meals Lembur', 'Meal Lembur',
    'Parkir', 'E-Toll', 'Toll',
    'Biaya Buruh', 'Meal Buruh',
    'Lainnya'
]

// Key sentinel untuk 2 tabel BBM (bukan kategori dinamis dari data) supaya bisa
// ikut difilter lewat dropdown "Tampilkan Rekapan" yang sama. Bagian AF sempat
// menghapus "BBM -- Total Biaya" (dianggap redundan dengan grup kategori custom
// "Kelola Kategori"), tapi ternyata itu BLIND SPOT: grup "Kelola Kategori" cuma
// bisa berisi item NON-BBM (lihat isBbmValue), jadi pengajuan BBM baru lewat
// form BBM resmi tidak akan PERNAH tampil di mana pun kalau tabel ini hilang.
// Bagian AH: dimunculkan lagi, judulnya diperjelas + diberi catatan supaya
// tidak disangka redundan dengan kategori custom lagi.
const BBM_TOTAL_KEY = '__BBM_TOTAL__'
const BBM_LITER_KEY = '__BBM_LITER__'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => ({ value: y, label: String(y) }))

// Filter "Bulan" (Bagian AB) -- default null = tampilkan semua 12 kolom bulan
// seperti sebelumnya. Pilih 1 bulan tertentu untuk mempersempit SEMUA tabel
// Rekapan (termasuk BBM) jadi cuma 1 kolom bulan itu -- dipakai bikin rekapan
// bulanan (mis. screenshot/export PNG per bulan) tanpa 11 kolom kosong lain.
const MONTH_FILTER_OPTIONS = [
    { value: null, label: 'Semua Bulan' },
    ...MONTH_LABELS.map((label, value) => ({ value, label }))
]

const RekapanUnitBisnis = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [isRoleLoaded, setIsRoleLoaded] = useState(false)
    const [role, setRole] = useState(null)
    const [ownUnits, setOwnUnits] = useState([])

    const [unitOptions, setUnitOptions] = useState([])
    const [selectedUnitOptions, setSelectedUnitOptions] = useState([])
    const [isUnitFilterOpen, setIsUnitFilterOpen] = useState(false)
    const [unitSearchText, setUnitSearchText] = useState('')
    const [selectedYear, setSelectedYear] = useState(YEAR_OPTIONS[0])
    const [selectedMonth, setSelectedMonth] = useState(MONTH_FILTER_OPTIONS[0])

    // Index bulan (0-11) yang ditampilkan di semua tabel -- "Semua Bulan" berarti
    // 12 kolom seperti sebelumnya, pilih 1 bulan berarti tabel cuma 1 kolom itu.
    const visibleMonthIndexes = useMemo(() => {
        return selectedMonth?.value == null ? MONTH_LABELS.map((_, i) => i) : [selectedMonth.value]
    }, [selectedMonth])

    const [isDataLoading, setIsDataLoading] = useState(true)
    const [reimbursementDocs, setReimbursementDocs] = useState([])
    const [lpjDocs, setLpjDocs] = useState([])

    // Ref per tabel (keyed by title) untuk export PNG -- diisi lewat callback
    // ref di elemen wrapper masing-masing tabel di renderCategoryTable/renderBbmLiterTable.
    const tableRefs = useRef({})
    const [exportingTitle, setExportingTitle] = useState(null)

    const handleExportPng = async (title) => {
        const el = tableRefs.current[title]
        if (!el) return

        setExportingTitle(title)
        try {
            const canvas = await html2canvas(el, {
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                scale: 2
            })

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
            if (!blob) throw new Error('Gagal membuat file PNG')

            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            const safeName = title.replace(/[^a-zA-Z0-9]+/g, '_')
            const monthSuffix = selectedMonth?.value != null ? `_${selectedMonth.label}` : ''
            link.href = url
            link.download = `Rekapan_${safeName}_${selectedYear?.value || ''}${monthSuffix}.png`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Gagal export tabel ke PNG:', error)
            toast.error('Gagal export tabel ke PNG')
        } finally {
            setExportingTitle(null)
        }
    }

    // 1. Ambil role & unit user login (pola sama seperti FormBs.jsx)
    useEffect(() => {
        const fetchUserRole = async () => {
            const uid = localStorage.getItem('userUid')
            if (!uid) {
                setIsRoleLoaded(true)
                return
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', uid))
                if (userDoc.exists()) {
                    const data = userDoc.data()
                    setRole(data.role || null)
                    setOwnUnits(Array.isArray(data.unit) ? data.unit : (data.unit ? [data.unit] : []))
                }
            } catch (error) {
                console.error('Gagal mengambil data role user:', error)
            } finally {
                setIsRoleLoaded(true)
            }
        }

        fetchUserRole()
    }, [])

    const isAdmin = role === 'Admin' || role === 'Super Admin'

    // 2. Susun opsi checkbox Unit Bisnis sesuai role -- Admin/Super Admin bisa
    // pilih kombinasi bebas (1, beberapa, atau semua) dari 10 Unit Bisnis,
    // Validator dibatasi ke unit yang ditugaskan ke akun mereka saja.
    // Kosong (default) berarti tampilkan SEMUA opsi yang tersedia, sama seperti
    // pola filter "Tampilkan Rekapan" yang sudah ada.
    useEffect(() => {
        if (!isRoleLoaded) return

        const options = isAdmin
            ? BUSINESS_UNITS
            : ownUnits.map((u) => ({ value: u, label: u }))

        setUnitOptions(options)
        setSelectedUnitOptions([])
    }, [isRoleLoaded, role, ownUnits, isAdmin])

    // 3. Fetch data reimbursement & lpj yang sudah Disetujui (sekali saja, filter
    // unit/tahun dilakukan di client -- pola sama seperti ReportExport.jsx)
    useEffect(() => {
        const fetchData = async () => {
            setIsDataLoading(true)
            try {
                const [reimbursementSnap, lpjSnap] = await Promise.all([
                    getDocs(query(collection(db, 'reimbursement'), where('status', '==', 'Disetujui'))),
                    getDocs(query(collection(db, 'lpj'), where('status', '==', 'Disetujui')))
                ])

                setReimbursementDocs(reimbursementSnap.docs.map((d) => ({ ...d.data(), id: d.id })))
                setLpjDocs(lpjSnap.docs.map((d) => ({ ...d.data(), id: d.id })))
            } catch (error) {
                console.error('Gagal mengambil data rekapan:', error)
            } finally {
                setIsDataLoading(false)
            }
        }

        fetchData()
    }, [])

    // 4. Roster headcount per unit (/rekapanHeadcount) -- dasar hitung persentase
    // sharing BBM MJS (pool "All Employee"). Bisa diedit Admin/Super Admin lewat
    // modal "Kelola Data Sharing BBM" (Bagian AD, dibuka dari kartu "Pengaturan
    // Rekapan" di bawah tabel).
    const [headcountByCode, setHeadcountByCode] = useState({})
    const [isHeadcountLoading, setIsHeadcountLoading] = useState(true)
    const [isEditingHeadcount, setIsEditingHeadcount] = useState(false)
    const [headcountDraft, setHeadcountDraft] = useState({})
    const [isSavingHeadcount, setIsSavingHeadcount] = useState(false)

    const fetchHeadcount = useCallback(async () => {
        setIsHeadcountLoading(true)
        try {
            const snapshot = await getDocs(collection(db, 'rekapanHeadcount'))
            const result = {}
            snapshot.docs.forEach((d) => {
                result[d.id] = Array.isArray(d.data()?.names) ? d.data().names : []
            })
            setHeadcountByCode(result)
        } catch (error) {
            console.error('Gagal mengambil data roster sharing BBM:', error)
        } finally {
            setIsHeadcountLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchHeadcount()
    }, [fetchHeadcount])

    const defaultPoolShares = useMemo(() => computeAllEmployeeShares(headcountByCode), [headcountByCode])

    // 5. Klasifikasi per-baris (/rekapanBbmSharing, Bagian U, diperluas ke RTK/RTG
    // di Bagian AC) -- baris mana yang genuinely "dibagi" ke unit lain, ditentukan
    // Admin/Super Admin satu per satu lewat panel "Kelola Sharing" (bukan asumsi
    // blanket seperti versi pertama Bagian T yang keliru). Baris tanpa entry di
    // sini TETAP 100% ke unit pengaju (default aman, lihat aggregateBbm/aggregateByCategory).
    // Nama koleksi Firestore tetap `rekapanBbmSharing` walau sekarang juga menampung
    // klasifikasi RTK/RTG (key sudah unik per docType+docId+itemIndex, tidak bentrok).
    const [sharingClassification, setSharingClassification] = useState({})
    const [isClassificationLoading, setIsClassificationLoading] = useState(true)

    const fetchClassification = useCallback(async () => {
        setIsClassificationLoading(true)
        try {
            const snapshot = await getDocs(collection(db, 'rekapanBbmSharing'))
            const result = {}
            snapshot.docs.forEach((d) => {
                result[d.id] = d.data()
            })
            setSharingClassification(result)
        } catch (error) {
            console.error('Gagal mengambil data klasifikasi sharing BBM:', error)
        } finally {
            setIsClassificationLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchClassification()
    }, [fetchClassification])

    // 6. Pengelompokan kategori Rekapan non-BBM (/rekapanCategoryGroups, Bagian AA)
    // -- beberapa label mentah (item.jenis/item.namaItem) yang sebenarnya sama
    // (mis. "Meeting"/"Biaya Meeting"/"Cemilan kue ruang meeting") digabung jadi
    // 1 kategori tampilan, ditentukan Admin/Super Admin lewat panel "Kelola
    // Kategori". Lihat canonicalizeCategoryLabel di rekapanCategoryGroups.js.
    const [categoryGroups, setCategoryGroups] = useState([])
    const [isCategoryGroupsLoading, setIsCategoryGroupsLoading] = useState(true)

    const fetchCategoryGroups = useCallback(async () => {
        setIsCategoryGroupsLoading(true)
        try {
            const snapshot = await getDocs(collection(db, 'rekapanCategoryGroups'))
            setCategoryGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('Gagal mengambil data pengelompokan kategori:', error)
        } finally {
            setIsCategoryGroupsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCategoryGroups()
    }, [fetchCategoryGroups])

    // Panel "Kelola Kategori" (Admin/Super Admin only)
    const [isManagingCategories, setIsManagingCategories] = useState(false)
    const [categorySearchText, setCategorySearchText] = useState('')
    const [newGroupLabel, setNewGroupLabel] = useState('')
    const [newGroupSelected, setNewGroupSelected] = useState({})
    const [isSavingGroup, setIsSavingGroup] = useState(false)

    const rawCategoryLabels = useMemo(() => {
        return listCategoryRawLabels(reimbursementDocs, lpjDocs)
    }, [reimbursementDocs, lpjDocs])

    const saveCategoryGroup = async (groupId, data) => {
        await setDoc(doc(db, 'rekapanCategoryGroups', groupId), data)
    }

    // Kalau nama grup yang diketik cocok (case-insensitive) dengan grup yang
    // sudah ada, label yang dicentang DITAMBAHKAN ke grup itu (bukan bikin grup
    // duplikat) -- supaya Admin bisa merapikan variasi baru yang muncul belakangan
    // tanpa perlu UI "tambah anggota" terpisah.
    const createOrExtendCategoryGroup = async () => {
        const label = newGroupLabel.trim()
        const members = Object.keys(newGroupSelected).filter((k) => newGroupSelected[k])
        if (!label || members.length === 0) {
            toast.error('Pilih minimal 1 kategori dan isi nama grup')
            return
        }

        setIsSavingGroup(true)
        try {
            const existing = categoryGroups.find((g) => g.label.toLowerCase() === label.toLowerCase())
            if (existing) {
                const mergedMembers = Array.from(new Set([...(existing.members || []), ...members]))
                await saveCategoryGroup(existing.id, { label: existing.label, members: mergedMembers })
                setCategoryGroups((prev) => prev.map((g) => (g.id === existing.id ? { ...g, members: mergedMembers } : g)))
                toast.success(`Ditambahkan ke grup "${existing.label}"`)
            } else {
                const ref = doc(collection(db, 'rekapanCategoryGroups'))
                const data = { label, members }
                await saveCategoryGroup(ref.id, data)
                setCategoryGroups((prev) => [...prev, { id: ref.id, ...data }])
                toast.success('Grup kategori dibuat')
            }
            setNewGroupLabel('')
            setNewGroupSelected({})
        } catch (error) {
            console.error('Gagal menyimpan grup kategori:', error)
            toast.error('Gagal menyimpan grup kategori')
        } finally {
            setIsSavingGroup(false)
        }
    }

    const removeMemberFromGroup = async (groupId, member) => {
        const group = categoryGroups.find((g) => g.id === groupId)
        if (!group) return
        const members = (group.members || []).filter((m) => m !== member)
        try {
            await saveCategoryGroup(groupId, { label: group.label, members })
            setCategoryGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, members } : g)))
        } catch (error) {
            console.error('Gagal memperbarui anggota grup kategori:', error)
            toast.error('Gagal memperbarui anggota grup')
        }
    }

    const deleteCategoryGroup = async (groupId) => {
        try {
            await deleteDoc(doc(db, 'rekapanCategoryGroups', groupId))
            setCategoryGroups((prev) => prev.filter((g) => g.id !== groupId))
            toast.success('Grup kategori dihapus')
        } catch (error) {
            console.error('Gagal menghapus grup kategori:', error)
            toast.error('Gagal menghapus grup kategori')
        }
    }

    // Panel kurasi "Kelola Sharing" (Admin/Super Admin only, Bagian AC awalnya
    // BBM-only lalu diperluas ke RTK/RTG, Bagian AE menghilangkan batasannya
    // sama sekali -- SEMUA kategori sekarang bisa displit per-baris ke unit
    // lain, bukan cuma daftar tetap) -- daftar SEMUA baris tahun berjalan
    // (tidak terpengaruh filter Unit Bisnis di atas, Admin perlu lihat semua
    // unit untuk klasifikasi), Validator tidak pernah melihat panel ini sama
    // sekali (cuma lihat hasil akhir di tabel).
    const [isManagingSharing, setIsManagingSharing] = useState(false)
    const [sharingCategoryFilter, setSharingCategoryFilter] = useState('')
    const [sharingUnitFilter, setSharingUnitFilter] = useState('')
    const [showReviewedItems, setShowReviewedItems] = useState(false)
    const [customEditKey, setCustomEditKey] = useState(null)
    const [customEditDraft, setCustomEditDraft] = useState({})
    const [customEditIncluded, setCustomEditIncluded] = useState({})
    const [savingItemKey, setSavingItemKey] = useState(null)
    const [sharingPage, setSharingPage] = useState(1)
    const SHARING_PAGE_SIZE = 25

    // allBbmLineItems & allCategoryLineItems dipertahankan TERPISAH (bukan 1
    // fungsi) karena sumber & bentuk data mentahnya beda (BBM dari isBbmValue
    // prefix, kategori lain dari canonicalizeCategoryLabel) -- keduanya dipakai
    // baik oleh panel "Kelola Sharing" (digabung lewat allShareableLineItems)
    // MAUPUN drill-down per kategori (Bagian AE, lihat drillDownItems) supaya
    // klik sel tabel APAPUN kategorinya membuka rincian transaksi yang sama.
    const allBbmLineItems = useMemo(() => {
        return listBbmLineItems(reimbursementDocs, lpjDocs, { year: selectedYear.value, sharingClassification })
    }, [reimbursementDocs, lpjDocs, selectedYear, sharingClassification])

    // `categories` SENGAJA di-OMIT (bukan array) supaya SEMUA kategori non-BBM
    // ikut tersedia untuk sharing & drill-down, bukan cuma RTK/RTG seperti versi
    // sebelumnya -- lihat listCategoryLineItems di rekapanAggregation.js.
    const allCategoryLineItems = useMemo(() => {
        return listCategoryLineItems(reimbursementDocs, lpjDocs, {
            year: selectedYear.value,
            categoryGroups
        })
    }, [reimbursementDocs, lpjDocs, selectedYear, categoryGroups])

    // Gabungan BBM + semua kategori lain -- dasar panel "Kelola Sharing".
    const allShareableLineItems = useMemo(() => {
        return [...allBbmLineItems, ...allCategoryLineItems].sort((a, b) => a.month - b.month)
    }, [allBbmLineItems, allCategoryLineItems])

    const visibleShareableLineItems = useMemo(() => {
        return allShareableLineItems.filter((item) => {
            if (sharingCategoryFilter && item.category !== sharingCategoryFilter) return false
            if (sharingUnitFilter && item.unit !== sharingUnitFilter) return false
            const isReviewed = Boolean(sharingClassification[item.key])
            if (!showReviewedItems && isReviewed) return false
            return true
        })
    }, [allShareableLineItems, sharingCategoryFilter, sharingUnitFilter, showReviewedItems, sharingClassification])

    const pagedShareableLineItems = useMemo(() => {
        const start = (sharingPage - 1) * SHARING_PAGE_SIZE
        return visibleShareableLineItems.slice(start, start + SHARING_PAGE_SIZE)
    }, [visibleShareableLineItems, sharingPage])

    const totalSharingPages = Math.max(1, Math.ceil(visibleShareableLineItems.length / SHARING_PAGE_SIZE))

    // Panel "Tinjau Item BBM Ambigu" (Bagian AJ, Admin/Super Admin only) --
    // item RTG/ATK/GA-Umum/LPJ lain yang keterangannya menyebut "bbm" tapi
    // BELUM pernah digabung ke grup mana pun lewat "Kelola Kategori" (grup
    // yang sudah ada, mis. "BBM RANDIS", TETAP dipertahankan apa adanya --
    // tidak dibongkar, lihat listAmbiguousBbmMentions). Menandai Status di
    // sini (Tampilkan/Dibagi/Kecualikan) memakai state & fungsi PERSIS sama
    // dengan panel "Kelola Sharing" (customEditKey, saveClassification, dst)
    // -- cuma daftar item & filternya yang beda, supaya tidak duplikat logic.
    const [isTriagingBbmMentions, setIsTriagingBbmMentions] = useState(false)
    const [triageUnitFilter, setTriageUnitFilter] = useState('')
    const [showReviewedTriageItems, setShowReviewedTriageItems] = useState(false)
    const [triagePage, setTriagePage] = useState(1)

    const allAmbiguousBbmItems = useMemo(() => {
        return listAmbiguousBbmMentions(reimbursementDocs, lpjDocs, { year: selectedYear.value, categoryGroups })
    }, [reimbursementDocs, lpjDocs, selectedYear, categoryGroups])

    const visibleAmbiguousBbmItems = useMemo(() => {
        return allAmbiguousBbmItems.filter((item) => {
            if (triageUnitFilter && item.unit !== triageUnitFilter) return false
            const isReviewed = Boolean(sharingClassification[item.key])
            if (!showReviewedTriageItems && isReviewed) return false
            return true
        })
    }, [allAmbiguousBbmItems, triageUnitFilter, showReviewedTriageItems, sharingClassification])

    const pagedAmbiguousBbmItems = useMemo(() => {
        const start = (triagePage - 1) * SHARING_PAGE_SIZE
        return visibleAmbiguousBbmItems.slice(start, start + SHARING_PAGE_SIZE)
    }, [visibleAmbiguousBbmItems, triagePage])

    const totalTriagePages = Math.max(1, Math.ceil(visibleAmbiguousBbmItems.length / SHARING_PAGE_SIZE))

    const saveClassification = async (key, data) => {
        setSavingItemKey(key)
        try {
            await setDoc(doc(db, 'rekapanBbmSharing', key), data)
            setSharingClassification((prev) => ({ ...prev, [key]: data }))
        } catch (error) {
            console.error('Gagal menyimpan klasifikasi sharing BBM:', error)
            toast.error('Gagal menyimpan klasifikasi baris ini')
        } finally {
            setSavingItemKey(null)
        }
    }

    // 3 status per baris (Bagian V): 'default' (100% ke unit pengaju, tampil
    // normal), 'dibagi' (displit ke unit lain), 'dikecualikan' (tidak muncul
    // di Rekapan sama sekali -- mis. BBM di luar scope Biaya GA).
    const getItemStatus = (item) => {
        const c = sharingClassification[item.key]
        if (c?.dikecualikan) return 'dikecualikan'
        if (c?.dibagi) return 'dibagi'
        return 'default'
    }

    const setItemStatus = (item, status) => {
        const current = sharingClassification[item.key]
        saveClassification(item.key, {
            dibagi: status === 'dibagi',
            dikecualikan: status === 'dikecualikan',
            splitMode: current?.splitMode || 'pool',
            customShares: current?.customShares || null,
            platOverride: current?.platOverride || null
        })
    }

    const openCustomEditor = (item) => {
        const current = sharingClassification[item.key]
        const existingShares = current?.customShares

        const included = {}
        SHARING_UNITS.forEach((u) => {
            // Kalau baris ini sebelumnya belum punya custom split (baru mau
            // dibuat), default centang SEMUA unit (sama seperti pool default) --
            // Admin tinggal uncheck yang tidak relevan. Kalau sudah punya custom
            // split, sertakan yang persentasenya sudah > 0 saja.
            included[u.code] = existingShares ? (existingShares[u.name] || 0) > 0 : true
        })
        setCustomEditIncluded(included)

        const draft = {}
        SHARING_UNITS.forEach((u) => {
            draft[u.code] = String(existingShares?.[u.name] ?? defaultPoolShares[u.name] ?? 0)
        })
        setCustomEditDraft(draft)
        setCustomEditKey(item.key)
    }

    const toggleCustomInclude = (code) => {
        setCustomEditIncluded((prev) => {
            const next = { ...prev, [code]: !prev[code] }
            const percentages = computeProportionalSplit(next, defaultPoolShares)
            const draft = {}
            SHARING_UNITS.forEach((u) => { draft[u.code] = String(percentages[u.code]) })
            setCustomEditDraft(draft)
            return next
        })
    }

    const saveCustomSplit = async (item) => {
        const current = sharingClassification[item.key]
        const customShares = {}
        SHARING_UNITS.forEach((u) => {
            customShares[u.name] = customEditIncluded[u.code] ? (Number(customEditDraft[u.code]) || 0) : 0
        })
        await saveClassification(item.key, {
            dibagi: true,
            dikecualikan: false,
            splitMode: 'custom',
            customShares,
            platOverride: current?.platOverride || null
        })
        setCustomEditKey(null)
    }

    const applyDefaultPoolSplit = (item) => {
        const current = sharingClassification[item.key]
        saveClassification(item.key, {
            dibagi: true,
            dikecualikan: false,
            splitMode: 'pool',
            customShares: current?.customShares || null,
            platOverride: current?.platOverride || null
        })
        setCustomEditKey(null)
    }

    // Bagian AG: "Atur Plat" -- koreksi/set nomor plat manual untuk baris BBM
    // yang plat aslinya kosong ("Tidak diketahui", biasanya transaksi lama yang
    // nomor platnya diketik bebas di field jenis, bukan field plat khusus).
    // Disimpan sebagai `platOverride` di dokumen klasifikasi yang SAMA
    // (rekapanBbmSharing/{key}) -- begitu tersimpan, baris ini otomatis
    // tergabung ke grup plat yang sama (dinormalisasi) di tabel "BBM -- Liter
    // per Plat Nomor" (lihat aggregateBbm), TIDAK mengubah dokumen
    // reimbursement/lpj aslinya sama sekali.
    const [platEditKey, setPlatEditKey] = useState(null)
    const [platEditDraft, setPlatEditDraft] = useState('')

    const openPlatEditor = (item) => {
        const current = sharingClassification[item.key]
        setPlatEditDraft(current?.platOverride || (item.plat !== 'Tidak diketahui' ? item.plat : ''))
        setPlatEditKey(item.key)
    }

    const savePlatOverride = async (item) => {
        const current = sharingClassification[item.key]
        const trimmed = platEditDraft.trim()
        await saveClassification(item.key, {
            dibagi: current?.dibagi || false,
            dikecualikan: current?.dikecualikan || false,
            splitMode: current?.splitMode || 'pool',
            customShares: current?.customShares || null,
            platOverride: trimmed || null
        })
        setPlatEditKey(null)
    }

    // Drill-down (Bagian X, digeneralisasi ke SEMUA kategori di Bagian AE): klik
    // sel Biaya/Liter di tabel kategori APAPUN (BBM Total, BBM per Plat, ATK,
    // RTG, Meeting, kategori custom hasil "Kelola Kategori", dst) -> modal berisi
    // transaksi MENTAH di balik angka itu (bulan yang sama), supaya Admin bisa
    // langsung tandai Dibagi/Kecualikan tanpa cari-cari di panel "Kelola Sharing".
    // `category` menentukan sumber datanya: 'BBM' -> allBbmLineItems (juga
    // dipakai type 'plat', karena byPlat selalu murni data BBM), kategori lain
    // -> allCategoryLineItems difilter category yang sama. type 'unit': item
    // yang DISUBMIT unit itu (bukan porsi share masuk dari unit lain -- itu
    // pecahan dari item unit lain, tidak bisa "dikeluarkan" sendiri di sini).
    const [drillDown, setDrillDown] = useState(null) // { type: 'unit'|'plat', value, month, label, category }

    const openDrillDown = (type, value, month, label, category) => {
        setDrillDown({ type, value, month, label, category })
    }

    const closeDrillDown = () => setDrillDown(null)

    const drillDownItems = useMemo(() => {
        if (!drillDown) return []
        const isBbm = !drillDown.category || drillDown.category === 'BBM'
        const sourceItems = isBbm ? allBbmLineItems : allCategoryLineItems.filter((item) => item.category === drillDown.category)
        return sourceItems.filter((item) => {
            if (item.month !== drillDown.month) return false
            return drillDown.type === 'plat' ? item.plat === drillDown.value : item.unit === drillDown.value
        })
    }, [drillDown, allBbmLineItems, allCategoryLineItems])

    // Baris klasifikasi (dropdown status + "Atur Split") -- dipakai SAMA baik
    // di panel "Kelola Sharing" maupun modal drill-down, supaya kontrolnya
    // konsisten & tidak duplikat ~90 baris JSX.
    //
    // Bagian AC: sebelumnya memilih "Dibagi ke unit lain" di dropdown LANGSUNG
    // menyimpan split "Pool Default" (semua unit) sebelum Admin sempat pilih unit
    // mana saja lewat checkbox -- Admin harus klik "Atur Split" terpisah untuk
    // benar-benar memilih. Sekarang memilih "Dibagi" LANGSUNG membuka editor
    // checkbox (belum tersimpan), memaksa Admin memilih unit tujuan dulu sebelum
    // baris ini benar-benar tersimpan sebagai "dibagi".
    const handleStatusChange = (item, value) => {
        if (value === 'dibagi') {
            openCustomEditor(item)
        } else {
            setCustomEditKey(null)
            setItemStatus(item, value)
        }
    }

    const renderClassificationRow = (item, options = {}) => {
        const { highlightJenis = false } = options
        const classification = sharingClassification[item.key]
        const status = getItemStatus(item)
        const isEditingCustom = customEditKey === item.key
        const isEditingPlat = platEditKey === item.key
        // Selagi editor checkbox terbuka (belum tersimpan), dropdown tetap
        // menampilkan "Dibagi ke unit lain" walau classification belum committed.
        const displayedStatus = isEditingCustom ? 'dibagi' : status
        const isDibagi = displayedStatus === 'dibagi'
        return (
            <React.Fragment key={item.key}>
                <tr className="border-t dark:border-gray-700">
                    <td className="px-3 py-2">{MONTH_LABELS[item.month]}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{getUnitLabel(item.unit)}</td>
                    <td className="px-3 py-2">{item.category || 'BBM'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                        {item.category === 'BBM' ? (
                            <div className="flex items-center gap-2">
                                <span className={item.plat === 'Tidak diketahui' ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                                    {item.plat}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => openPlatEditor(item)}
                                    className="text-red-600 dark:text-red-400 hover:underline text-xs flex-none"
                                >
                                    Atur Plat
                                </button>
                            </div>
                        ) : (item.plat || '-')}
                    </td>
                    <td className="px-3 py-2">
                        {highlightJenis ? (
                            <span className="inline-block bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-medium">
                                {item.jenis}
                            </span>
                        ) : item.jenis}
                    </td>
                    <td className="px-3 py-2 text-right">{item.biayaTotal.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2">
                        <select
                            value={displayedStatus}
                            disabled={savingItemKey === item.key}
                            onChange={(e) => handleStatusChange(item, e.target.value)}
                            className="text-sm border dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        >
                            <option value="default">Tampilkan (default)</option>
                            <option value="dibagi">Dibagi ke unit lain</option>
                            <option value="dikecualikan">Kecualikan dari Rekapan</option>
                        </select>
                    </td>
                    <td className="px-3 py-2">
                        {isDibagi && status === 'dibagi' && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 dark:text-gray-400">
                                    {classification?.splitMode === 'custom' ? 'Custom' : 'Pool Default'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => openCustomEditor(item)}
                                    className="text-red-600 dark:text-red-400 hover:underline"
                                >
                                    Atur Split
                                </button>
                            </div>
                        )}
                    </td>
                </tr>
                {isEditingCustom && (
                    <tr className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                        <td colSpan={8} className="px-3 py-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Centang Unit Bisnis tujuan -- persentase terisi otomatis proporsional (bisa diedit manual kalau perlu).
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                {SHARING_UNITS.map((u) => (
                                    <div key={u.code} className="border dark:border-gray-600 rounded-md p-2">
                                        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mb-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(customEditIncluded[u.code])}
                                                onChange={() => toggleCustomInclude(u.code)}
                                                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                            />
                                            {u.code}
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                disabled={!customEditIncluded[u.code]}
                                                value={customEditDraft[u.code] || ''}
                                                onChange={(e) => setCustomEditDraft((prev) => ({ ...prev, [u.code]: e.target.value }))}
                                                className="w-full text-sm border dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                            />
                                            <span className="text-xs text-gray-400">%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <button
                                    type="button"
                                    onClick={() => applyDefaultPoolSplit(item)}
                                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:underline"
                                >
                                    Pakai Pool Default
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomEditKey(null)}
                                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:underline"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => saveCustomSplit(item)}
                                    disabled={savingItemKey === item.key}
                                    className="px-4 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                                >
                                    Simpan Split Custom
                                </button>
                            </div>
                        </td>
                    </tr>
                )}
                {isEditingPlat && (
                    <tr className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                        <td colSpan={8} className="px-3 py-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Set/koreksi nomor plat baris ini -- setelah disimpan, otomatis tergabung ke plat yang
                                sama (dinormalisasi) di tabel "BBM -- Liter per Plat Nomor", tidak mengubah dokumen
                                pengajuan aslinya.
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={platEditDraft}
                                    onChange={(e) => setPlatEditDraft(e.target.value)}
                                    placeholder="mis. DD 1273 XBO"
                                    className="flex-1 max-w-xs text-sm border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => setPlatEditKey(null)}
                                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:underline"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => savePlatOverride(item)}
                                    disabled={savingItemKey === item.key}
                                    className="px-4 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                                >
                                    {savingItemKey === item.key ? 'Menyimpan...' : 'Simpan Plat'}
                                </button>
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        )
    }

    const startEditHeadcount = () => {
        const draft = {}
        SHARING_UNITS.forEach((u) => {
            draft[u.code] = (headcountByCode[u.code] || []).join('\n')
        })
        setHeadcountDraft(draft)
        setIsEditingHeadcount(true)
    }

    const cancelEditHeadcount = () => {
        setIsEditingHeadcount(false)
        setHeadcountDraft({})
    }

    const saveHeadcount = async () => {
        setIsSavingHeadcount(true)
        try {
            await Promise.all(
                SHARING_UNITS.map((u) => {
                    const names = (headcountDraft[u.code] || '')
                        .split('\n')
                        .map((n) => n.trim())
                        .filter(Boolean)
                    return setDoc(doc(db, 'rekapanHeadcount', u.code), { names })
                })
            )
            toast.success('Data roster sharing BBM disimpan')
            setIsEditingHeadcount(false)
            await fetchHeadcount()
        } catch (error) {
            console.error('Gagal menyimpan roster sharing BBM:', error)
            toast.error('Gagal menyimpan data roster')
        } finally {
            setIsSavingHeadcount(false)
        }
    }

    const isUnitFilterChecked = useCallback((value) => {
        return selectedUnitOptions.some((opt) => opt.value === value)
    }, [selectedUnitOptions])

    const toggleUnitFilterOption = useCallback((option) => {
        setSelectedUnitOptions((prev) => {
            const exists = prev.some((opt) => opt.value === option.value)
            return exists ? prev.filter((opt) => opt.value !== option.value) : [...prev, option]
        })
    }, [])

    const unitFilterLabel = selectedUnitOptions.length === 0
        ? 'Semua Unit Bisnis'
        : selectedUnitOptions.length === 1
            ? selectedUnitOptions[0].label
            : `${selectedUnitOptions.length} Unit Bisnis dipilih`

    // Kosong (default) berarti tampilkan SEMUA unit yang tersedia untuk role user
    // ini (unitOptions) -- sama seperti perilaku "Semua Unit Bisnis" sebelumnya,
    // sekarang bisa juga pilih kombinasi bebas 1/2/3/dst lewat checkbox.
    const unitsFilter = useMemo(() => {
        if (selectedUnitOptions.length > 0) return selectedUnitOptions.map((o) => o.value)
        return unitOptions.map((o) => o.value)
    }, [selectedUnitOptions, unitOptions])

    const displayUnits = unitsFilter

    // PPNP bukan Unit Bisnis resmi aplikasi (lihat rekapanSharing.js) -- cuma
    // relevan sebagai baris TAMBAHAN di tabel kategori APAPUN (Bagian AE: sharing
    // generik, bukan cuma BBM lagi -- kategori mana pun bisa displit ke PPNP kalau
    // dicentang di custom split), dan cuma muncul saat Admin/Super Admin melihat
    // SEMUA Unit Bisnis tanpa filter (kalau difilter ke unit tertentu, PPNP tidak
    // mungkin jadi pilihan checkbox-nya).
    const sharingExtraUnits = useMemo(() => {
        return isAdmin && selectedUnitOptions.length === 0 ? [PPNP_UNIT_NAME] : []
    }, [isAdmin, selectedUnitOptions])

    const categoryData = useMemo(() => {
        return aggregateByCategory(reimbursementDocs, lpjDocs, {
            year: selectedYear.value,
            units: unitsFilter,
            categoryGroups,
            sharingClassification,
            defaultPoolShares
        })
    }, [reimbursementDocs, lpjDocs, selectedYear, unitsFilter, categoryGroups, sharingClassification, defaultPoolShares])

    const bbmData = useMemo(() => {
        return aggregateBbm(reimbursementDocs, lpjDocs, {
            year: selectedYear.value,
            units: unitsFilter,
            sharingClassification,
            defaultPoolShares
        })
    }, [reimbursementDocs, lpjDocs, selectedYear, unitsFilter, sharingClassification, defaultPoolShares])

    const orderedCategories = useMemo(() => {
        const found = Object.keys(categoryData)
        const known = CATEGORY_ORDER.filter((c) => found.includes(c))
        const unknown = found.filter((c) => !CATEGORY_ORDER.includes(c)).sort()
        return [...known, ...unknown]
    }, [categoryData])

    // Filter "Tampilkan Rekapan" -- pilih tabel/kategori mana saja yang mau ditampilkan.
    // Kosong (default) berarti tampilkan semua, sama seperti perilaku sebelum ada filter ini.
    const [tableFilter, setTableFilter] = useState([])
    const [isTableFilterOpen, setIsTableFilterOpen] = useState(false)
    const [tableSearchText, setTableSearchText] = useState('')

    // Bagian AD: breakdown per jenis BBM (Pertalite/Pertamax/dst sebagai tabel
    // terpisah) dihilangkan dari tampilan (`bbmData.byJenis` tetap dihitung di
    // aggregateBbm, cuma tidak dipakai di sini). Bagian AF sempat menghapus
    // "BBM -- Total Biaya" juga, tapi dimunculkan lagi di Bagian AH karena itu
    // satu-satunya tempat pengajuan BBM lewat FORM RESMI terlihat per Unit
    // Bisnis -- lihat catatan di BBM_TOTAL_KEY di atas.
    const tableFilterOptions = useMemo(() => [
        { value: BBM_TOTAL_KEY, label: 'BBM (Form Resmi) -- Total Biaya per Unit Bisnis' },
        { value: BBM_LITER_KEY, label: 'BBM -- Liter per Plat Nomor' },
        ...orderedCategories.map((c) => ({ value: c, label: c }))
    ], [orderedCategories])

    const isTableVisible = useCallback((key) => {
        return tableFilter.length === 0 || tableFilter.some((opt) => opt.value === key)
    }, [tableFilter])

    const isTableFilterChecked = useCallback((value) => {
        return tableFilter.some((opt) => opt.value === value)
    }, [tableFilter])

    const toggleTableFilterOption = useCallback((option) => {
        setTableFilter((prev) => {
            const exists = prev.some((opt) => opt.value === option.value)
            return exists ? prev.filter((opt) => opt.value !== option.value) : [...prev, option]
        })
    }, [])

    const tableFilterLabel = tableFilter.length === 0
        ? 'Semua rekapan ditampilkan'
        : `${tableFilter.length} rekapan dipilih`

    const getUnitLabel = useCallback((unitValue) => {
        return BUSINESS_UNITS.find((u) => u.value === unitValue)?.label || unitValue
    }, [])

    const customStyles = {
        control: (base) => ({
            ...base,
            minHeight: '40px',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            backgroundColor: isDark ? '#1f2937' : 'white'
        }),
        singleValue: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        input: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        menu: (base) => ({ ...base, zIndex: 100, backgroundColor: isDark ? '#1f2937' : '#ffffff' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: isDark
                ? (state.isSelected ? '#374151' : state.isFocused ? '#2d3748' : '#1f2937')
                : base.backgroundColor,
            color: isDark ? '#f3f4f6' : base.color,
            cursor: 'pointer'
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: isDark ? '#374151' : '#e5e7eb'
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: isDark ? '#f3f4f6' : '#111827'
        })
    }

    // Bagian AE: drill-down berlaku untuk SEMUA tabel kategori (bukan cuma BBM
    // Total Biaya lagi) -- `categoryKey` default ke `title` (title === nama
    // kategori untuk tabel non-BBM), override eksplisit untuk "BBM -- Total
    // Biaya" (titlenya bukan nama kategori asli "BBM"). `note` (Bagian AH,
    // opsional) -- teks kecil di atas tabel, dipakai buat menjelaskan sumber
    // data tabel "BBM (Form Resmi)" supaya tidak disangka sama/redundan dengan
    // kategori custom hasil "Kelola Kategori".
    const renderCategoryTable = (title, rowsData, extraUnits = [], categoryKey = title, note = null) => {
        // rowsData: { [unit]: number[12] }. extraUnits: unit "virtual" tambahan
        // (mis. PPNP, bukan Unit Bisnis resmi aplikasi) yang cuma relevan untuk
        // tabel ini -- ditambahkan setelah displayUnits, bukan menggantikannya.
        const rowUnits = [...displayUnits, ...extraUnits]
        const colCount = 1 + visibleMonthIndexes.length + 1
        return (
            <div key={title} className="mb-6">
                {note && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{note}</p>
                )}
                <div className="flex justify-end mb-2">
                    <button
                        type="button"
                        onClick={() => handleExportPng(title)}
                        disabled={exportingTitle === title}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        {exportingTitle === title ? 'Mengekspor...' : 'Export PNG'}
                    </button>
                </div>
                <div
                    ref={(el) => { tableRefs.current[title] = el }}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr style={{ backgroundColor: '#ED1C24' }}>
                                    <th colSpan={colCount} className="py-2 px-4 text-white text-left font-semibold">
                                        {title}
                                    </th>
                                </tr>
                                <tr style={{ backgroundColor: '#ED1C24' }}>
                                    <th className="py-2 px-4 text-white text-left font-medium min-w-[220px]">Unit Bisnis</th>
                                    {visibleMonthIndexes.map((i) => (
                                        <th key={i} className="py-2 px-2 text-white text-center font-medium">{MONTH_LABELS[i]}</th>
                                    ))}
                                    <th className="py-2 px-3 text-white text-center font-medium">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rowUnits.map((unit, idx) => {
                                    const months = rowsData[unit] || Array(12).fill(0)
                                    const canDrillDown = isAdmin
                                    return (
                                        <tr key={unit} className={idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/40' : 'bg-white dark:bg-gray-800'}>
                                            <td className="py-2 px-4 text-gray-800 dark:text-gray-100 whitespace-nowrap">{getUnitLabel(unit)}</td>
                                            {visibleMonthIndexes.map((i) => {
                                                const val = months[i]
                                                return (
                                                    <td
                                                        key={i}
                                                        onClick={canDrillDown && val ? () => openDrillDown('unit', unit, i, getUnitLabel(unit), categoryKey) : undefined}
                                                        title={canDrillDown && val ? 'Klik untuk lihat rincian transaksi' : undefined}
                                                        className={`py-2 px-2 text-right text-gray-700 dark:text-gray-200 ${canDrillDown && val ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:underline' : ''}`}
                                                    >
                                                        {val ? val.toLocaleString('id-ID') : '-'}
                                                    </td>
                                                )
                                            })}
                                            <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-50">
                                                {sumMonths(visibleMonthIndexes.map((i) => months[i])).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    const renderBbmLiterTable = () => {
        const title = 'BBM -- Liter per Plat Nomor'
        const plats = Object.keys(bbmData.byPlat).sort()
        const colCount = 2 + visibleMonthIndexes.length + 1
        return (
            <div className="mb-6">
                <div className="flex justify-end mb-2">
                    <button
                        type="button"
                        onClick={() => handleExportPng(title)}
                        disabled={exportingTitle === title}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        {exportingTitle === title ? 'Mengekspor...' : 'Export PNG'}
                    </button>
                </div>
                <div
                    ref={(el) => { tableRefs.current[title] = el }}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
                >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr style={{ backgroundColor: '#ED1C24' }}>
                                <th colSpan={colCount} className="py-2 px-4 text-white text-left font-semibold">
                                    {title}
                                </th>
                            </tr>
                            <tr style={{ backgroundColor: '#ED1C24' }}>
                                <th className="py-2 px-4 text-white text-left font-medium min-w-[160px]">Plat Nomor</th>
                                <th className="py-2 px-2 text-white text-left font-medium">Satuan</th>
                                {visibleMonthIndexes.map((i) => (
                                    <th key={i} className="py-2 px-2 text-white text-center font-medium">{MONTH_LABELS[i]}</th>
                                ))}
                                <th className="py-2 px-3 text-white text-center font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plats.length === 0 && (
                                <tr>
                                    <td colSpan={colCount} className="py-4 px-4 text-center text-gray-500 dark:text-gray-400">
                                        Tidak ada data BBM untuk filter ini.
                                    </td>
                                </tr>
                            )}
                            {plats.map((plat, idx) => {
                                const rowBg = idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/40' : 'bg-white dark:bg-gray-800'
                                const canDrillDown = isAdmin
                                const cellCls = (val) => `py-1 px-2 text-right text-gray-700 dark:text-gray-200 ${canDrillDown && val ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:underline' : ''}`
                                return (
                                    <React.Fragment key={plat}>
                                        <tr className={rowBg}>
                                            <td rowSpan={2} className="py-2 px-4 text-gray-800 dark:text-gray-100 whitespace-nowrap align-top border-b dark:border-gray-600">
                                                {plat}
                                            </td>
                                            <td className="py-1 px-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">Liter (L)</td>
                                            {visibleMonthIndexes.map((i) => {
                                                const val = bbmData.byPlat[plat].liter[i]
                                                return (
                                                    <td
                                                        key={i}
                                                        onClick={canDrillDown && val ? () => openDrillDown('plat', plat, i, plat, 'BBM') : undefined}
                                                        title={canDrillDown && val ? 'Klik untuk lihat rincian transaksi' : undefined}
                                                        className={cellCls(val)}
                                                    >
                                                        {val ? val.toLocaleString('id-ID') : '-'}
                                                    </td>
                                                )
                                            })}
                                            <td className="py-1 px-3 text-right font-semibold text-gray-900 dark:text-gray-50">
                                                {sumMonths(visibleMonthIndexes.map((i) => bbmData.byPlat[plat].liter[i])).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                        <tr className={`${rowBg} border-b dark:border-gray-600`}>
                                            <td className="py-1 px-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">Biaya (Rp)</td>
                                            {visibleMonthIndexes.map((i) => {
                                                const val = bbmData.byPlat[plat].biaya[i]
                                                return (
                                                    <td
                                                        key={i}
                                                        onClick={canDrillDown && val ? () => openDrillDown('plat', plat, i, plat, 'BBM') : undefined}
                                                        title={canDrillDown && val ? 'Klik untuk lihat rincian transaksi' : undefined}
                                                        className={cellCls(val)}
                                                    >
                                                        {val ? val.toLocaleString('id-ID') : '-'}
                                                    </td>
                                                )
                                            })}
                                            <td className="py-1 px-3 text-right font-semibold text-gray-900 dark:text-gray-50">
                                                {sumMonths(visibleMonthIndexes.map((i) => bbmData.byPlat[plat].biaya[i])).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                )
                            })}
                            {plats.length > 0 && (() => {
                                const literPerMonth = visibleMonthIndexes.map((i) =>
                                    plats.reduce((sum, plat) => sum + (bbmData.byPlat[plat].liter[i] || 0), 0)
                                )
                                const biayaPerMonth = visibleMonthIndexes.map((i) =>
                                    plats.reduce((sum, plat) => sum + (bbmData.byPlat[plat].biaya[i] || 0), 0)
                                )
                                return (
                                    <React.Fragment>
                                        <tr className="bg-gray-200 dark:bg-gray-600 font-semibold">
                                            <td rowSpan={2} className="py-2 px-4 text-gray-900 dark:text-gray-50 whitespace-nowrap align-top border-b dark:border-gray-500">
                                                Grand Total
                                            </td>
                                            <td className="py-1 px-2 text-gray-700 dark:text-gray-200 whitespace-nowrap">Liter (L)</td>
                                            {literPerMonth.map((val, idx) => (
                                                <td key={idx} className="py-1 px-2 text-right text-gray-900 dark:text-gray-50">
                                                    {val ? val.toLocaleString('id-ID') : '-'}
                                                </td>
                                            ))}
                                            <td className="py-1 px-3 text-right text-gray-900 dark:text-gray-50">
                                                {sumMonths(literPerMonth).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                        <tr className="bg-gray-200 dark:bg-gray-600 font-semibold border-b-2 border-gray-400 dark:border-gray-500">
                                            <td className="py-1 px-2 text-gray-700 dark:text-gray-200 whitespace-nowrap">Biaya (Rp)</td>
                                            {biayaPerMonth.map((val, idx) => (
                                                <td key={idx} className="py-1 px-2 text-right text-gray-900 dark:text-gray-50">
                                                    {val ? val.toLocaleString('id-ID') : '-'}
                                                </td>
                                            ))}
                                            <td className="py-1 px-3 text-right text-gray-900 dark:text-gray-50">
                                                {sumMonths(biayaPerMonth).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                )
                            })()}
                        </tbody>
                    </table>
                </div>
                </div>
            </div>
        )
    }

    if (!isRoleLoaded) {
        return (
            <div className="container mx-auto py-10 md:py-8">
                <Skeleton height={40} className="mb-4" />
                <Skeleton height={300} />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-6 dark:text-gray-100">Rekapan Unit Bisnis</h2>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6 transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Unit Bisnis</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setIsUnitFilterOpen((prev) => !prev); setUnitSearchText('') }}
                                className="w-full h-10 px-3 flex items-center justify-between border rounded-md text-sm text-left bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                            >
                                <span className="truncate">{unitFilterLabel}</span>
                                <svg
                                    className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${isUnitFilterOpen ? 'rotate-180' : ''}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isUnitFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => { setIsUnitFilterOpen(false); setUnitSearchText('') }} />
                                    <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1">
                                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={unitSearchText}
                                                onChange={(e) => setUnitSearchText(e.target.value)}
                                                placeholder="Ketik untuk cari Unit Bisnis..."
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-sm border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                            <button
                                                type="button"
                                                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                                onClick={() => setSelectedUnitOptions(unitOptions)}
                                            >
                                                Pilih Semua
                                            </button>
                                            <button
                                                type="button"
                                                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                                                onClick={() => setSelectedUnitOptions([])}
                                            >
                                                Kosongkan
                                            </button>
                                        </div>
                                        {unitOptions
                                            .filter((opt) => opt.label.toLowerCase().includes(unitSearchText.toLowerCase()))
                                            .map((opt) => (
                                                <label
                                                    key={opt.value}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isUnitFilterChecked(opt.value)}
                                                        onChange={() => toggleUnitFilterOption(opt)}
                                                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            ))}
                                        {unitOptions.filter((opt) => opt.label.toLowerCase().includes(unitSearchText.toLowerCase())).length === 0 && (
                                            <div className="px-3 py-3 text-sm text-gray-400 text-center">Tidak ditemukan</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Tahun</label>
                        <Select
                            options={YEAR_OPTIONS}
                            value={selectedYear}
                            onChange={setSelectedYear}
                            styles={customStyles}
                            isSearchable={false}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Bulan</label>
                        <Select
                            options={MONTH_FILTER_OPTIONS}
                            value={selectedMonth}
                            onChange={setSelectedMonth}
                            styles={customStyles}
                            isSearchable={false}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Tampilkan Rekapan</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setIsTableFilterOpen((prev) => !prev); setTableSearchText('') }}
                                className="w-full h-10 px-3 flex items-center justify-between border rounded-md text-sm text-left bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                            >
                                <span className="truncate">{tableFilterLabel}</span>
                                <svg
                                    className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${isTableFilterOpen ? 'rotate-180' : ''}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isTableFilterOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => { setIsTableFilterOpen(false); setTableSearchText('') }} />
                                    <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1">
                                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={tableSearchText}
                                                onChange={(e) => setTableSearchText(e.target.value)}
                                                placeholder="Ketik untuk cari rekapan..."
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-sm border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                            <button
                                                type="button"
                                                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                                onClick={() => setTableFilter(tableFilterOptions)}
                                            >
                                                Pilih Semua
                                            </button>
                                            <button
                                                type="button"
                                                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                                                onClick={() => setTableFilter([])}
                                            >
                                                Kosongkan
                                            </button>
                                        </div>
                                        {tableFilterOptions
                                            .filter((opt) => opt.label.toLowerCase().includes(tableSearchText.toLowerCase()))
                                            .map((opt) => (
                                                <label
                                                    key={opt.value}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isTableFilterChecked(opt.value)}
                                                        onChange={() => toggleTableFilterOption(opt)}
                                                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            ))}
                                        {tableFilterOptions.filter((opt) => opt.label.toLowerCase().includes(tableSearchText.toLowerCase())).length === 0 && (
                                            <div className="px-3 py-3 text-sm text-gray-400 text-center">Tidak ditemukan</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isDataLoading ? (
                <div className="space-y-4">
                    <Skeleton height={220} />
                    <Skeleton height={220} />
                </div>
            ) : unitOptions.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-500 dark:text-gray-400">
                    Belum ada Unit Bisnis yang ditugaskan ke akun Anda.
                </div>
            ) : (
                <>
                    {isTableVisible(BBM_TOTAL_KEY) && renderCategoryTable(
                        'BBM (Form Resmi) -- Total Biaya per Unit Bisnis',
                        bbmData.totals,
                        sharingExtraUnits,
                        'BBM',
                        'Semua biaya BBM dari form BBM resmi (RBS BBM/Operasional/Umum, LPJ) -- terpisah dari kategori custom apa pun yang dibuat lewat "Kelola Kategori" (yang cuma bisa berisi item non-BBM, tidak bisa menggantikan tabel ini).'
                    )}
                    {isTableVisible(BBM_LITER_KEY) && renderBbmLiterTable()}
                    {orderedCategories
                        .filter((category) => isTableVisible(category))
                        .map((category) => renderCategoryTable(category, categoryData[category], sharingExtraUnits))}

                    {tableFilter.length > 0 &&
                        !isTableVisible(BBM_TOTAL_KEY) &&
                        !isTableVisible(BBM_LITER_KEY) &&
                        orderedCategories.filter((category) => isTableVisible(category)).length === 0 && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-500 dark:text-gray-400">
                            Tidak ada rekapan yang cocok dengan filter "Tampilkan Rekapan" yang dipilih.
                        </div>
                    )}

                    {orderedCategories.length === 0 && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow text-gray-500 dark:text-gray-400">
                            Belum ada data pengajuan Disetujui untuk filter ini.
                        </div>
                    )}

                    {isAdmin && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mt-4">
                            <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Pengaturan Rekapan</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Khusus Admin/Super Admin -- tidak memengaruhi tampilan Validator.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <button
                                    type="button"
                                    onClick={startEditHeadcount}
                                    disabled={isHeadcountLoading}
                                    className="text-left border dark:border-gray-600 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                                >
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Kelola Data Sharing BBM</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Roster headcount per Unit Bisnis -- dasar persentase pool default.
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsManagingSharing(true)}
                                    disabled={isClassificationLoading}
                                    className="text-left border dark:border-gray-600 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                                >
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Kelola Sharing</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Tandai baris kategori apa pun yang dibagi ke unit lain atau dikecualikan dari Rekapan.
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsManagingCategories(true)}
                                    disabled={isCategoryGroupsLoading}
                                    className="text-left border dark:border-gray-600 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                                >
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Kelola Kategori</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Gabungkan label kategori yang mirip jadi 1 baris Rekapan.
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsTriagingBbmMentions(true)}
                                    disabled={isClassificationLoading}
                                    className="text-left border dark:border-gray-600 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                                >
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                        Tinjau Item BBM Ambigu
                                        {allAmbiguousBbmItems.filter((item) => !sharingClassification[item.key]).length > 0 && (
                                            <span className="ml-2 inline-block bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full align-middle">
                                                {allAmbiguousBbmItems.filter((item) => !sharingClassification[item.key]).length}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Item RTG/ATK/dst yang keterangannya menyebut "BBM" tapi belum dikelompokkan/ditinjau.
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {isEditingHeadcount && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={cancelEditHeadcount} />
                    <div className="fixed z-50 inset-0 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                                        Kelola Data Sharing BBM
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Daftar nama per Unit Bisnis, dasar hitung persentase pool "All Employee" --
                                        dipakai sebagai split DEFAULT untuk baris BBM/RTK/RTG yang ditandai "dibagi"
                                        (kecuali baris itu diberi split custom sendiri). Total headcount saat ini:{' '}
                                        {SHARING_UNITS.reduce((sum, u) => sum + (headcountByCode[u.code]?.length || 0), 0)} orang.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={cancelEditHeadcount}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none px-2 flex-none"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="overflow-auto p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {SHARING_UNITS.map((u) => (
                                        <div key={u.code}>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                {u.name} <span className="text-gray-400">({u.code})</span>
                                            </label>
                                            <textarea
                                                rows={6}
                                                value={headcountDraft[u.code] || ''}
                                                onChange={(e) => setHeadcountDraft((prev) => ({ ...prev, [u.code]: e.target.value }))}
                                                placeholder="1 nama per baris"
                                                className="w-full text-sm border dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={cancelEditHeadcount}
                                    disabled={isSavingHeadcount}
                                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={saveHeadcount}
                                    disabled={isSavingHeadcount}
                                    className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                                >
                                    {isSavingHeadcount ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {isManagingSharing && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsManagingSharing(false)} />
                    <div className="fixed z-50 inset-0 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                                        Kelola Sharing
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Tandai satu-satu baris kategori apa pun: <strong>Dibagi</strong> ke unit lain
                                        (mis. biaya yang ditalangi dulu oleh 1 unit), atau <strong>Kecualikan</strong>
                                        kalau di luar scope Biaya GA. Baris yang belum ditandai tetap 100% ke unit
                                        pengaju.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsManagingSharing(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none px-2 flex-none"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="overflow-auto p-4">
                                <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                                    <select
                                        value={sharingCategoryFilter}
                                        onChange={(e) => { setSharingCategoryFilter(e.target.value); setSharingPage(1) }}
                                        className="border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                    >
                                        <option value="">Semua Kategori</option>
                                        <option value="BBM">BBM</option>
                                        {orderedCategories.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={sharingUnitFilter}
                                        onChange={(e) => { setSharingUnitFilter(e.target.value); setSharingPage(1) }}
                                        className="border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                    >
                                        <option value="">Semua Unit Bisnis</option>
                                        {BUSINESS_UNITS.map((u) => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                    <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={showReviewedItems}
                                            onChange={(e) => { setShowReviewedItems(e.target.checked); setSharingPage(1) }}
                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                        />
                                        Tampilkan yang sudah direview juga
                                    </label>
                                    <span className="text-gray-400">
                                        {visibleShareableLineItems.length} baris
                                    </span>
                                </div>

                                <div className="overflow-x-auto border dark:border-gray-600 rounded-md">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 dark:bg-gray-700">
                                                <th className="px-3 py-2 text-left">Bulan</th>
                                                <th className="px-3 py-2 text-left">Unit Pengaju</th>
                                                <th className="px-3 py-2 text-left">Kategori</th>
                                                <th className="px-3 py-2 text-left">Plat</th>
                                                <th className="px-3 py-2 text-left">Jenis</th>
                                                <th className="px-3 py-2 text-right">Biaya</th>
                                                <th className="px-3 py-2 text-left">Status</th>
                                                <th className="px-3 py-2 text-left">Split</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedShareableLineItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={8} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                                                        Tidak ada baris untuk filter ini.
                                                    </td>
                                                </tr>
                                            )}
                                            {pagedShareableLineItems.map((item) => renderClassificationRow(item))}
                                        </tbody>
                                    </table>
                                </div>

                                {totalSharingPages > 1 && (
                                    <div className="flex items-center justify-center gap-3 mt-3 text-sm">
                                        <button
                                            type="button"
                                            onClick={() => setSharingPage((p) => Math.max(1, p - 1))}
                                            disabled={sharingPage === 1}
                                            className="px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-50"
                                        >
                                            Sebelumnya
                                        </button>
                                        <span className="text-gray-600 dark:text-gray-300">
                                            Halaman {sharingPage} / {totalSharingPages}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setSharingPage((p) => Math.min(totalSharingPages, p + 1))}
                                            disabled={sharingPage === totalSharingPages}
                                            className="px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-50"
                                        >
                                            Berikutnya
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {isManagingCategories && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsManagingCategories(false)} />
                    <div className="fixed z-50 inset-0 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                                        Kelola Kategori
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Gabungkan beberapa label kategori/keterangan yang sebenarnya sama (mis.
                                        "Meeting", "Biaya Meeting", "Cemilan kue ruang meeting") jadi{' '}
                                        <strong>1 kategori Rekapan</strong>. Pengajuan baru yang mengandung salah
                                        satu anggota grup otomatis ikut tergabung.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsManagingCategories(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none px-2 flex-none"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="overflow-auto p-4 space-y-6">
                                {categoryGroups.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Grup yang sudah dibuat
                                        </p>
                                        <div className="space-y-3">
                                            {categoryGroups.map((group) => (
                                                <div key={group.id} className="border dark:border-gray-600 rounded-md p-3">
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <p className="font-semibold text-gray-800 dark:text-gray-100">{group.label}</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteCategoryGroup(group.id)}
                                                            className="text-xs text-red-600 hover:underline flex-none"
                                                        >
                                                            Hapus Grup
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(group.members || []).map((member) => (
                                                            <span
                                                                key={member}
                                                                className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-1 rounded-full"
                                                            >
                                                                {member}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeMemberFromGroup(group.id, member)}
                                                                    className="text-gray-400 hover:text-red-600"
                                                                    title="Keluarkan dari grup"
                                                                >
                                                                    &times;
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Buat/tambah grup -- centang label yang sebenarnya sama, lalu beri nama
                                        gabungan (ketik nama grup yang sudah ada untuk menambah anggota ke grup itu)
                                    </p>
                                    <input
                                        type="text"
                                        value={categorySearchText}
                                        onChange={(e) => setCategorySearchText(e.target.value)}
                                        placeholder="Ketik untuk cari label..."
                                        className="w-full text-sm border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 mb-2"
                                    />
                                    <div className="max-h-56 overflow-y-auto border dark:border-gray-600 rounded-md divide-y dark:divide-gray-100 dark:divide-gray-700">
                                        {rawCategoryLabels
                                            .filter((label) => label.toLowerCase().includes(categorySearchText.toLowerCase()))
                                            .map((label) => {
                                                const currentGroup = categoryGroups.find((g) => (g.members || []).includes(label))
                                                return (
                                                    <label
                                                        key={label}
                                                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(newGroupSelected[label])}
                                                            onChange={(e) => setNewGroupSelected((prev) => ({ ...prev, [label]: e.target.checked }))}
                                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                        />
                                                        <span className="flex-1">{label}</span>
                                                        {currentGroup && (
                                                            <span className="text-xs text-gray-400">sudah di grup "{currentGroup.label}"</span>
                                                        )}
                                                    </label>
                                                )
                                            })}
                                        {rawCategoryLabels.filter((label) => label.toLowerCase().includes(categorySearchText.toLowerCase())).length === 0 && (
                                            <p className="px-3 py-3 text-sm text-gray-400 text-center">Tidak ditemukan</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <input
                                            type="text"
                                            value={newGroupLabel}
                                            onChange={(e) => setNewGroupLabel(e.target.value)}
                                            placeholder="Nama kategori gabungan, mis. Meeting"
                                            className="flex-1 text-sm border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                        />
                                        <button
                                            type="button"
                                            onClick={createOrExtendCategoryGroup}
                                            disabled={isSavingGroup}
                                            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 flex-none"
                                        >
                                            {isSavingGroup ? 'Menyimpan...' : 'Gabungkan'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {isTriagingBbmMentions && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsTriagingBbmMentions(false)} />
                    <div className="fixed z-50 inset-0 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                                        Tinjau Item BBM Ambigu
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Item dari kategori lain (RTG/ATK/GA-Umum/LPJ) yang keterangannya menyebut kata
                                        "BBM" tapi BUKAN pengajuan lewat form BBM resmi, dan belum pernah digabung ke
                                        grup mana pun lewat "Kelola Kategori". Kolom Jenis di-highlight supaya
                                        keterangan asli (lokasi/SPBU, dsb) langsung terlihat -- tandai <strong>Dibagi</strong>{' '}
                                        ke Unit Bisnis yang benar kalau itu genuinely BBM, <strong>Kecualikan</strong>{' '}
                                        kalau di luar scope Biaya GA, atau biarkan <strong>Tampilkan (default)</strong>{' '}
                                        kalau memang bukan BBM (tetap tercatat di kategori aslinya, tidak berubah).
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsTriagingBbmMentions(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none px-2 flex-none"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="overflow-auto p-4">
                                <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                                    <select
                                        value={triageUnitFilter}
                                        onChange={(e) => { setTriageUnitFilter(e.target.value); setTriagePage(1) }}
                                        className="border dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                    >
                                        <option value="">Semua Unit Bisnis</option>
                                        {BUSINESS_UNITS.map((u) => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                    <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={showReviewedTriageItems}
                                            onChange={(e) => { setShowReviewedTriageItems(e.target.checked); setTriagePage(1) }}
                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                        />
                                        Tampilkan yang sudah ditinjau juga
                                    </label>
                                    <span className="text-gray-400">
                                        {visibleAmbiguousBbmItems.length} baris
                                    </span>
                                </div>

                                <div className="overflow-x-auto border dark:border-gray-600 rounded-md">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 dark:bg-gray-700">
                                                <th className="px-3 py-2 text-left">Bulan</th>
                                                <th className="px-3 py-2 text-left">Unit Pengaju</th>
                                                <th className="px-3 py-2 text-left">Kategori</th>
                                                <th className="px-3 py-2 text-left">Plat</th>
                                                <th className="px-3 py-2 text-left">Jenis</th>
                                                <th className="px-3 py-2 text-right">Biaya</th>
                                                <th className="px-3 py-2 text-left">Status</th>
                                                <th className="px-3 py-2 text-left">Split</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedAmbiguousBbmItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={8} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                                                        Tidak ada item untuk filter ini.
                                                    </td>
                                                </tr>
                                            )}
                                            {pagedAmbiguousBbmItems.map((item) => renderClassificationRow(item, { highlightJenis: true }))}
                                        </tbody>
                                    </table>
                                </div>

                                {totalTriagePages > 1 && (
                                    <div className="flex items-center justify-center gap-3 mt-3 text-sm">
                                        <button
                                            type="button"
                                            onClick={() => setTriagePage((p) => Math.max(1, p - 1))}
                                            disabled={triagePage === 1}
                                            className="px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-50"
                                        >
                                            Sebelumnya
                                        </button>
                                        <span className="text-gray-600 dark:text-gray-300">
                                            Halaman {triagePage} / {totalTriagePages}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setTriagePage((p) => Math.min(totalTriagePages, p + 1))}
                                            disabled={triagePage === totalTriagePages}
                                            className="px-3 py-1 border dark:border-gray-600 rounded disabled:opacity-50"
                                        >
                                            Berikutnya
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {drillDown && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={closeDrillDown} />
                    <div className="fixed z-50 inset-0 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                                        Rincian Transaksi -- {drillDown.category || 'BBM'} -- {drillDown.label} -- {MONTH_LABELS[drillDown.month]}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {drillDown.type === 'unit'
                                            ? 'Transaksi yang disubmit unit ini (belum termasuk porsi share masuk dari unit lain).'
                                            : 'Semua transaksi plat ini pada bulan tersebut.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeDrillDown}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none px-2"
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="overflow-auto p-4">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-700">
                                            <th className="px-3 py-2 text-left">Bulan</th>
                                            <th className="px-3 py-2 text-left">Unit Pengaju</th>
                                            <th className="px-3 py-2 text-left">Kategori</th>
                                            <th className="px-3 py-2 text-left">Plat</th>
                                            <th className="px-3 py-2 text-left">Jenis</th>
                                            <th className="px-3 py-2 text-right">Biaya</th>
                                            <th className="px-3 py-2 text-left">Status</th>
                                            <th className="px-3 py-2 text-left">Split</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drillDownItems.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                                                    Tidak ada transaksi.
                                                </td>
                                            </tr>
                                        )}
                                        {drillDownItems.map((item) => renderClassificationRow(item))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default RekapanUnitBisnis
