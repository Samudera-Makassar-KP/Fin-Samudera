import React, { useState, useEffect, useMemo } from 'react'
import { doc, setDoc, getDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebaseConfig'
import Select from 'react-select'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import useFormDraft from '../hooks/useFormDraft'

const FormLpjUmum = () => {
    const [todayDate, setTodayDate] = useState('')
    const [userData, setUserData] = useState({
        uid: '',
        nama: '',
        unit: '',
        validator: [],
        reviewer1: [],
        reviewer2: []
    })

    const [isSubmitting, setIsSubmitting] = useState(false)

    const initialLpjState = {
        nomorBS: '',
        jumlahBS: '',
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

    const [tanggalPengajuan, setTanggalPengajuan] = useState('')
    const location = useLocation()
    const [lpj, setLpj] = useState([initialLpjState])
    const [nomorBS, setNomorBS] = useState(location.state?.nomorBS || '')
    const [jumlahBS, setJumlahBS] = useState(location.state?.jumlahBS || '')
    const [aktivitas] = useState(location.state?.aktivitas || '')

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

    const [attachmentFile, setAttachmentFile] = useState(null)
    const [attachmentFileName, setAttachmentFileName] = useState('')

    const [selectedUnit, setSelectedUnit] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)

    const [validatorOptions, setValidatorOptions] = useState([])
    const [selectedValidator, setSelectedValidator] = useState(null)

    const [reviewerOptions, setReviewerOptions] = useState([])
    const [selectedReviewer1, setSelectedReviewer1] = useState(null)
    const [selectedReviewer2, setSelectedReviewer2] = useState(null)

    useEffect(() => {
        const fetchValidators = async () => {
            try {
                const usersRef = collection(db, 'users')
                const q = query(usersRef, where('role', 'in', ['Validator']))
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

        if (isAdmin) {
            fetchValidators()
        }
    }, [isAdmin])

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
                console.error('Error fetching validators:', error)
                toast.error('Gagal memuat daftar reviewer')
            }
        }

        if (isAdmin) {
            fetchReviewer()
        }
    }, [isAdmin])

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
            { value: 'Samudera', label: 'Samudera' }
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

                    const adminStatus = data.role === 'Admin'
                    setIsAdmin(adminStatus)

                    setUserData({
                        uid: data.uid || '',
                        nama: data.nama || '',
                        bankName: data.bankName || '',
                        accountNumber: data.accountNumber || '',
                        unit: data.unit || '',
                        department: data.department || [],
                        validator: data.validator || [],
                        reviewer1: data.reviewer1 || [],
                        reviewer2: data.reviewer2 || []
                    })

                    setSelectedUnit(isAdmin ? null : { value: data.unit, label: data.unit })
                }
            } catch (error) {
                console.error('Error fetching user data:', error)
            }
        }

        fetchUserData()
    }, [isAdmin])

    const calculateCosts = (lpjItems, jumlahBS) => {
        // Calculate total biaya
        const totalBiaya = lpjItems.reduce((acc, item) => {
            const biaya = Number(item.biaya) || 0
            const jumlah = Number(item.jumlah) || 0
            return acc + biaya * jumlah
        }, 0)

        // Calculate sisa lebih atau kurang
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
        // Memastikan bahwa value adalah string
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

    // Mapping nama unit ke singkatan
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
        return UNIT_CODES[unitName] || unitName // Fallback ke nama unit jika tidak ada di mapping
    }

    const generateDisplayId = (unit) => {
        const today = new Date()
        const year = today.getFullYear().toString().slice(-2)
        const month = (today.getMonth() + 1).toString().padStart(2, '0')
        const day = today.getDate().toString().padStart(2, '0')
        const sequence = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0')
        const unitCode = getUnitCode(selectedUnit.value)

        return `LPJ.GAU.${unitCode}.${year}${month}${day}.${sequence}`
    }

    const handleFileUpload = (event) => {
        const file = event.target.files[0]
        if (!file) return

        // Validate file size (250MB limit)
        if (file.size > 250 * 1024 * 1024) {
            toast.error('Ukuran file maksimal 250MB')
            event.target.value = '' // Clear the file input
            return
        }

        // Validate file type (PDF only)
        if (file.type !== 'application/pdf') {
            toast.error('Hanya file PDF yang diperbolehkan')
            event.target.value = '' // Clear the file input
            return
        }

        // Set single file for all items
        setAttachmentFile(file)
        setAttachmentFileName(file.name)
    }

    const uploadAttachment = async (file, displayId) => {
        if (!file) return null

        try {
            const newFileName = `Lampiran_${displayId}.pdf`

            // Create a reference to the storage location
            const storageRef = ref(storage, `LPJ/GA_Umum/${displayId}/${newFileName}`)

            // Upload the file
            const snapshot = await uploadBytes(storageRef, file)

            // Get the download URL
            const downloadURL = await getDownloadURL(snapshot.ref)

            return downloadURL
        } catch (error) {
            console.error('Error uploading file:', error)
            toast.error('Gagal mengunggah lampiran')
            return null
        }
    }

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)

            // Validasi reviewer1 dan reviewer2 tidak boleh sama
            if (selectedReviewer1 && selectedReviewer2 && selectedReviewer1.value === selectedReviewer2.value) {
                toast.warning('Reviewer 1 dan Reviewer 2 tidak boleh sama')
                setIsSubmitting(false)
                return
            }

            // Validasi form
            const missingFields = []

            // Validasi data pengguna
            if (!userData.nama) missingFields.push('Nama')
            if (!selectedUnit?.value) missingFields.push('Unit Bisnis')
            if (isAdmin && !selectedValidator) missingFields.push('Validator')
            if (isAdmin && !selectedReviewer1) missingFields.push('Reviewer 1')
            if (isAdmin && !selectedReviewer2) missingFields.push('Reviewer 2')

            // Tambahkan validasi untuk form-level fields
            if (!nomorBS) missingFields.push('Nomor Bon Sementara')
            if (!jumlahBS) missingFields.push('Jumlah Bon Sementara')

            // Validasi setiap reimbursement
            const multipleItems = lpj.length > 1

            // Iterasi langsung pada lpj untuk validasi
            lpj.forEach((r, index) => {
                // Fungsi untuk menambahkan keterangan item dengan kondisional
                const getFieldLabel = (baseLabel) => {
                    return multipleItems ? `${baseLabel} (Item ${index + 1})` : baseLabel
                }

                if (!r.namaItem) missingFields.push(getFieldLabel('Item'))
                if (!r.biaya) missingFields.push(getFieldLabel('Biaya'))
                if (!r.jumlah) missingFields.push(getFieldLabel('Jumlah'))
            })

            // Validasi lampiran file
            if (!attachmentFile) {
                missingFields.push('File Lampiran')
            }

            // Tampilkan pesan warning jika ada field yang kosong
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

            // Generate display ID untuk user
            const displayId = generateDisplayId(userData.unit)

            // Upload attachment
            const lampiranUrl = await uploadAttachment(attachmentFile, displayId)

            const lpjData = {
                user: {
                    uid: userData.uid,
                    nama: userData.nama,
                    bankName: userData.bankName,
                    accountNumber: userData.accountNumber,
                    unit: selectedUnit.value,
                    unitCode: getUnitCode(selectedUnit.value),
                    department: userData.department,
                    validator: isAdmin ? [selectedValidator.value] : userData.validator,
                    reviewer1: isAdmin ? [selectedReviewer1.value] : userData.reviewer1,
                    reviewer2: isAdmin ? [selectedReviewer2.value] : userData.reviewer2
                },
                lpj: lpj.map((item) => ({
                    namaItem: item.namaItem,
                    biaya: item.biaya,
                    jumlah: item.jumlah,
                    jumlahBiaya: Number(item.biaya) * Number(item.jumlah),
                    keterangan: item.keterangan
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
                lampiran: attachmentFileName,
                lampiranUrl: lampiranUrl,
                statusHistory: [
                    {
                        status: 'Diajukan',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid
                    }
                ]
            }

            // Simpan ke Firestore
            const docRef = await addDoc(collection(db, 'lpj'), lpjData)

            // Update dengan ID dokumen
            await setDoc(doc(db, 'lpj', docRef.id), { ...lpjData, id: docRef.id })

            // Reset unit bisnis ke unit awal untuk admin
            if (isAdmin) {
                setSelectedUnit({ value: userData.unit, label: userData.unit })
            }

            console.log('LPJ berhasil dibuat:', {
                firestoreId: docRef.id,
                displayId: displayId
            })
            toast.success('LPJ GA/Umum berhasil dibuat')

            // Reset form setelah berhasil submit
            if (isAdmin) {
                setSelectedValidator(null)
            }
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
        setCalculatedCosts({
            totalBiaya: 0,
            sisaLebih: 0,
            sisaKurang: 0
        })

        // Reset file inputs
        const fileInputs = document.querySelectorAll('input[type="file"]')
        fileInputs.forEach((input) => (input.value = ''))

        // Reset attachment state
        setAttachmentFile(null)
        setAttachmentFileName('')

        // Reset all selector states for admin
        if (isAdmin) {
            setSelectedUnit(null)
            setSelectedValidator(null)
            setSelectedReviewer1(null)
            setSelectedReviewer2(null)
        }
    }

    // Render file upload section
    const renderFileUpload = () => {
        return (
            <div className="flex flex-col xl:flex-row items-start xl:items-center">
                <input type="file" id="file-upload" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                <label
                    htmlFor="file-upload"
                    className="w-full xl:w-fit text-center h-full xl:h-10 px-4 py-4 xl:py-2 bg-gray-50 xl:bg-gray-200 border rounded-md cursor-pointer hover:bg-gray-300 hover:border-gray-400 transition duration-300 ease-in-out"
                >
                    Upload File
                </label>
                <span className="ml-0 xl:ml-4 text-gray-500">
                    {attachmentFileName ? `File: ${attachmentFileName}` : 'Format .pdf Max Size: 250MB'}
                </span>
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

        if (isAdmin && location.state) {
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
    }, [location.state, isAdmin, validatorOptions, BUSINESS_UNITS])

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

    const { hasDraft, saveDraft, loadDraft } = useFormDraft(db, userData, 'lpj-umum', initialLpjState)

    const handleSaveDraft = async () => {
        let attachmentBase64 = null;
        if (attachmentFile) {
            const reader = new FileReader();
            attachmentBase64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(attachmentFile);
            });
        }
        
        const formData = {
            nomorBS,
            jumlahBS,
            lpj: lpj.map((item) => ({
                namaItem: item.namaItem,
                biaya: item.biaya,
                jumlah: item.jumlah,
                jumlahBiaya: Number(item.biaya) * Number(item.jumlah),
                keterangan: item.keterangan
            })),
            tanggalPengajuan,
            attachmentFileName,
            attachmentFile: attachmentBase64,
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

    const handleLoadDraft = async () => {
        const draftData = await loadDraft();
        if (draftData) {
            setNomorBS(draftData.nomorBS || '');
            setJumlahBS(draftData.jumlahBS || '');
            setLpj(draftData.lpj || [initialLpjState]);
            setTanggalPengajuan(draftData.tanggalPengajuan || todayDate);
            setAttachmentFileName(draftData.attachmentFileName || '');
            
            // Convert base64 kembali ke File object jika ada file
            if (draftData.attachmentFile) {
                // Extract MIME type dari base64 string
                const mimeType = draftData.attachmentFile.split(';')[0].split(':')[1];
                
                // Convert base64 ke blob
                const base64Response = await fetch(draftData.attachmentFile);
                const blob = await base64Response.blob();
                
                // Buat File object baru
                const file = new File([blob], draftData.attachmentFileName, {
                    type: mimeType
                });
                
                setAttachmentFile(file);
            }
            
            if (isAdmin) {
                setSelectedUnit(draftData.selectedUnit || null);
                setSelectedValidator(draftData.selectedValidator || null);
                setSelectedReviewer1(draftData.selectedReviewer1 || null);
                setSelectedReviewer2(draftData.selectedReviewer2 || null);
            }
            
            setCalculatedCosts(draftData.calculatedCosts || {
                totalBiaya: 0,
                sisaLebih: 0,
                sisaKurang: 0
            });
        }
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Tambah <span className="font-bold">LPJ Bon Sementara GA/Umum</span>
            </h2>

            <div className="bg-white p-6 rounded-lg shadow">
                {isAdmin ? (
                    // Layout untuk Role Admin
                    <>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Nama Lengkap</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={userData.nama}
                                    disabled
                                />
                            </div>
                            <div className='block xl:hidden'>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Unit Bisnis {isAdmin && <span className="text-red-500">*</span>}
                                </label>
                                    <Select
                                        options={BUSINESS_UNITS}
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
                            <div className="hidden xl:block">
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
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div className="block xl:hidden">
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
                                />
                            </div>
                            <div className='block xl:hidden'>
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
                            <div className='block xl:hidden'>
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
                            <div className='hidden xl:block'>
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
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
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
                            <div className='hidden xl:block'>
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
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Tanggal Pengajuan</label>
                                <input
                                    type="date"
                                    value={tanggalPengajuan}
                                    onChange={(e) => setTanggalPengajuan(e.target.value)}
                                    className="w-full border border-gray-300 text-gray-900 bg-transparent rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                />
                            </div>
                            <div className='hidden xl:block'>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Lampiran <span className="text-red-500">*</span>
                                </label>
                                {renderFileUpload()}
                            </div>
                            <div className="block xl:hidden">
                                <label className="block text-gray-700 font-medium mb-2">
                                    Lampiran <span className="text-red-500">*</span>
                                </label>
                                {renderFileUpload()}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div className='hidden xl:block'>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Unit Bisnis <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    options={BUSINESS_UNITS}
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
                        </div>
                    </>
                ) : (
                    // Layout untuk Role Non-Admin
                    <>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Nama Lengkap</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={userData.nama}
                                    disabled
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Unit Bisnis {isAdmin && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={selectedUnit?.label || ''}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
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
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Tanggal Pengajuan</label>
                                <input
                                    type="date"
                                    value={tanggalPengajuan}
                                    onChange={(e) => setTanggalPengajuan(e.target.value)}
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
                    </>
                )}

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
                                    className="w-full border border-gray-300 text-gray-900 rounded-md h-10 px-4 py-2 cursor-not-allowed"
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
                                    className="w-full h-10 px-4 py-2 bg-transparent text-red-500 border border-red-500 rounded-md hover:bg-red-100"
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
                    <div className="text-left hidden xl:block">
                        <span>: {formatRupiah(calculatedCosts.totalBiaya || 0)}</span>
                        <br />
                        <span>: {formatRupiah(calculatedCosts.sisaLebih || 0)}</span>
                        <br />
                        <span>: {formatRupiah(calculatedCosts.sisaKurang || 0)}</span>
                    </div>
                </div>

                <hr className="border-gray-300 my-6" />

                {calculatedCosts.sisaLebih > 0 && (
                    <div className="text-right">
                        *Pastikan sudah memasukkan bukti pengembalian dana sebesar{' '}
                        <span className="font-bold "> {formatRupiah(calculatedCosts.sisaLebih)}</span> di lampiran
                    </div>
                )}

                <div className="flex flex-col-reverse xl:flex-row justify-end mt-6 gap-4">
                    <button
                        className={`w-full xl:w-fit rounded py-3 px-16
                            ${hasDraft 
                                ? 'text-red-600 bg-transparent hover:text-red-800 border border-red-600 hover:border-red-800' 
                                : 'text-red-600 bg-transparent hover:text-red-800 border border-red-600 hover:border-red-800'
                            }
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
                                <>
                                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                                    Submitting...
                                </>
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
