import React, { useState, useEffect } from 'react'
import { doc, setDoc, getDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebaseConfig'
import Select from 'react-select'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

const RbsOperasionalForm = () => {
    const [todayDate, setTodayDate] = useState('')
    const [userData, setUserData] = useState({
        uid: '',
        nama: '',
        bankName: '',
        accountNumber: '',
        unit: '',
        validator: [],
        reviewer1: [],
        reviewer2: []
    })

    const [isSubmitting, setIsSubmitting] = useState(false)

    const initialReimbursementState = {
        jenis: '',
        biaya: '',
        kebutuhan: '',
        keterangan: '',
        tanggal: '',
        lampiran: null,
        lampiranFile: null,
        isLainnya: false,
        jenisLain: '',
        tanggalPengajuan: todayDate
    }

    const [reimbursements, setReimbursements] = useState([initialReimbursementState])

    useEffect(() => {
        if (todayDate) {
            setReimbursements((prevReimbursements) =>
                prevReimbursements.map((item) => ({ ...item, tanggalPengajuan: todayDate }))
            )
        }
    }, [todayDate])

    const [attachmentFile, setAttachmentFile] = useState(null)
    const [attachmentFileName, setAttachmentFileName] = useState('')

    const [selectedUnit, setSelectedUnit] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [validatorOptions, setValidatorOptions] = useState([])
    const [selectedValidator, setSelectedValidator] = useState(null)

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

    const BUSINESS_UNITS = [
        { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
        { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
        { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
        { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
        { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
        { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
        { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
        { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' }
    ]

    const jenisOptions = [
        { value: 'Entertaint', label: 'Entertaint' },
        { value: 'Meals Lembur', label: 'Meals Lembur' },
        { value: 'Parkir', label: 'Parkir' },
        { value: 'Toll', label: 'Toll' },
        { value: 'Lainnya', label: 'Lainnya' }
    ]

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

                    setSelectedUnit(
                        isAdmin
                            ? null
                            : { value: data.unit, label: data.unit }
                    )
                }
            } catch (error) {
                console.error('Error fetching user data:', error)
            }
        }

        fetchUserData()
    }, [isAdmin])

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A'
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(date)
    }

    const resetForm = () => {
        // Reset reimbursements to initial state with one empty form
        setReimbursements([
            {
                ...initialReimbursementState,
                tanggalPengajuan: todayDate
            }
        ])

        // Reset file inputs
        const fileInputs = document.querySelectorAll('input[type="file"]')
        fileInputs.forEach(input => input.value = '')

        // Reset attachment state
        setAttachmentFile(null)
        setAttachmentFileName('')
    }

    const formatRupiah = (number) => {
        const strNumber = number.replace(/[^,\d]/g, '').toString()
        const split = strNumber.split(',')
        const sisa = split[0].length % 3
        let rupiah = split[0].substr(0, sisa)
        const ribuan = split[0].substr(sisa).match(/\d{3}/gi)

        if (ribuan) {
            const separator = sisa ? '.' : ''
            rupiah += separator + ribuan.join('.')
        }

        rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah
        return 'Rp' + rupiah
    }

    const handleAddForm = () => {
        setReimbursements([...reimbursements, { ...initialReimbursementState, tanggalPengajuan: todayDate }])
    }

    const handleRemoveForm = (index) => {
        const updatedReimbursements = reimbursements.filter((_, i) => i !== index)
        setReimbursements(updatedReimbursements)
    }

    const handleInputChange = (index, field, value) => {
        let formattedValue = value

        if (field === 'biaya') {
            formattedValue = formatRupiah(value)
        }

        const updatedReimbursements = reimbursements.map((item, i) =>
            i === index ? { ...item, [field]: formattedValue } : item
        )
        setReimbursements(updatedReimbursements)
    }

    const handleJenisChange = (index, selectedOption) => {
        const updatedReimbursements = [...reimbursements]

        if (selectedOption && selectedOption.value === 'Lainnya') {
            updatedReimbursements[index] = {
                ...updatedReimbursements[index],
                jenis: null,
                isLainnya: true,
                jenisLain: ''
            }
        } else {
            updatedReimbursements[index] = {
                ...updatedReimbursements[index],
                jenis: selectedOption,
                isLainnya: false,
                jenisLain: ''
            }
        }

        setReimbursements(updatedReimbursements)
    }

    const handleJenisLainChange = (index, value) => {
        const updatedReimbursements = [...reimbursements]
        updatedReimbursements[index].jenisLain = value
        setReimbursements(updatedReimbursements)
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
        'PT Masaji Kargosentra Tama': 'MKT'
    }

    const getUnitCode = (unitName) => {
        return UNIT_CODES[unitName] || unitName // Fallback ke nama unit jika tidak ada di mapping
    }

    const generateDisplayId = (unit) => {
        const today = new Date()
        const year = today.getFullYear().toString().slice(-2)
        const month = (today.getMonth() + 1).toString().padStart(2, '0')
        const day = today.getDate().toString().padStart(2, '0')
        const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        const unitCode = getUnitCode(selectedUnit.value)

        return `RBS.OPR.${unitCode}.${year}${month}${day}.${sequence}`
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
            const storageRef = ref(storage, `Reimbursement/Operasional/${displayId}/${newFileName}`)

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

            // Validasi form dengan pesan spesifik
            const missingFields = []

            // Validasi data pengguna
            if (!userData.nama) missingFields.push('Nama')
            if (!selectedUnit?.value) missingFields.push('Unit')
            if (isAdmin && !selectedValidator) missingFields.push('Validator')

            // Tentukan apakah ada lebih dari satu item reimbursement
            const multipleItems = reimbursements.length > 1

            // Validasi setiap reimbursement
            reimbursements.forEach((r, index) => {
                // Fungsi untuk menambahkan keterangan item dengan kondisional
                const getFieldLabel = (baseLabel) => {
                    return multipleItems ? `${baseLabel} (Item ${index + 1})` : baseLabel
                }

                // Logika validasi tergantung pada apakah isLainnya bernilai true atau false
                if (r.isLainnya) {
                    if (!r.jenisLain) missingFields.push(getFieldLabel('Jenis Reimbursement'))
                    if (!r.biaya) missingFields.push(getFieldLabel('Biaya'))
                    if (!r.kebutuhan) missingFields.push(getFieldLabel('Kebutuhan'))
                    if (!r.tanggal) missingFields.push(getFieldLabel('Tanggal Aktivitas'))
                } else {
                    if (!r.jenis) missingFields.push(getFieldLabel('Jenis Reimbursement'))
                    if (!r.biaya) missingFields.push(getFieldLabel('Biaya'))
                    if (!r.kebutuhan) missingFields.push(getFieldLabel('Kebutuhan'))
                    if (!r.tanggal) missingFields.push(getFieldLabel('Tanggal Aktivitas'))
                }
            })

            // Validasi lampiran file global (jika ada)
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

                setIsSubmitting(false);
                return
            }

            // Generate display ID untuk user
            const displayId = generateDisplayId(userData.unit)

            // Upload attachment
            const lampiranUrl = await uploadAttachment(attachmentFile, displayId)

            // Hitung total biaya
            const totalBiaya = reimbursements.reduce((total, item) => {
                const biayaNumber = parseInt(item.biaya.replace(/[^0-9]/g, ''))
                return total + biayaNumber
            }, 0)

            // Fungsi untuk mengonversi format Rupiah ke angka
            const parseRupiah = (value) => {
                return Number(value.replace(/[^,\d]/g, '').replace(',', '.')) || 0
            }

            // Map data reimbursement langsung saat akan disimpan
            const reimbursementData = {
                user: {
                    uid: userData.uid,
                    nama: userData.nama,
                    bankName: userData.bankName,
                    accountNumber: userData.accountNumber,
                    unit: selectedUnit.value,
                    unitCode: getUnitCode(selectedUnit.value),
                    department: userData.department,
                    validator: isAdmin ? [selectedValidator.value] : userData.validator,
                    reviewer1: userData.reviewer1,
                    reviewer2: userData.reviewer2
                },
                reimbursements: reimbursements.map((item) => ({
                    biaya: parseRupiah(item.biaya),
                    kebutuhan: item.kebutuhan,
                    keterangan: item.keterangan,
                    tanggal: item.tanggal,
                    isLainnya: item.isLainnya,
                    jenis: item.isLainnya ? item.jenisLain : item.jenis.value,
                })),
                displayId: displayId,
                kategori: 'Operasional',
                status: 'Diajukan',
                approvedByReviewer1: false,
                approvedByReviewer2: false,
                approvedBySuperAdmin: false,
                rejectedBySuperAdmin: false,
                tanggalPengajuan: todayDate,
                lampiran: attachmentFileName,
                lampiranUrl: lampiranUrl,
                totalBiaya: totalBiaya,
                statusHistory: [
                    {
                        status: 'Diajukan',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid
                    }
                ]
            }

            // Simpan ke Firestore
            const docRef = await addDoc(collection(db, 'reimbursement'), reimbursementData)

            // Update dengan ID dokumen
            await setDoc(doc(db, 'reimbursement', docRef.id), { ...reimbursementData, id: docRef.id });

            // Reset unit bisnis ke unit awal untuk admin
            if (isAdmin) {
                setSelectedUnit({ value: userData.unit, label: userData.unit })
            }

            console.log('Reimbursement berhasil dibuat:', {
                firestoreId: docRef.id,
                displayId: displayId
            })
            toast.success('Reimbursement Operasional berhasil diajukan!')

            // Reset form setelah berhasil submit
            if (isAdmin) {
                setSelectedValidator(null)
            }
            resetForm()
            setIsSubmitting(false)
        } catch (error) {
            console.error('Error submitting reimbursement:', error)
            toast.error('Terjadi kesalahan saat menyimpan data. Silakan coba lagi.')

            setIsSubmitting(false)

        }
    }

    // Render file upload section for each reimbursement form
    const renderFileUpload = () => {
        return (
            <div className="flex flex-col xl:flex-row items-start xl:items-center">
                <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileUpload}
                />
                <label
                    htmlFor="file-upload"
                    className="w-full xl:w-fit text-center h-full xl:h-10 px-4 py-4 xl:py-2 bg-gray-50 xl:bg-gray-200 border rounded-md cursor-pointer hover:bg-gray-300 hover:border-gray-400 transition duration-300 ease-in-out"
                >
                    Upload File
                </label>
                <span className="ml-0 xl:ml-4 text-gray-500">
                    {attachmentFileName
                        ? `File: ${attachmentFileName}`
                        : 'Format .pdf Max Size: 250MB'}
                </span>
            </div>
        )
    }

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
        }),
        menuList: (base) => ({
            ...base,
            maxHeight: '160px'
        })
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Tambah <span className="font-bold">Reimbursement Operasional</span>
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
                            <div>
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
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div className='block xl:hidden'>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Validator <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    options={validatorOptions}
                                    value={selectedValidator}
                                    onChange={setSelectedValidator}
                                    placeholder="Pilih Validator..."
                                    className="basic-single"
                                    classNamePrefix="select"
                                    styles={customStyles}
                                    isSearchable={true}
                                    isClearable={true}
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Nomor Rekening</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={userData.accountNumber}
                                    disabled
                                />
                            </div>
                            <div className='hidden xl:block'>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Validator <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    options={validatorOptions}
                                    value={selectedValidator}
                                    onChange={setSelectedValidator}
                                    placeholder="Pilih Validator..."
                                    className="basic-single"
                                    classNamePrefix="select"
                                    styles={customStyles}
                                    isSearchable={true}
                                    isClearable={true}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Nama Bank</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={userData.bankName}
                                    disabled
                                />
                            </div>
                            <div className='hidden xl:block'>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Lampiran <span className="text-red-500">*</span>
                                </label>
                                {renderFileUpload()}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Tanggal Pengajuan</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={formatDate(todayDate)}
                                    disabled
                                />
                            </div>
                            <div className='block xl:hidden'>
                                <label className="block text-gray-700 font-medium mb-2">
                                    Lampiran <span className="text-red-500">*</span>
                                </label>
                                {renderFileUpload()}
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
                                <label className="block text-gray-700 font-medium mb-2">Nomor Rekening</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={userData.accountNumber}
                                    disabled
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Nama Bank</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={userData.bankName}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2">Tanggal Pengajuan</label>
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 cursor-not-allowed"
                                    type="text"
                                    value={formatDate(todayDate)}
                                    disabled
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

                {reimbursements.map((reimbursement, index) => (
                    <div key={index}>
                        {index > 0 && (
                            <hr className="border-gray-300 my-6 block xl:hidden" />
                        )}

                        <div className="flex flex-col xl:flex-row justify-stretch gap-2 mb-2">
                            <div className="flex-1 w-full xl:min-w-44">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                        Jenis Reimbursement <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                        Jenis Reimbursement <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <div key={index}>
                                    {reimbursement.isLainnya ? (
                                        <input
                                            type="text"
                                            placeholder="Jenis lain"
                                            value={reimbursement.jenisLain}
                                            onChange={(e) => handleJenisLainChange(index, e.target.value)}
                                            className="w-full h-10 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    ) : (
                                        <Select
                                            options={jenisOptions}
                                            value={reimbursement.jenis}
                                            onChange={(selectedOption) => handleJenisChange(index, selectedOption)}
                                            placeholder="Pilih jenis..."
                                            className="w-full"
                                            styles={customStyles}                                            
                                            isSearchable={false}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 w-full xl:max-w-36">
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
                                    className="w-full h-10 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    type="text"
                                    value={formatRupiah(reimbursement.biaya)}
                                    onChange={(e) => handleInputChange(index, 'biaya', e.target.value)}
                                />
                            </div>

                            <div className="flex-1 w-full xl:min-w-36">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                        Kebutuhan <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                        Kebutuhan <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    type="text"
                                    value={reimbursement.kebutuhan}
                                    onChange={(e) => handleInputChange(index, 'kebutuhan', e.target.value)}
                                />
                            </div>

                            <div className="flex-1 w-full xl:min-w-36">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">Keterangan</label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">Keterangan</label>
                                )}
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    type="text"
                                    value={reimbursement.keterangan}
                                    onChange={(e) => handleInputChange(index, 'keterangan', e.target.value)}
                                />
                            </div>

                            <div className="flex-1 w-full xl:max-w-40">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                        Tanggal Aktivitas <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                        Tanggal Aktivitas <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md bg-transparent hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    type="date"
                                    value={reimbursement.tanggal}
                                    onChange={(e) => handleInputChange(index, 'tanggal', e.target.value)}
                                />
                            </div>

                            <div className="flex items-end my-2 xl:my-0">
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

                <hr className="border-gray-300 my-6" />

                <div className="flex justify-end mt-6">
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

export default RbsOperasionalForm
