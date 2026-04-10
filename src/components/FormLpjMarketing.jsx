import React, { useState, useEffect, useMemo } from 'react'
import { doc, setDoc, getDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebaseConfig'
import Select from 'react-select'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons'
import useFormDraft from '../hooks/useFormDraft'

const FormLpjMarketing = () => {
    const [todayDate, setTodayDate] = useState('')
    const [userData, setUserData] = useState({
        uid: '',
        nama: '',
        unit: [], // Sekarang array
        validator: [],
        reviewer1: [],
        reviewer2: []
    })

    const [isSubmitting, setIsSubmitting] = useState(false)

    const initialLpjState = {
        nomorBS: '',
        jumlahBS: '',
        project: '',
        nomorJO: '',
        customer: '',
        lokasi: '',
        tanggal: '',
        lampiran: null,
        lampiranFile: null,
        namaItem: '',
        biaya: '',
        jumlah: '',
        keterangan: '',
        jumlahBiaya: 0,
        totalBiaya: '',
        sisaLebih: '',
        sisaKurang: '',
        tanggalPengajuan: todayDate,
        aktivitas: ''
    }

    const location = useLocation()
    const [lpj, setLpj] = useState([initialLpjState])
    const [nomorBS, setNomorBS] = useState(location.state?.nomorBS || '')
    const [jumlahBS, setJumlahBS] = useState(location.state?.jumlahBS || '')
    const [project, setProject] = useState(location.state?.project || '')
    const [nomorJO, setNomorJO] = useState(location.state?.nomorJO || '')
    const [customer, setCustomer] = useState(location.state?.customer || '')
    const [lokasi, setLokasi] = useState(location.state?.lokasi || '')
    const [tanggal, setTanggal] = useState(location.state?.tanggal || '')
    const [tanggalPengajuan, setTanggalPengajuan] = useState('')
    const [aktivitas, setAktivitas] = useState(location.state?.aktivitas || '')

    // --- State untuk Multi File Upload ---
    const [attachmentFiles, setAttachmentFiles] = useState([])

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

    const [validatorOptions, setValidatorOptions] = useState([])
    const [selectedValidator, setSelectedValidator] = useState(null)

    const [reviewerOptions, setReviewerOptions] = useState([])
    const [selectedReviewer1, setSelectedReviewer1] = useState(null)
    const [selectedReviewer2, setSelectedReviewer2] = useState(null)

    // --- Fetch data validator & reviewer untuk semua role ---
    useEffect(() => {
        const fetchValidators = async () => {
            try {
                const usersRef = collection(db, 'users')
                const q = query(usersRef, where('role', 'in', ['Validator', 'Admin']))
                const querySnapshot = await getDocs(q)

                const options = querySnapshot.docs.map((doc) => {
                    const userData = doc.data()
                    return {
                        value: userData.uid,
                        label: userData.nama,
                        role: userData.role
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
                const usersRef = collection(db, 'users')
                const q = query(usersRef, where('role', 'in', ['Reviewer']))
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

    // Logika Auto-Fill Validator & Reviewer untuk user dengan 1 Unit Bisnis
    useEffect(() => {
        if (!isAdmin && userUnitOptions.length === 1) {
            // Auto-fill Validator (Abaikan blok ini khusus untuk file FormBs)
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
    }, [isAdmin, userUnitOptions.length, validatorOptions, reviewerOptions, userData]);

    const isSingleUnit = !isAdmin && userUnitOptions.length === 1;

    const BUSINESS_UNITS = useMemo(
        () => [
            { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
            { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
            { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
            { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
            { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
            { value: 'PT SILkargo Indonesia', label: 'PT SILkargo Indonesia' },
            { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
            { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' },
            { value: 'Samudera', label: 'Samudera' },
            { value: 'Panitia SISCO', label: 'Panitia SISCO' }
        ],
        []
    )

    useEffect(() => {
        const today = new Date()
        const formattedDate = today.toISOString().split('T')[0]

        setTodayDate(formattedDate)

        const uid = localStorage.getItem('userUid')

        const fetchUserData = async () => {
            try {
                const userDocRef = doc(db, 'users', uid)
                const userDoc = await getDoc(userDocRef)

                if (userDoc.exists()) {
                    const data = userDoc.data()
                    const adminStatus = data.role === 'Admin' || data.role === 'Super Admin'
                    setIsAdmin(adminStatus)

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
                        reviewer2: data.reviewer2 || []
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
        'Samudera': 'SMDR',
    }

    const getUnitCode = (unitName) => {
        return UNIT_CODES[unitName] || unitName
    }

    const generateDisplayId = () => {
        const today = new Date()
        const year = today.getFullYear().toString().slice(-2)
        const month = (today.getMonth() + 1).toString().padStart(2, '0')
        const day = today.getDate().toString().padStart(2, '0')
        const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        const unitCode = selectedUnit ? getUnitCode(selectedUnit.value) : 'UNKNOWN'

        return `LPJ.MRO.${unitCode}.${year}${month}${day}.${sequence}`
    }

    // --- Fungsi handler upload untuk multi file ---
    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files)
        if (!files.length) return

        const validFiles = []
        for (let file of files) {
            if (file.size > 250 * 1024 * 1024) {
                toast.error(`Ukuran file ${file.name} maksimal 250MB`)
                continue
            }
            if (file.type !== 'application/pdf') {
                toast.error(`File ${file.name} bukan PDF, hanya PDF yang diperbolehkan`)
                continue
            }
            validFiles.push(file)
        }

        setAttachmentFiles(prev => [...prev, ...validFiles])
        event.target.value = ''
    }

    const removeAttachment = (indexToRemove) => {
        setAttachmentFiles(prev => prev.filter((_, index) => index !== indexToRemove))
    }

    // --- Mengupload banyak file sekaligus ---
    const uploadAttachments = async (files, displayId) => {
        if (!files || files.length === 0) return []

        try {
            const uploadPromises = files.map(async (file, index) => {
                const newFileName = `Lampiran_${index + 1}_${displayId}.pdf`
                const storageRef = ref(storage, `LPJ/Marketing_Operasional/${displayId}/${newFileName}`)
                const snapshot = await uploadBytes(storageRef, file)
                return await getDownloadURL(snapshot.ref)
            })

            return await Promise.all(uploadPromises)
        } catch (error) {
            console.error('Error uploading files:', error)
            toast.error('Gagal mengunggah lampiran')
            return []
        }
    }

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)

            if (selectedReviewer1 && selectedReviewer2 && selectedReviewer1.value === selectedReviewer2.value) {
                toast.warning('Reviewer 1 dan Reviewer 2 tidak boleh sama')
                setIsSubmitting(false)
                return
            }

            const missingFields = []

            // Validasi seragam
            if (!userData.nama) missingFields.push('Nama')
            if (!selectedUnit?.value) missingFields.push('Unit Bisnis')
            if (!selectedValidator) missingFields.push('Validator')
            if (!selectedReviewer1) missingFields.push('Reviewer 1')
            if (!selectedReviewer2) missingFields.push('Reviewer 2')

            if (!nomorBS) missingFields.push('Nomor Bon Sementara')
            if (!jumlahBS) missingFields.push('Jumlah Bon Sementara')
            if (!project) missingFields.push('Project')
            if (!nomorJO) missingFields.push('Nomor Job Order')
            if (!customer) missingFields.push('Customer')
            if (!lokasi) missingFields.push('Lokasi')
            if (!tanggal) missingFields.push('Tanggal Kegiatan')

            const multipleItems = lpj.length > 1

            lpj.forEach((r, index) => {
                const getFieldLabel = (baseLabel) => {
                    return multipleItems ? `${baseLabel} (Item ${index + 1})` : baseLabel
                }

                if (!r.namaItem) missingFields.push(getFieldLabel('Item'))
                if (!r.biaya) missingFields.push(getFieldLabel('Biaya'))
                if (!r.jumlah) missingFields.push(getFieldLabel('Jumlah'))
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

            const displayId = generateDisplayId()
            
            const lampiranUrls = await uploadAttachments(attachmentFiles, displayId)

            const totalBiaya = lpj.reduce((total, item) => {
                const biayaNumber = parseInt(item.biaya.toString().replace(/[^0-9]/g, '')) || 0
                const jumlahNumber = parseInt(item.jumlah.toString().replace(/[^0-9]/g, '')) || 0
                return total + (biayaNumber * jumlahNumber)
            }, 0)

            const parseRupiah = (value) => {
                return Number(value.replace(/[^,\d]/g, '').replace(',', '.')) || 0
            }

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
                    namaItem: item.namaItem,
                    biaya: parseRupiah(item.biaya.toString()),
                    jumlah: item.jumlah,
                    jumlahBiaya: Number(item.biaya) * Number(item.jumlah),
                    keterangan: item.keterangan
                })),
                displayId: displayId,
                aktivitas: aktivitas,
                kategori: 'Marketing/Operasional',
                status: 'Diajukan',
                approvedByReviewer1: false,
                approvedByReviewer2: false,
                approvedBySuperAdmin: false,
                rejectedBySuperAdmin: false,
                nomorBS: nomorBS,
                jumlahBS: jumlahBS,
                project: project,
                nomorJO: nomorJO,
                customer: customer,
                lokasi: lokasi,
                ...calculatedCosts,
                tanggalPengajuan: tanggalPengajuan,
                tanggal: tanggal,
                // --- Simpan array lampiran ---
                lampiran: attachmentFiles.map(f => f.name),
                lampiranUrl: lampiranUrls,
                totalBiaya: totalBiaya,
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

            const docRef = await addDoc(collection(db, 'lpj'), lpjData)
            await setDoc(doc(db, 'lpj', docRef.id), { ...lpjData, id: docRef.id })

            console.log('LPJ berhasil dibuat:', {
                firestoreId: docRef.id,
                displayId: displayId
            })
            toast.success('LPJ Marketing/Operasional berhasil dibuat')

            resetForm()
            setIsSubmitting(false)
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
        setProject('')
        setNomorJO('')
        setCustomer('')
        setLokasi('')
        setTanggal('')
        setAktivitas('')
        setCalculatedCosts({
            totalBiaya: 0,
            sisaLebih: 0,
            sisaKurang: 0
        })

        const fileInputs = document.querySelectorAll('input[type="file"]')
        fileInputs.forEach((input) => (input.value = ''))

        setAttachmentFiles([])

        if (isAdmin || userUnitOptions.length > 1) {
            setSelectedUnit(null)
        }

        setSelectedValidator(null)
        setSelectedReviewer1(null)
        setSelectedReviewer2(null)
    }

    // --- Tampilan UI untuk Multi Upload ---
    const renderFileUpload = () => {
        return (
            <div className="flex flex-col items-start w-full">
                <div className="flex flex-col xl:flex-row items-start xl:items-center w-full">
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf"
                        multiple
                        onChange={handleFileUpload}
                    />
                    <label
                        htmlFor="file-upload"
                        className="w-full xl:w-fit text-center h-full xl:h-10 px-4 py-4 xl:py-2 bg-gray-50 xl:bg-gray-200 border rounded-md cursor-pointer hover:bg-gray-300 hover:border-gray-400 transition duration-300 ease-in-out"
                    >
                        Upload File
                    </label>
                    <span className="ml-0 xl:ml-4 text-gray-500 mt-2 xl:mt-0 text-sm">
                        Format .pdf Max Size: 250MB
                    </span>
                </div>
                
                {attachmentFiles.length > 0 && (
                    <div className="mt-3 w-full">
                        {attachmentFiles.map((file, index) => (
                            <div key={index} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded mb-2 border border-gray-200">
                                <span className="text-sm text-gray-700 truncate max-w-[80%]">{file.name}</span>
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(index)}
                                    className="text-red-500 hover:text-red-700 ml-2 font-bold"
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

    const customStyles = {
        control: (base) => ({
            ...base,
            padding: '0 7px',
            height: '40px',
            minHeight: '40px',
            borderColor: '#e5e7eb',
            '&:hover': {
                borderColor: '#3b82f6'
            }
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '0 7px',
            height: '40px',
            minHeight: '40px'
        })
    }

    const { hasDraft, saveDraft, loadDraft } = useFormDraft(db, userData, 'lpj-marketing', initialLpjState)

    // --- Mengubah handling file pada saveDraft ---
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
            project,
            nomorJO,
            customer,
            lokasi,
            tanggal,
            lpj: lpj.map((item) => ({
                namaItem: item.namaItem,
                biaya: item.biaya,
                jumlah: item.jumlah,
                jumlahBiaya: Number(item.biaya) * Number(item.jumlah),
                keterangan: item.keterangan
            })),
            tanggalPengajuan,
            aktivitas,
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
        }
        
        await saveDraft(formData)
        resetForm();
    }
    
    // --- Mengubah handling file pada loadDraft ---
    const handleLoadDraft = async () => {
        const draftData = await loadDraft()
        if (draftData) {
            setNomorBS(draftData.nomorBS || '')
            setJumlahBS(draftData.jumlahBS || '')
            setProject(draftData.project || '')
            setNomorJO(draftData.nomorJO || '')
            setCustomer(draftData.customer || '')
            setLokasi(draftData.lokasi || '')
            setTanggal(draftData.tanggal || '')
            setLpj(draftData.lpj || [initialLpjState])
            setTanggalPengajuan(draftData.tanggalPengajuan || todayDate)
            setAktivitas(draftData.aktivitas || '')
            
            // Reconstruct files from base64 array
            if (draftData.attachmentFiles && draftData.attachmentFiles.length > 0) {
                const reconstructedFiles = await Promise.all(draftData.attachmentFiles.map(async (fileData) => {
                    const base64Response = await fetch(fileData.base64)
                    const blob = await base64Response.blob()
                    return new File([blob], fileData.name, { type: fileData.type })
                }))
                setAttachmentFiles(reconstructedFiles)
            }
            
            setSelectedUnit(draftData.selectedUnit || null)
            setSelectedValidator(draftData.selectedValidator || null)
            setSelectedReviewer1(draftData.selectedReviewer1 || null)
            setSelectedReviewer2(draftData.selectedReviewer2 || null)
            
            setCalculatedCosts(draftData.calculatedCosts || {
                totalBiaya: 0,
                sisaLebih: 0,
                sisaKurang: 0
            })
        }
    }
    
    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Tambah <span className="font-bold">LPJ Bon Sementara Marketing/Operasional</span>
            </h2>

            <div className="bg-white p-6 rounded-lg shadow">
                {/* --- Layout diseragamkan untuk semua role --- */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                    {/* Row 1 */}
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">Nama Lengkap</label>
                        <input
                            className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 bg-gray-50 cursor-not-allowed"
                            type="text"
                            value={userData.nama}
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
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
                        <label className="block text-gray-700 font-medium mb-2">
                            Unit Bisnis <span className="text-red-500">*</span>
                        </label>
                        <Select
                            options={isAdmin ? BUSINESS_UNITS : userUnitOptions}
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
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
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
                        />
                    </div>

                    {/* Row 3 */}
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">Nomor Rekening</label>
                        <input
                            className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 bg-gray-50 cursor-not-allowed"
                            type="text"
                            value={userData.accountNumber}
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
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
                        />
                    </div>

                    {/* Row 4 */}
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">Nama Bank</label>
                        <input
                            className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 bg-gray-50 cursor-not-allowed"
                            type="text"
                            value={userData.bankName}
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Tanggal Pengajuan
                        </label>
                        <input
                            type="date"
                            value={tanggalPengajuan}
                            onChange={(e) => setTanggalPengajuan(e.target.value)}
                            className="w-full border border-gray-300 text-gray-900 bg-transparent rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                        />
                    </div>

                    {/* Row 5 */}
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Nomor Bon Sementara <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            type="text"
                            value={nomorBS}
                            onChange={(e) => setNomorBS(e.target.value)}
                            placeholder="Masukkan nomor bon sementara"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Jumlah Bon Sementara <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
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
                    
                    {/* Row 6 */}
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Project <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            type="text"
                            value={project}
                            onChange={(e) => setProject(e.target.value)}
                            placeholder="Masukkan nama project"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Nomor Job Order <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            type="text"
                            value={nomorJO}
                            onChange={(e) => setNomorJO(e.target.value)}
                            placeholder="Masukkan nomor job order"
                        />
                    </div>

                    {/* Row 7 */}
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Customer <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            type="text"
                            value={customer}
                            onChange={(e) => setCustomer(e.target.value)}
                            placeholder="Masukkan nama customer"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Lokasi <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full h-10 px-4 py-2 border text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            type="text"
                            value={lokasi}
                            onChange={(e) => setLokasi(e.target.value)}
                            placeholder="Masukkan lokasi"
                        />
                    </div>

                    {/* Row 8 */}
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Tanggal Kegiatan <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={tanggal}
                            onChange={(e) => setTanggal(e.target.value)}
                            className="w-full border border-gray-300 text-gray-900 bg-transparent rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">
                            Lampiran <span className="text-red-500">*</span>
                        </label>
                        {renderFileUpload()}
                    </div>
                </div>

                <hr className="border-gray-300 my-6" />

                {lpj.map((item, index) => (
                    <div key={index}>
                        {index > 0 && <hr className="border-gray-300 my-6 block xl:hidden" />}

                        <div className="flex flex-col xl:flex-row justify-stretch gap-2 mb-2">
                            <div className="flex-grow">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                        Item <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                        Item <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <input
                                    type="text"
                                    value={item.namaItem}
                                    onChange={(e) => handleInputChange(index, 'namaItem', e.target.value)}
                                    className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                />
                            </div>
                            <div className="flex flex-row gap-2">
                                <div className="flex-1">
                                    {(index === 0 || window.innerWidth < 1280) && (
                                        <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                            Biaya <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    {index === 0 && (
                                        <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                            Biaya <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    <input
                                        type="text"
                                        value={formatRupiah(item.biaya)}
                                        onChange={(e) => handleInputChange(index, 'biaya', e.target.value)}
                                        className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                    />
                                </div>

                                <div className="max-w-24">
                                    {(index === 0 || window.innerWidth < 1280) && (
                                        <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                            Jumlah <span className="text-red-500">*</span>
                                        </label>
                                    )}
                                    {index === 0 && (
                                        <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                            Jumlah <span className="text-red-500">*</span>
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
                                        className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                    />
                                </div>
                            </div>

                            <div>
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">Keterangan</label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">Keterangan</label>
                                )}
                                <textarea
                                    type="text"
                                    value={item.keterangan}
                                    style={{scrollbarWidth: 'none'}}
                                    onChange={(e) => handleInputChange(index, 'keterangan', e.target.value)}
                                    className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2 resize-none"
                                />
                            </div>

                            <div>
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                        Jumlah Biaya
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                        Jumlah Biaya
                                    </label>
                                )}
                                <input
                                    type="text"
                                    value={formatRupiah(item.jumlahBiaya)}
                                    className="w-full border border-gray-300 text-gray-900 bg-gray-50 rounded-md h-10 px-4 py-2 cursor-not-allowed"
                                    disabled
                                />
                            </div>

                            <div className="flex-1 items-end my-2 xl:max-w-20 xl:my-0">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden"></label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">&nbsp;</label>
                                )}
                                <button
                                    className="w-full h-10 px-4 py-2 bg-transparent text-red-500 border border-red-500 rounded-md hover:bg-red-100 transition duration-300"
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
                        className="text-red-600 font-bold underline cursor-pointer hover:text-red-700"
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
                    <div className="text-left hidden xl:block font-medium text-gray-800">
                        <span>: {formatRupiah(calculatedCosts.totalBiaya || 0)}</span>
                        <br />
                        <span>: {formatRupiah(calculatedCosts.sisaLebih || 0)}</span>
                        <br />
                        <span>: {formatRupiah(calculatedCosts.sisaKurang || 0)}</span>
                    </div>
                </div>

                <hr className="border-gray-300 my-6" />

                {calculatedCosts.sisaLebih > 0 && (
                    <div className="text-right text-gray-700">
                        *Pastikan sudah memasukkan bukti pengembalian dana sebesar{' '}
                        <span className="font-bold text-red-600"> {formatRupiah(calculatedCosts.sisaLebih)}</span> di lampiran
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

export default FormLpjMarketing