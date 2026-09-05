import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { doc, setDoc, getDoc, collection, getDocs, query, where, updateDoc, arrayUnion, runTransaction } from 'firebase/firestore'
import { db, storage } from '../firebaseConfig'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons'
import useFormDraft from '../hooks/useFormDraft'
import { uploadPdfFile } from '../utils/uploadPdfFile'
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_SIZE_BYTES, getUploadableAttachments, isValidAttachmentFile, mergeAttachmentsToPdf } from '../utils/attachmentUpload'
import { PENGEMBALIAN_ACCEPT, PENGEMBALIAN_MAX_SIZE_BYTES, describePengembalianStatus, isValidPengembalianFile, uploadAndValidatePengembalian } from '../utils/pengembalianUpload'
import { useTheme } from '../context/ThemeContext'

const FormLpjUmum = () => {
    const { theme } = useTheme()
    const [todayDate, setTodayDate] = useState('')
    const [userData, setUserData] = useState({
        uid: '',
        nama: '',
        unit: [], // Sekarang array
        validator: [],
        reviewer1: [],
        reviewer2: [],
        platKendaraan: []
    })

    const [isSubmitting, setIsSubmitting] = useState(false)

    const initialLpjState = useMemo(() => ({
        nomorBS: '',
        jumlahBS: '',
        lampiran: null,
        lampiranFile: null,
        namaItem: null,
        isLainnya: false,
        jenisLain: '',
        biaya: '',
        jumlah: '',
        keterangan: '',
        plat: '',
        jumlahBiaya: 0,
        totalBiaya: '',
        sisaLebih: '',
        sisaKurang: '',
        tanggalPengajuan: todayDate,
        aktivitas: ''
    }), [todayDate])

    const [tanggalPengajuan, setTanggalPengajuan] = useState('')
    const location = useLocation()
    const navigate = useNavigate() // <-- Tambahkan ini
    const isEditMode = location.state?.isEditMode || false
    const editData = location.state?.editData || null
    const [lpj, setLpj] = useState([initialLpjState])
    const [nomorBS, setNomorBS] = useState(location.state?.nomorBS || '')
    const [jumlahBS, setJumlahBS] = useState(location.state?.jumlahBS || '')
    const [aktivitas] = useState(location.state?.aktivitas || '')

    // --- State untuk Multi File Upload ---
    const [attachmentFiles, setAttachmentFiles] = useState([])

    // --- State untuk bukti pengembalian dana (opsional, muncul jika sisaLebih > 0) ---
    const [pengembalianFile, setPengembalianFile] = useState(null)
    const [isUploadingPengembalian, setIsUploadingPengembalian] = useState(false)

    const [calculatedCosts, setCalculatedCosts] = useState({
        totalBiaya: 0,
        sisaLebih: 0,
        sisaKurang: 0
    })

    useEffect(() => {
        if (todayDate) {
            setLpj((prevLpj) => prevLpj.map((item) => ({ ...item, tanggalPengajuan: todayDate })))
        }
    }, [todayDate])

    useEffect(() => {
        const today = new Date()
        const formattedDate = today.toISOString().split('T')[0]

        setTodayDate(formattedDate)
        setTanggalPengajuan(formattedDate)
    }, [])

    useEffect(() => {
        if (tanggalPengajuan) {
            setLpj((prevLpj) => prevLpj.map((item) => ({ ...item, tanggalPengajuan })))
        }
    }, [tanggalPengajuan])

    const [selectedUnit, setSelectedUnit] = useState(null)
    const [userUnitOptions, setUserUnitOptions] = useState([])
    const [isAdmin, setIsAdmin] = useState(false)
    const [isSuperAdmin, setIsSuperAdmin] = useState(false)

    const [validatorOptions, setValidatorOptions] = useState([])
    const [selectedValidator, setSelectedValidator] = useState(null)

    const [reviewerOptions, setReviewerOptions] = useState([])
    const [selectedReviewer1, setSelectedReviewer1] = useState(null)
    const [selectedReviewer2, setSelectedReviewer2] = useState(null)

    // --- Fetch data validator & reviewer untuk semua role ---
    useEffect(() => {
        const fetchValidators = async () => {
            try {
                const usersRef = collection(db, 'userDirectory')
                const q = query(usersRef, where('role', 'in', ['Validator', 'Admin', 'Reviewer']))
                const querySnapshot = await getDocs(q)

                const options = querySnapshot.docs.map((doc) => {
                    const userData = doc.data()
                    return {
                        value: userData.uid,
                        label: userData.nama,
                        role: userData.role, 
                        unit: userData.unit || []  
                    }
                })

                setValidatorOptions(options)
            } catch (error) {
                console.error('Error fetching validators:', error)
                toast.error('Gagal memuat daftar validator')
            }
        }

        fetchValidators()
    }, [])

    useEffect(() => {
        const fetchReviewer = async () => {
            try {
                const usersRef = collection(db, 'userDirectory')
                const q = query(usersRef, where('role', 'in', ['Reviewer', 'Validator', 'Admin']))
                const querySnapshot = await getDocs(q)

                const options = querySnapshot.docs.map((doc) => {
                    const userData = doc.data()
                    return {
                        value: userData.uid,
                        label: userData.nama,
                        role: userData.role
                    }
                })

                setReviewerOptions(options)
            } catch (error) {
                console.error('Error fetching reviewers:', error)
                toast.error('Gagal memuat daftar reviewer')
            }
        }

        fetchReviewer()
    }, [])

    // Fetch semua plat kendaraan terdaftar (lintas user) untuk pilihan dropdown Plat Nomor (khusus item BBM)
    const [allPlatOptions, setAllPlatOptions] = useState([])
    useEffect(() => {
        const fetchAllPlat = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'userDirectory'))
                const platMap = new Map()

                querySnapshot.docs.forEach((docSnap) => {
                    const data = docSnap.data()
                    const plates = Array.isArray(data.platKendaraan) ? data.platKendaraan : []
                    plates.forEach((plat) => {
                        if (plat && !platMap.has(plat)) {
                            platMap.set(plat, data.nama ? `${plat} - ${data.nama}` : plat)
                        }
                    })
                })

                const options = Array.from(platMap.entries())
                    .map(([value, label]) => ({ value, label }))
                    .sort((a, b) => a.value.localeCompare(b.value))

                setAllPlatOptions(options)
            } catch (error) {
                console.error('Error fetching daftar plat kendaraan:', error)
            }
        }

        fetchAllPlat()
    }, [])

   // --- SIHIR AUTO-FILL: Mengisi Validator & Reviewer Otomatis (Berlaku untuk Semua) ---
    useEffect(() => {
        // Hapus syarat !isAdmin dan syarat jumlah unit, supaya semua user terisi otomatis
        if (userData.uid) { 
            // Auto-fill Validator
            if (validatorOptions.length > 0 && userData.validator?.length > 0) {
                const defaultValidator = validatorOptions.find(opt => userData.validator.includes(opt.value));
                if (defaultValidator) setSelectedValidator(defaultValidator);
            }
            
            // Auto-fill Reviewer 1
            if (reviewerOptions.length > 0 && userData.reviewer1?.length > 0) {
                const defaultRev1 = reviewerOptions.find(opt => userData.reviewer1.includes(opt.value));
                if (defaultRev1) setSelectedReviewer1(defaultRev1);
            }
            
            // Auto-fill Reviewer 2
            if (reviewerOptions.length > 0 && userData.reviewer2?.length > 0) {
                const defaultRev2 = reviewerOptions.find(opt => userData.reviewer2.includes(opt.value));
                if (defaultRev2) setSelectedReviewer2(defaultRev2);
            }
        }
    }, [userData, validatorOptions, reviewerOptions]); // Pastikan dependency-nya diperbarui

    const isSingleUnit = !isSuperAdmin && userUnitOptions.length === 1;;
    
    const BUSINESS_UNITS = useMemo(
        () => [
            { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
            { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
            { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
            { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
            { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
            { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
            { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
            { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' },
            { value: 'Samudera Indonesia', label: 'Samudera Indonesia' },
            { value: 'Samudera Indonesia', label: 'Samudera Indonesia' },
            { value: 'Panitia', label: 'Panitia' }
        ],
        []
    )

    useEffect(() => {
        const today = new Date()
        const formattedDate = today.toISOString().split('T')[0]
        const uid = localStorage.getItem('userUid')

        setTodayDate(formattedDate)

        const fetchUserData = async () => {
            try {
                const userDocRef = doc(db, 'users', uid)
                const userDoc = await getDoc(userDocRef)

                if (userDoc.exists()) {
                    const data = userDoc.data()
                    const adminStatus = data.role === 'Admin' || data.role === 'Super Admin'
                    setIsAdmin(adminStatus)
                    setIsSuperAdmin(data.role === 'Super Admin') 

                    const userUnitsArray = Array.isArray(data.unit) ? data.unit : (data.unit ? [data.unit] : [])

                    setUserData({
                        uid: data.uid || '',
                        nama: data.nama || '',
                        bankName: data.bankName || '',
                        accountNumber: data.accountNumber || '',
                        unit: userUnitsArray,
                        department: data.department || [],
                        validator: data.validator || [],
                        reviewer1: data.reviewer1 || [],
                        reviewer2: data.reviewer2 || [],
                        platKendaraan: Array.isArray(data.platKendaraan) ? data.platKendaraan : []
                    })

                    const unitOptionsForUser = userUnitsArray.map(u => ({ value: u, label: u }))
                    setUserUnitOptions(unitOptionsForUser)

                    if (!adminStatus && unitOptionsForUser.length === 1) {
                        setSelectedUnit(unitOptionsForUser[0])
                    } else if (!adminStatus && unitOptionsForUser.length === 0) {
                        setSelectedUnit(null)
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error)
            }
        }

        fetchUserData()
    }, [])

    const calculateCosts = (lpjItems, jumlahBS) => {
        const totalBiaya = lpjItems.reduce((acc, item) => {
            const biaya = Number(item.biaya) || 0
            const jumlah = Number(item.jumlah) || 0
            return acc + biaya * jumlah
        }, 0)

        const sisaLebih = Math.max(0, jumlahBS - totalBiaya)
        const sisaKurang = Math.max(0, totalBiaya - jumlahBS)

        return {
            totalBiaya,
            sisaLebih,
            sisaKurang
        }
    }

    useEffect(() => {
        const costs = calculateCosts(lpj, jumlahBS)
        setCalculatedCosts(costs)
    }, [lpj, jumlahBS])

    const formatRupiah = (value) => {
        let numberString = (value || '').toString().replace(/[^,\d]/g, '')
        let split = numberString.split(',')
        let sisa = split[0].length % 3
        let rupiah = split[0].substr(0, sisa)
        let ribuan = split[0].substr(sisa).match(/\d{3}/gi)

        if (ribuan) {
            let separator = sisa ? '.' : ''
            rupiah += separator + ribuan.join('.')
        }

        rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah
        return 'Rp' + rupiah
    }

    const handleInputChange = (index, field, value) => {
        const updatedLpj = lpj.map((item, i) => {
            if (i === index) {
                const cleanValue = value.replace(/\D/g, '')
                const numValue = Number(cleanValue)

                if (field === 'biaya') {
                    return {
                        ...item,
                        biaya: numValue,
                        jumlahBiaya: numValue * Number(item.jumlah || 0)
                    }
                } else if (field === 'jumlah') {
                    return {
                        ...item,
                        jumlah: numValue,
                        jumlahBiaya: Number(item.biaya || 0) * numValue
                    }
                }
                return { ...item, [field]: value }
            }
            return item
        })
        setLpj(updatedLpj)
    }

    const handleAddForm = () => {
        setLpj([...lpj, { ...initialLpjState }])
    }

    const handleRemoveForm = (index) => {
        const updatedLpj = lpj.filter((_, i) => i !== index)
        setLpj(updatedLpj)
    }

    const UNIT_CODES = {
        'PT Makassar Jaya Samudera': 'MJS',
        'PT Samudera Makassar Logistik': 'SML',
        'PT Kendari Jaya Samudera': 'KEJS',
        'PT Samudera Kendari Logistik': 'SKEL',
        'PT Samudera Agencies Indonesia': 'SAI',
        'PT SILKargo Indonesia': 'SKI',
        'PT PAD Samudera Perdana': 'SP',
        'PT Masaji Kargosentra Tama': 'MKT',
        'Samudera Indonesia': 'SMDR',
        'Panitia': 'PNTA',
    }

    const getUnitCode = (unitName) => {
        return UNIT_CODES[unitName] || unitName
    }

    // Sama seperti jenisOptions di FormRbsUmum.jsx -- disamakan supaya item LPJ Umum bisa
    // direkap per kategori (menu Rekapan), bukan lagi teks bebas yang tidak bisa dikelompokkan.
    const jenisOptions = useMemo(() => [
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
        { value: 'Lainnya', label: 'Lainnya' }
    ], [])

    // Patokan harga BBM per liter wilayah Sulawesi Selatan (berlaku 1 September 2026, Pertamina Patra Niaga)
    const BBM_PRICE_PER_LITER = {
        'BBM Pertalite': 10000,
        'BBM Pertamax': 16300,
        'BBM Pertamax Turbo': 19600,
        'BBM Solar': 6800
    }

    // Di LPJ, "Biaya" itu harga satuan & "Jumlah" itu kuantitas -- untuk item BBM,
    // itu persis sama dengan harga/liter x liter, jadi tidak perlu field Liter terpisah,
    // cukup relabel Jumlah jadi Liter dan auto-isi Biaya dari patokan harga.
    const isBbmJenis = (item) => !item.isLainnya && !!BBM_PRICE_PER_LITER[item.namaItem?.value]

    const handleNamaItemChange = (index, selectedOption) => {
        const updatedLpj = [...lpj]

        if (selectedOption && selectedOption.value === 'Lainnya') {
            updatedLpj[index] = {
                ...updatedLpj[index],
                namaItem: null,
                isLainnya: true,
                jenisLain: ''
            }
        } else {
            const bbmPrice = BBM_PRICE_PER_LITER[selectedOption?.value]
            const isBbm = !!bbmPrice
            const currentPlat = updatedLpj[index].plat
            const defaultPlat = isBbm && !currentPlat && userData.platKendaraan?.length === 1
                ? userData.platKendaraan[0]
                : currentPlat
            const nextBiaya = isBbm ? bbmPrice : updatedLpj[index].biaya
            const currentJumlah = Number(updatedLpj[index].jumlah || 0)

            updatedLpj[index] = {
                ...updatedLpj[index],
                namaItem: selectedOption,
                isLainnya: false,
                jenisLain: '',
                biaya: nextBiaya,
                plat: isBbm ? defaultPlat : updatedLpj[index].plat,
                jumlahBiaya: isBbm ? Number(nextBiaya) * currentJumlah : updatedLpj[index].jumlahBiaya
            }
        }

        setLpj(updatedLpj)
    }

    const handleNamaItemLainChange = (index, value) => {
        const updatedLpj = [...lpj]
        updatedLpj[index].jenisLain = value
        setLpj(updatedLpj)
    }

    // PENTING: nomor dokumen HARUS didapat dari counter atomik (runTransaction), bukan
    // Math.random() - dengan random, dua pengajuan di unit & hari yang sama punya peluang
    // nyata mendapat nomor (dan path lampiran) yang identik. Firestore akan otomatis retry
    // transaksi ini kalau ada konflik baca-tulis, jadi dua submit tidak mungkin dapat nomor
    // akhir yang sama. Pola ini meniru counter atomik yang sudah dipakai di FormBs.jsx.
    const generateDisplayId = async () => {
        const unitCode = selectedUnit ? getUnitCode(selectedUnit.value) : 'UNKNOWN'
        const today = new Date()
        const year = today.getFullYear().toString()
        const month = (today.getMonth() + 1).toString().padStart(2, '0')
        const day = today.getDate().toString().padStart(2, '0')
        const counterRef = doc(db, 'businessUnitCounters', `${unitCode}_LPJ_GAU`)

        return runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef)
            const newLastNumber = (!counterDoc.exists() || counterDoc.data().lastResetYear !== year)
                ? 1
                : counterDoc.data().lastNumber + 1

            transaction.set(counterRef, { lastNumber: newLastNumber, lastResetYear: year })

            const newDisplayId = `LPJ.GAU.${unitCode}.${year.slice(-2)}${month}${day}.${newLastNumber.toString().padStart(4, '0')}`
            // Dicatat di transaksi yang sama supaya storage.rules bisa memvalidasi
            // kepemilikan lampiran/PDF lewat firestore.get() cross-service (lihat 18.6)
            transaction.set(doc(db, 'displayIdOwners', newDisplayId), { uid: localStorage.getItem('userUid') })

            return newDisplayId
        })
    }

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (!files.length) return

        const validFiles = []
        for (const file of files) {
            if (file.size === 0) {
                toast.error("File lampiran tidak boleh kosong.");
                continue;
            }
            if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
                toast.error(`Ukuran file ${file.name} maksimal 250MB.`);
                continue;
            }
            if (!(await isValidAttachmentFile(file))) {
                toast.error(`File ${file.name} bukan PDF/JPG/PNG yang valid.`);
                continue;
            }
            validFiles.push(file)
        }

        setAttachmentFiles(prev => [...prev, ...validFiles]);
        e.target.value = '';
    }

    const removeAttachment = (indexToRemove) => {
        setAttachmentFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    }

    // --- Gabungkan semua lampiran (PDF/JPG/PNG) jadi SATU file PDF sebelum diupload ---
    const uploadAttachments = async (files, id) => {
        const uploadableFiles = getUploadableAttachments(files);
        if (uploadableFiles.length === 0) return null;

        try {
            const mergedFile = await mergeAttachmentsToPdf(uploadableFiles, `Lampiran_${id}.pdf`)
            return await uploadPdfFile(storage, `lampiran_lpj/${id}_${mergedFile.name}`, mergedFile);
        } catch (error) {
            console.error("Gagal upload lampiran:", error);
            throw error;
        }
    };

    const handlePengembalianFileChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (file.size > PENGEMBALIAN_MAX_SIZE_BYTES) {
            toast.error(`Ukuran file ${file.name} maksimal 250MB.`)
            e.target.value = ''
            return
        }
        if (!(await isValidPengembalianFile(file))) {
            toast.error(`File ${file.name} bukan PDF/JPG/PNG yang valid.`)
            e.target.value = ''
            return
        }

        setPengembalianFile(file)
        e.target.value = ''
    }

    const removePengembalianFile = () => setPengembalianFile(null)

    // Diupload & divalidasi (OCR) SETELAH dokumen LPJ tersimpan, karena
    // validatePengembalianBukti butuh dokumen lpj/{lpjId} sudah ada untuk
    // dibaca & diupdate statusnya. Opsional -- kegagalan di sini tidak
    // membatalkan submit LPJ yang sudah berhasil.
    const uploadPengembalianIfProvided = async (lpjId, displayId) => {
        if (!pengembalianFile) return

        setIsUploadingPengembalian(true)
        try {
            const { status } = await uploadAndValidatePengembalian(lpjId, displayId, pengembalianFile)
            const { label, tone } = describePengembalianStatus(status)
            if (tone === 'success') toast.success(label)
            else toast.warning(label)
        } catch (error) {
            console.error('Gagal upload/validasi bukti pengembalian:', error)
            toast.warning('Gagal mengupload bukti pengembalian. Silakan upload lagi lewat halaman Detail LPJ.')
        } finally {
            setIsUploadingPengembalian(false)
        }
    }

    useEffect(() => {
        if (isEditMode && editData && editData.lpj) {
            
            // 1. Set Data Item LPJ
            // namaItem dulu teks bebas, sekarang dropdown -- data lama (atau pilihan
            // "Lainnya") yang tidak cocok dengan salah satu jenisOptions ditampilkan
            // sebagai mode "Lainnya" dengan teks aslinya tetap utuh, bukan hilang.
            const formattedLPJ = editData.lpj.map(item => {
                const matchedOption = jenisOptions.find(opt => opt.value === item.namaItem)
                return {
                    ...item,
                    biaya: item.biaya?.toString() || '',
                    jumlah: item.jumlah?.toString() || '',
                    plat: item.plat || '',
                    namaItem: matchedOption || null,
                    isLainnya: !matchedOption,
                    jenisLain: matchedOption ? '' : (item.namaItem || '')
                }
            });
            setLpj(formattedLPJ);

            // 2. Set Nomor & Jumlah BS
            setNomorBS(editData.nomorBS || '');
            setJumlahBS(editData.jumlahBS || '');
            
            // 3. Set Lampiran Visual (hanya nama, tidak mendownload file aslinya untuk di-upload ulang)
            if (editData.lampiran && editData.lampiran.length > 0) {
                // Membuat objek tiruan (mock file) hanya agar namanya muncul di layar
                const mockFiles = editData.lampiran.map(name => new File([""], name, { type: 'application/pdf' }));
                setAttachmentFiles(mockFiles);
            }

            // 4. Set Data User Pengaju Asli
            setTimeout(() => {
                if (editData.user) {
                    setUserData(prev => ({
                        ...prev,
                        uid: editData.user.uid,
                        nama: editData.user.nama,
                        bankName: editData.user.bankName || '',
                        accountNumber: editData.user.accountNumber || '',
                        department: editData.user.department || '',
                        platKendaraan: []
                    }));

                    // Ambil plat kendaraan terdaftar terbaru milik pengaju (bukan dari snapshot lama)
                    if (editData.user.uid) {
                        getDoc(doc(db, 'users', editData.user.uid)).then((submitterDoc) => {
                            if (submitterDoc.exists()) {
                                const submitterPlat = submitterDoc.data().platKendaraan
                                setUserData((prev) => ({
                                    ...prev,
                                    platKendaraan: Array.isArray(submitterPlat) ? submitterPlat : []
                                }))
                            }
                        }).catch((error) => console.error('Error fetching plat kendaraan pengaju:', error))
                    }

                    // Set Dropdown Unit
                    if (editData.user.unit) {
                        setSelectedUnit({ value: editData.user.unit, label: editData.user.unit });
                    }

                    // Fungsi pencari opsi dropdown
                    const findOption = (options, val) => options.find(o => o.value === val) || { value: val, label: val };

                    // Set Dropdown Validator & Reviewer
                    if (editData.user.validator && editData.user.validator.length > 0) {
                        setSelectedValidator(findOption(validatorOptions, editData.user.validator[0]));
                    }
                    if (editData.user.reviewer1 && editData.user.reviewer1.length > 0) {
                        setSelectedReviewer1(findOption(reviewerOptions, editData.user.reviewer1[0]));
                    }
                    if (editData.user.reviewer2 && editData.user.reviewer2.length > 0) {
                        setSelectedReviewer2(findOption(reviewerOptions, editData.user.reviewer2[0]));
                    }
                }
            }, 100);
        }
    }, [isEditMode, editData, validatorOptions, reviewerOptions, jenisOptions]);
    
    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)

            if (selectedReviewer1 && selectedReviewer2 && selectedReviewer1.value === selectedReviewer2.value) {
                toast.warning('Reviewer 1 dan Reviewer 2 tidak boleh sama')
                setIsSubmitting(false)
                return
            }

            const missingFields = []

            if (!userData.nama) missingFields.push('Nama')
            if (!selectedUnit?.value) missingFields.push('Unit Bisnis')
            if (!selectedValidator) missingFields.push('Validator')
            if (!selectedReviewer1) missingFields.push('Reviewer 1')
            if (!selectedReviewer2) missingFields.push('Reviewer 2')

            if (!nomorBS) missingFields.push('Nomor Bon Sementara')
            if (!jumlahBS) missingFields.push('Jumlah Bon Sementara')

            const multipleItems = lpj.length > 1

            lpj.forEach((r, index) => {
                const getFieldLabel = (baseLabel) => {
                    return multipleItems ? `${baseLabel} (Item ${index + 1})` : baseLabel
                }

                if (r.isLainnya) {
                    if (!r.jenisLain) missingFields.push(getFieldLabel('Item'))
                } else {
                    if (!r.namaItem) missingFields.push(getFieldLabel('Item'))
                }
                if (!r.biaya) missingFields.push(getFieldLabel('Biaya'))
                if (!r.jumlah) missingFields.push(getFieldLabel('Jumlah'))
                if (isBbmJenis(r) && !r.plat) missingFields.push(getFieldLabel('Plat Kendaraan'))
            })

            if (attachmentFiles.length === 0) {
                missingFields.push('File Lampiran')
            }

            if (missingFields.length > 0) {
                missingFields.forEach((field) => {
                    toast.warning(
                        <>
                            Mohon lengkapi <b>{field}</b>
                        </>
                    )
                })

                setIsSubmitting(false)
                return
            }

            const displayId = isEditMode ? editData.displayId : await generateDisplayId()

            const lampiranUrls = await uploadAttachments(attachmentFiles, displayId)

            const lpjData = {
                user: {
                    uid: userData.uid,
                    nama: userData.nama,
                    bankName: userData.bankName,
                    accountNumber: userData.accountNumber,
                    unit: selectedUnit.value,
                    unitCode: getUnitCode(selectedUnit.value),
                    department: userData.department,
                    validator: [selectedValidator.value],
                    reviewer1: [selectedReviewer1.value],
                    reviewer2: [selectedReviewer2.value]
                },
                lpj: lpj.map((item) => ({
                    namaItem: item.isLainnya ? item.jenisLain : (item.namaItem?.value || item.namaItem),
                    biaya: item.biaya,
                    jumlah: item.jumlah,
                    jumlahBiaya: Number(item.biaya) * Number(item.jumlah),
                    keterangan: item.keterangan,
                    plat: item.plat || ''
                })),
                displayId: displayId,
                aktivitas: aktivitas,
                kategori: 'GA/Umum',
                status: 'Diajukan',
                approvedByReviewer1: false,
                approvedByReviewer2: false,
                approvedBySuperAdmin: false,
                rejectedBySuperAdmin: false,
                nomorBS: nomorBS,
                jumlahBS: jumlahBS,
                ...calculatedCosts,
                tanggalPengajuan: tanggalPengajuan,
                lampiran: [`Lampiran_${displayId}.pdf`],
                lampiranUrl: lampiranUrls,
                statusHistory: [
                    {
                        status: 'Diajukan',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid
                    }
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }

            if (isEditMode) {
                // --- LOGIKA JIKA EDIT (SUPER ADMIN) ---
                const lpjRef = doc(db, 'lpj', editData.id)
                
                // Siapkan data yang akan di-update
                const updateData = {
                    lpj: lpjData.lpj,
                    nomorBS: lpjData.nomorBS,
                    jumlahBS: lpjData.jumlahBS,
                    totalBiaya: lpjData.totalBiaya,
                    sisaLebih: lpjData.sisaLebih,
                    sisaKurang: lpjData.sisaKurang,
                    updatedAt: new Date().toISOString(),
                    statusHistory: arrayUnion({
                        status: 'Data Diubah oleh Super Admin',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid,
                        reason: 'Super Admin mengedit detail form LPJ Umum'
                    })
                };

                // Jika ada file baru yang di-upload, tambahkan ke updateData
                if (getUploadableAttachments(attachmentFiles).length > 0) {
                    updateData.lampiran = lpjData.lampiran;
                    updateData.lampiranUrl = lpjData.lampiranUrl;
                }

                await updateDoc(lpjRef, updateData)
                await uploadPengembalianIfProvided(editData.id, displayId)

                toast.success('LPJ Umum berhasil diperbarui!')
                setIsSubmitting(false)
                navigate('/dashboard') // Arahkan kembali ke tabel

            } else {
                // --- LOGIKA JIKA BIKIN BARU ---
                // Generate ID dulu, setDoc SEKALI SAJA supaya operasi ini murni CREATE.
                const newDocRef = doc(collection(db, 'lpj'))
                await setDoc(newDocRef, { ...lpjData, id: newDocRef.id })
                const docRef = newDocRef

                await uploadPengembalianIfProvided(docRef.id, displayId)

                // --- PERBAIKAN: Hapus Draft setelah berhasil simpan baru ---
                if (typeof clearDraft === 'function') {
                    const draftCleared = await clearDraft();
                    if (!draftCleared) {
                        console.warn('Draft tidak berhasil dihapus otomatis setelah submit.')
                    }
                }

                console.log('LPJ berhasil dibuat:', {
                    firestoreId: docRef.id,
                    displayId: displayId
                })
                toast.success('LPJ GA/Umum berhasil dibuat')

                resetForm()
                setIsSubmitting(false)

                // Diarahkan ke dashboard, bukan /lpj/cek-pengajuan (rute itu khusus
                // Reviewer/Validator/Admin/Super Admin -> Employee biasa akan ditolak
                // ProtectedRoute dan berujung ke halaman 404).
                navigate('/dashboard')
            }
        } catch (error) {
            console.error('Error submitting lpj:', error)
            toast.error('Terjadi kesalahan saat menyimpan data. Silakan coba lagi.')
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setLpj([initialLpjState])
        setNomorBS('')
        setJumlahBS(0)
        setCalculatedCosts({
            totalBiaya: 0,
            sisaLebih: 0,
            sisaKurang: 0
        })

        const fileInputs = document.querySelectorAll('input[type="file"]')
        fileInputs.forEach((input) => (input.value = ''))

        setAttachmentFiles([])
        setPengembalianFile(null)

        if (isAdmin || userUnitOptions.length > 1) {
            setSelectedUnit(null)
        }

        setSelectedValidator(null)
        setSelectedReviewer1(null)
        setSelectedReviewer2(null)
    }

    const renderFileUpload = () => {
        return (
            <div className="flex flex-col items-start w-full">
                <div className="flex flex-col xl:flex-row items-start xl:items-center w-full">
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept={ATTACHMENT_ACCEPT}
                        multiple
                        onChange={handleFileUpload}
                    />
                    <label
                        htmlFor="file-upload"
                        className="w-full xl:w-fit text-center h-full xl:h-10 px-4 py-4 xl:py-2 bg-gray-50 dark:bg-gray-700 xl:bg-gray-200 dark:xl:bg-gray-700 border dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 hover:border-gray-400 transition duration-300 ease-in-out dark:text-gray-200"
                    >
                        Upload File
                    </label>
                    <span className="ml-0 xl:ml-4 text-gray-500 dark:text-gray-400 mt-2 xl:mt-0 text-sm">
                        Format .pdf/.jpg/.png, bisa lebih dari 1 file (Max Size: 250MB/file)
                    </span>
                </div>
                
                {attachmentFiles.length > 0 && (
                    <div className="mt-3 w-full">
                        {attachmentFiles.map((file, index) => (
                            <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded mb-2 border border-gray-200 dark:border-gray-600">
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[80%]">{file.name}</span>
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(index)}
                                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2 font-bold"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    useEffect(() => {
        if (location.state?.aktivitas) {
            setLpj((prevLpj) =>
                prevLpj.map((item) => ({
                    ...item,
                    aktivitas: location.state.aktivitas
                }))
            )
        }

        if (location.state) {
            if (location.state.unit) {
                const unitOption = BUSINESS_UNITS.find((unit) => unit.value === location.state.unit)
                if (unitOption) {
                    setSelectedUnit(unitOption)
                }
            }

            if (location.state.validator?.[0]) {
                if (validatorOptions.length > 0) {
                    const validatorOption = validatorOptions.find((v) => v.value === location.state.validator[0])
                    if (validatorOption) {
                        setSelectedValidator(validatorOption)
                    }
                }
            }
        }
   }, [location.state, validatorOptions, BUSINESS_UNITS])

    // --- TAMBAHAN KODE: customStyles diubah supaya warna kotak jadi abu-abu kalau disable ---
    const isDark = theme === 'dark'
    const customStyles = {
        control: (base, state) => ({
            ...base,
            padding: '0 7px',
            height: '40px',
            minHeight: '40px',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            backgroundColor: state.isDisabled ? (isDark ? '#374151' : '#f9fafb') : (isDark ? '#1f2937' : 'white'),
            cursor: state.isDisabled ? 'not-allowed' : 'default',
            '&:hover': {
                borderColor: state.isDisabled ? (isDark ? '#4b5563' : '#e5e7eb') : '#3b82f6'
            }
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '0 7px',
            height: '40px',
            minHeight: '40px'
        }),
        singleValue: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        input: (base) => ({ ...base, color: isDark ? '#f3f4f6' : '#111827' }),
        placeholder: (base) => ({ ...base, color: isDark ? '#9ca3af' : '#6b7280' }),
        menu: (base) => ({ ...base, zIndex: 100, backgroundColor: isDark ? '#1f2937' : '#ffffff' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: isDark
                ? (state.isSelected ? '#374151' : state.isFocused ? '#2d3748' : '#1f2937')
                : base.backgroundColor,
            color: isDark ? '#f3f4f6' : base.color,
            cursor: 'pointer'
        })
    }

    
    // PENTING: draftId diikat ke nomorBS, BUKAN string statis 'draft'.
    // Sebelumnya semua LPJ (untuk BS apa pun) berbagi SATU slot draft yang sama,
    // sehingga draft lama milik BS-A ikut ter-load / menimpa form BS-B yang baru
    // mau dikerjakan. Dengan ini, setiap nomor BS punya slot draft sendiri-sendiri
    // (${uid}_lpj-umum_${nomorBS}), jadi "Load Draft"/auto-load hanya aktif kalau
    // memang ada draft tersimpan untuk nomor BS yang sedang dikerjakan saat ini.
    const { hasDraft, saveDraft, loadDraft, clearDraft } = useFormDraft(db, userData, 'lpj-umum', nomorBS || 'baru')

    const handleSaveDraft = async () => {
        const filePromises = attachmentFiles.map((file) => {
            return new Promise((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve({
                    name: file.name,
                    type: file.type,
                    base64: reader.result
                })
                reader.readAsDataURL(file)
            })
        })

        const attachmentBase64Array = await Promise.all(filePromises)
        
        const formData = {
            nomorBS,
            jumlahBS,
            lpj: lpj.map((item) => ({
                namaItem: item.namaItem,
                biaya: item.biaya,
                jumlah: item.jumlah,
                jumlahBiaya: Number(item.biaya) * Number(item.jumlah),
                keterangan: item.keterangan,
                plat: item.plat || ''
            })),
            tanggalPengajuan,
            attachmentFiles: attachmentBase64Array, 
            selectedUnit: selectedUnit ? {
                value: selectedUnit.value,
                label: selectedUnit.label
            } : null,
            selectedValidator: selectedValidator ? {
                value: selectedValidator.value,
                label: selectedValidator.label
            } : null,
            selectedReviewer1: selectedReviewer1 ? {
                value: selectedReviewer1.value,
                label: selectedReviewer1.label
            } : null,
            selectedReviewer2: selectedReviewer2 ? {
                value: selectedReviewer2.value,
                label: selectedReviewer2.label
            } : null,
            calculatedCosts
        };
        
        await saveDraft(formData);

        resetForm()
    }

    useEffect(() => {
        if (location.state && location.state.nomorBS) {
            setNomorBS(location.state.nomorBS); 
        }
    }, [location.state]);

    const handleLoadDraft = useCallback(async () => {
        const draftData = await loadDraft();
        if (draftData) {
            setNomorBS(draftData.nomorBS || '');
            setJumlahBS(draftData.jumlahBS || '');
            setLpj(draftData.lpj || [initialLpjState]);
            setTanggalPengajuan(draftData.tanggalPengajuan || todayDate);
            
            if (draftData.attachmentFiles && draftData.attachmentFiles.length > 0) {
                const reconstructedFiles = await Promise.all(draftData.attachmentFiles.map(async (fileData) => {
                    const base64Response = await fetch(fileData.base64)
                    const blob = await base64Response.blob()
                    return new File([blob], fileData.name, { type: fileData.type })
                }))
                setAttachmentFiles(reconstructedFiles)
            }
            
            setSelectedUnit(draftData.selectedUnit || null);
            setSelectedValidator(draftData.selectedValidator || null);
            setSelectedReviewer1(draftData.selectedReviewer1 || null);
            setSelectedReviewer2(draftData.selectedReviewer2 || null);
            
            setCalculatedCosts(draftData.calculatedCosts || {
                totalBiaya: 0,
                sisaLebih: 0,
                sisaKurang: 0
            });
        }
    }, [initialLpjState, loadDraft, todayDate])

    // Guard supaya auto-load draft dari navigasi (klik draft di tabel) cuma
    // jalan SEKALI. Sebelumnya pakai window.history.replaceState untuk "membersihkan"
    // location.state, tapi itu tidak benar-benar mengubah location.state versi
    // React Router -- akibatnya effect di bawah terus menganggap kondisinya
    // terpenuhi dan memicu ulang dirinya sendiri terus-menerus (infinite loop,
    // toast "Draft berhasil dimuat" menumpuk, browser sampai men-throttle navigasi).
    const draftAutoLoadedRef = useRef(false)

    useEffect(() => {
        if (
            location.state &&
            location.state.nomorBS &&
            hasDraft &&
            !draftAutoLoadedRef.current
        ) {
            draftAutoLoadedRef.current = true
            handleLoadDraft();
            // Bersihkan location.state lewat React Router sendiri (bukan
            // window.history langsung) supaya location.state benar-benar hilang
            // dari state React Router, bukan cuma dari address bar.
            navigate(location.pathname, { replace: true, state: {} })
        }
    }, [handleLoadDraft, hasDraft, location.state, location.pathname, navigate]);

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4 dark:text-gray-100">
                Tambah <span className="font-bold">LPJ Bon Sementara GA/Umum</span>
            </h2>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                    {/* Row 1 */}
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Nama Lengkap</label>
                        <input
                            className="w-full h-10 px-4 py-2 border dark:border-gray-600 rounded-md text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                            type="text"
                            value={userData.nama}
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                            Validator <span className="text-red-500">*</span>
                        </label>
                        <Select
                            options={validatorOptions}
                            value={selectedValidator}
                            onChange={setSelectedValidator}
                            placeholder="Pilih Validator"
                            className="basic-single"
                            classNamePrefix="select"
                            styles={customStyles}
                            isSearchable={true}
                            isClearable={true}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                            isDisabled={isSingleUnit}
                        />
                    </div>

                    {/* Row 2 */}
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                            Unit Bisnis <span className="text-red-500">*</span>
                        </label>
                        
                        {isSingleUnit ? (
                            <input
                                className="w-full h-10 px-4 py-2 border dark:border-gray-600 rounded-md text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                                type="text"
                                value={selectedUnit ? selectedUnit.label : ''}
                                disabled
                            />
                        ) : (
                            <Select
                               options={isSuperAdmin ? BUSINESS_UNITS : userUnitOptions}
                                value={selectedUnit}
                                onChange={setSelectedUnit}
                                placeholder="Pilih Unit Bisnis"
                                className="basic-single"
                                classNamePrefix="select"
                                styles={customStyles}
                                isSearchable={false}
                                menuPortalTarget={document.body}
                                menuPosition="absolute"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                            Reviewer 1 <span className="text-red-500">*</span>
                        </label>
                        <Select
                            options={reviewerOptions}
                            value={selectedReviewer1}
                            onChange={setSelectedReviewer1}
                            placeholder="Pilih Reviewer 1"
                            className="basic-single"
                            classNamePrefix="select"
                            styles={customStyles}
                            isSearchable={true}
                            isClearable={true}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                            isDisabled={isSingleUnit}
                        />
                    </div>

                    {/* Row 3 */}
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                            Nomor Bon Sementara <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            type="text"
                            value={nomorBS}
                            onChange={(e) => setNomorBS(e.target.value)}
                            placeholder="Masukkan nomor bon sementara"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                            Reviewer 2 <span className="text-red-500">*</span>
                        </label>
                        <Select
                            options={reviewerOptions}
                            value={selectedReviewer2}
                            onChange={setSelectedReviewer2}
                            placeholder="Pilih Reviewer 2"
                            className="basic-single"
                            classNamePrefix="select"
                            styles={customStyles}
                            isSearchable={true}
                            isClearable={true}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                            isDisabled={isSingleUnit}
                        />
                    </div>

                    {/* Row 4 */}
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                            Jumlah Bon Sementara <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            type="text"
                            value={jumlahBS ? formatRupiah(jumlahBS) : ''}
                            onChange={(e) => {
                                const cleanValue = e.target.value.replace(/\D/g, '')
                                const value = Number(cleanValue)
                                if (value >= 0) {
                                    setJumlahBS(value)
                                }
                            }}
                            placeholder="Masukkan jumlah bon sementara tanpa Rp"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                            Lampiran <span className="text-red-500">*</span>
                        </label>
                        {renderFileUpload()}
                    </div>

                    {/* Row 5 */}
                    <div>
                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Tanggal Pengajuan</label>
                        <input
                            type="date"
                            value={tanggalPengajuan}
                            onChange={(e) => setTanggalPengajuan(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-transparent rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                        />
                    </div>
                </div>

                <hr className="border-gray-300 dark:border-gray-600 my-6" />

                {lpj.map((item, index) => (
                    <div key={index}>
                        {index > 0 && <hr className="border-gray-300 dark:border-gray-600 my-6 block xl:hidden" />}

                        <div className="flex flex-col xl:flex-row justify-stretch gap-2 mb-2">
                            <div className="flex-grow">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 xl:hidden">
                                        Item <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 dark:text-gray-300 font-medium mb-2">
                                        Item <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {item.isLainnya ? (
                                    <input
                                        type="text"
                                        placeholder="Item lain"
                                        value={item.jenisLain}
                                        onChange={(e) => handleNamaItemLainChange(index, e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                    />
                                ) : (
                                    <Select
                                        options={jenisOptions}
                                        value={item.namaItem}
                                        onChange={(selectedOption) => handleNamaItemChange(index, selectedOption)}
                                        placeholder="Pilih item..."
                                        className="w-full"
                                        styles={customStyles}
                                        isSearchable={false}
                                        menuPortalTarget={document.body}
                                        menuPosition="absolute"
                                    />
                                )}
                            </div>
                            <div className="flex flex-row gap-2">
                                <div className="flex-1">
                                    {(index === 0 || window.innerWidth < 1280) && (
                                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 xl:hidden">
                                            {isBbmJenis(item) ? 'Harga/Liter' : 'Biaya'} <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    {index === 0 && (
                                        <label className="hidden xl:block text-gray-700 dark:text-gray-300 font-medium mb-2">
                                            {isBbmJenis(item) ? 'Harga/Liter' : 'Biaya'} <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    <input
                                        type="text"
                                        value={formatRupiah(item.biaya)}
                                        onChange={(e) => handleInputChange(index, 'biaya', e.target.value)}
                                        className="w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                    />
                                </div>

                                <div className="max-w-24">
                                    {(index === 0 || window.innerWidth < 1280) && (
                                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 xl:hidden">
                                            {isBbmJenis(item) ? 'Liter' : 'Jumlah'} <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    {index === 0 && (
                                        <label className="hidden xl:block text-gray-700 dark:text-gray-300 font-medium mb-2">
                                            {isBbmJenis(item) ? 'Liter' : 'Jumlah'} <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    <input
                                        type="number"
                                        value={item.jumlah}
                                        onChange={(e) => {
                                            const inputValue = e.target.value
                                            const formattedValue = inputValue.replace(/^0+/, '')
                                            const value = Number(formattedValue)
                                            if (formattedValue === '' || value >= 0) {
                                                handleInputChange(index, 'jumlah', formattedValue)
                                            }
                                        }}
                                        className="w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                    />
                                </div>
                            </div>

                            {isBbmJenis(item) && (
                                <div className="max-w-40">
                                    {(index === 0 || window.innerWidth < 1280) && (
                                        <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 xl:hidden">
                                            Plat Nomor <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    {index === 0 && (
                                        <label className="hidden xl:block text-gray-700 dark:text-gray-300 font-medium mb-2">
                                            Plat Nomor <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    <CreatableSelect
                                        isClearable
                                        options={allPlatOptions}
                                        value={item.plat ? { value: item.plat, label: item.plat } : null}
                                        onChange={(selectedOption) => {
                                            const raw = selectedOption ? selectedOption.value : ''
                                            const filteredValue = raw.toUpperCase().replace(/[^A-Z0-9\s]/g, '')
                                            handleInputChange(index, 'plat', filteredValue)
                                        }}
                                        placeholder="Pilih/ketik plat..."
                                        formatCreateLabel={(input) => `Gunakan "${input.toUpperCase()}"`}
                                        styles={customStyles}
                                        menuPortalTarget={document.body}
                                        menuPosition="absolute"
                                    />
                                </div>
                            )}

                            <div>
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 xl:hidden">Keterangan</label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 dark:text-gray-300 font-medium mb-2">Keterangan</label>
                                )}
                                <textarea
                                    type="text"
                                    value={item.keterangan}
                                    style={{scrollbarWidth: 'none'}}
                                    onChange={(e) => handleInputChange(index, 'keterangan', e.target.value)}
                                    className="w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2 resize-none"
                                />
                            </div>

                            <div>
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 xl:hidden">
                                        Jumlah Biaya
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 dark:text-gray-300 font-medium mb-2">
                                        Jumlah Biaya
                                    </label>
                                )}
                                <input
                                    type="text"
                                    value={formatRupiah(item.jumlahBiaya)}
                                    className="w-full border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-md h-10 px-4 py-2 cursor-not-allowed"
                                    disabled
                                />
                            </div>

                            <div className="flex-1 items-end my-2 xl:max-w-20 xl:my-0">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2 xl:hidden"></label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 dark:text-gray-300 font-medium mb-2">&nbsp;</label>
                                )}
                                <button
                                    className="w-full h-10 px-4 py-2 bg-transparent text-red-500 dark:text-red-400 border border-red-500 dark:border-red-500 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition duration-300"
                                    onClick={() => handleRemoveForm(index)}
                                >
                                    Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="mb-4 w-full text-center xl:text-start">
                    <span
                        className="text-red-600 dark:text-red-400 font-bold underline cursor-pointer hover:text-red-700 dark:hover:text-red-300"
                        onClick={handleAddForm}
                    >
                        Tambah
                    </span>
                </div>

                {/* Bagian Total Biaya */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-0 xl:gap-4 my-6 xl:flex xl:flex-1">
                    <div className="w-1/2"></div>
                    <div className="text-left flex flex-col xl:block">
                        <div className="flex flex-col md:flex-row mb-1 md:mb-0">
                            <span>Total Biaya</span>
                            <span className="xl:hidden">: {formatRupiah(calculatedCosts.totalBiaya || 0)}</span>
                        </div>
                        <div className="flex flex-col md:flex-row mb-1 md:mb-0">
                            <span>Sisa Lebih Bon Sementara</span>
                            <span className="xl:hidden">: {formatRupiah(calculatedCosts.sisaLebih || 0)}</span>
                        </div>
                        <div className="flex flex-col md:flex-row mb-1 md:mb-0">
                            <span>Sisa Kurang Dibayarkan ke Pegawai</span>
                            <span className="xl:hidden">: {formatRupiah(calculatedCosts.sisaKurang || 0)}</span>
                        </div>
                    </div>
                    <div className="text-left hidden xl:block font-medium text-gray-800 dark:text-gray-200">
                        <span>: {formatRupiah(calculatedCosts.totalBiaya || 0)}</span>
                        <br />
                        <span>: {formatRupiah(calculatedCosts.sisaLebih || 0)}</span>
                        <br />
                        <span>: {formatRupiah(calculatedCosts.sisaKurang || 0)}</span>
                    </div>
                </div>

                <hr className="border-gray-300 dark:border-gray-600 my-6" />

                {calculatedCosts.sisaLebih > 0 && (
                    <div className="mb-6 p-4 border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                            BS ini ada pengembalian dana ke perusahaan sebesar{' '}
                            <span className="font-bold text-red-600">{formatRupiah(calculatedCosts.sisaLebih)}</span>.
                            {' '}Upload bukti pengembalian (opsional) — kalau di-skip, sistem akan mengirim reminder email tiap 2 hari sampai bukti diupload &amp; sesuai.
                        </p>
                        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2">
                            <input
                                type="file"
                                id="pengembalian-upload"
                                className="hidden"
                                accept={PENGEMBALIAN_ACCEPT}
                                onChange={handlePengembalianFileChange}
                            />
                            <label
                                htmlFor="pengembalian-upload"
                                className="text-center px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-200"
                            >
                                Upload Bukti Pengembalian
                            </label>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">Format .pdf/.jpg/.png, Max Size: 250MB</span>
                        </div>
                        {pengembalianFile && (
                            <div className="flex justify-between items-center bg-white dark:bg-gray-700 px-3 py-2 rounded mt-3 border border-gray-200 dark:border-gray-600">
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[80%]">{pengembalianFile.name}</span>
                                <button
                                    type="button"
                                    onClick={removePengembalianFile}
                                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 ml-2 font-bold"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                        )}
                        {isUploadingPengembalian && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" /> Memvalidasi bukti pengembalian...
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col-reverse xl:flex-row justify-end mt-6 gap-4">
                    <button
                        className={`w-full xl:w-fit rounded py-3 px-16 text-red-600 bg-transparent hover:bg-red-50 hover:text-red-800 border border-red-600 hover:border-red-800
                        flex items-center justify-center relative transition duration-150 ease-in-out`}
                        onClick={hasDraft ? handleLoadDraft : handleSaveDraft}
                    >
                        {hasDraft ? 'Load Draft' : 'Save Draft'}
                    </button>

                    <button
                        className={`w-full xl:w-fit rounded text-white py-3 
                        ${isSubmitting ? 'px-8 bg-red-700 cursor-not-allowed' : 'px-16 bg-red-600 hover:bg-red-700 hover:text-gray-200'}
                        flex items-center justify-center relative`}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center gap-1 text-gray-200">
                                <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                                Submitting...
                            </div>
                        ) : (
                            'Submit'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FormLpjUmum