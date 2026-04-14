import React, { useState, useEffect } from 'react'
import { collection, addDoc, setDoc, doc, updateDoc, arrayUnion, query, where, getDoc, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebaseConfig'
import Select from 'react-select'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons' // Tambah faTimes untuk icon hapus file
import { useLocation, useNavigate } from 'react-router-dom';

const RbsBbmForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isEditMode = location.state?.isEditMode || false;
    const editData = location.state?.editData || null;

    const [todayDate, setTodayDate] = useState('')
    const [userData, setUserData] = useState({
        uid: '',
        nama: '',
        bankName: '',
        accountNumber: '',
        unit: [],
        validator: [],
        reviewer1: [],
        reviewer2: []
    })

    const [isSubmitting, setIsSubmitting] = useState(false)

    const initialReimbursementState = {
        jenis: '',
        biaya: '',
        lokasi: '',
        plat: '',
        tanggal: '',
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

    // --- PERUBAHAN: State untuk Multi File Upload ---
    const [attachmentFiles, setAttachmentFiles] = useState([])

    const [selectedUnit, setSelectedUnit] = useState(null)
    const [userUnitOptions, setUserUnitOptions] = useState([])
    const [isAdmin, setIsAdmin] = useState(false)

    const [validatorOptions, setValidatorOptions] = useState([])
    const [selectedValidator, setSelectedValidator] = useState(null)

    const [reviewerOptions, setReviewerOptions] = useState([])
    const [selectedReviewer1, setSelectedReviewer1] = useState(null)
    const [selectedReviewer2, setSelectedReviewer2] = useState(null)

    // --- PERUBAHAN: Hapus if (isAdmin) agar semua role fetch data validator & reviewer ---
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

    const BUSINESS_UNITS = [
        { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
        { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
        { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
        { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
        { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
        { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
        { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
        { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' },
        { value: 'Samudera', label: 'Samudera' },
        { value: 'Panitia SISCO', label: 'Panitia SISCO' }
    ]

    const jenisOptions = [
        { value: 'BBM Pertalite', label: 'BBM Pertalite' },
        { value: 'BBM Pertamax', label: 'BBM Pertamax' },
        { value: 'BBM Solar', label: 'BBM Solar' },
        { value: 'Top Up E-Toll', label: 'Top Up E-Toll' },
        { value: 'Parkir', label: 'Parkir' },
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

                    // Jika user (bukan admin) hanya punya 1 unit, otomatis terpilih
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
        setReimbursements([{
            ...initialReimbursementState,
            tanggalPengajuan: todayDate
        }])

        const fileInputs = document.querySelectorAll('input[type="file"]')
        fileInputs.forEach(input => input.value = '')

        // Reset state array files
        setAttachmentFiles([])

        if (isAdmin || userUnitOptions.length > 1) {
            setSelectedUnit(null)
        }
        
        setSelectedValidator(null)
        setSelectedReviewer1(null)
        setSelectedReviewer2(null)
    }

    const formatRupiah = (number) => {
        // Cegah error jika data kosong (undefined/null)
        if (number === undefined || number === null) return ''

        // Paksa ubah ke bentuk teks (String) sebelum di-replace
        const stringNumber = number.toString()
        const strNumber = stringNumber.replace(/[^,\d]/g, '')
        
        const split = strNumber.split(',')
        const sisa = split[0].length % 3
        let rupiah = split[0].substr(0, sisa)
        const ribuan = split[0].substr(sisa).match(/\d{3}/gi)

        if (ribuan) {
            const separator = sisa ? '.' : ''
            rupiah += separator + ribuan.join('.')
        }

        rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah
        return rupiah ? 'Rp' + rupiah : ''
    }

    const handleAddForm = () => {
        setReimbursements([
            ...reimbursements,
            { ...initialReimbursementState, tanggalPengajuan: todayDate }
        ])
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

        return `RBS.BBM.${unitCode}.${year}${month}${day}.${sequence}`
    }

    // --- PERUBAHAN: Fungsi handler upload untuk multi file ---
    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files)
        if (!files.length) return

        const validFiles = []
        for (let file of files) {
            // Validate file size (250MB limit)
            if (file.size > 250 * 1024 * 1024) {
                toast.error(`Ukuran file ${file.name} maksimal 250MB`)
                continue
            }
            // Validate file type (PDF only)
            if (file.type !== 'application/pdf') {
                toast.error(`File ${file.name} bukan PDF, hanya PDF yang diperbolehkan`)
                continue
            }
            validFiles.push(file)
        }

        setAttachmentFiles(prev => [...prev, ...validFiles])
        event.target.value = '' // Reset input agar bisa pilih file yang sama lagi jika butuh
    }

    const removeAttachment = (indexToRemove) => {
        setAttachmentFiles(prev => prev.filter((_, index) => index !== indexToRemove))
    }

    // --- PERUBAHAN: Mengupload banyak file sekaligus ---
    const uploadAttachments = async (files, displayId) => {
        if (!files || files.length === 0) return []

        try {
            const uploadPromises = files.map(async (file, index) => {
                // Beri penomoran file jika lebih dari 1
                const newFileName = `Lampiran_${index + 1}_${displayId}.pdf`
                const storageRef = ref(storage, `Reimbursement/BBM/${displayId}/${newFileName}`)
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

    useEffect(() => {
        if (isEditMode && editData && editData.reimbursements) {
            
            // 1. Set Item Reimbursement
            const formattedReimbursements = editData.reimbursements.map(item => ({
                ...item,
                biaya: item.biaya?.toString() || '',
                jenis: typeof item.jenis === 'string' 
                        ? { value: item.jenis, label: item.jenis } 
                        : item.jenis,
            }));
            setReimbursements(formattedReimbursements);

            // 2. Paksa set data user pengaju (Gunakan setTimeout agar tidak tertimpa data login)
            setTimeout(() => {
                if (editData.user) {
                    setUserData({
                        uid: editData.user.uid,
                        nama: editData.user.nama,
                        bankName: editData.user.bankName || '',
                        accountNumber: editData.user.accountNumber || '',
                        department: editData.user.department || ''
                    });

                    // 3. Set Dropdown Unit
                    if (editData.user.unit) {
                        setSelectedUnit({ value: editData.user.unit, label: editData.user.unit });
                    }

                    // 4. Set Dropdown Approval (Cari label berdasarkan value yang cocok di opsi)
                    const findOption = (options, val) => options.find(o => o.value === val) || { value: val, label: val };

                    if (editData.user.validator) {
                        setSelectedValidator(findOption(validatorOptions, editData.user.validator[0]));
                    }
                    if (editData.user.reviewer1) {
                        setSelectedReviewer1(findOption(reviewerOptions, editData.user.reviewer1[0]));
                    }
                    if (editData.user.reviewer2) {
                        setSelectedReviewer2(findOption(reviewerOptions, editData.user.reviewer2[0]));
                    }
                }
            }, 100); 
        }
    }, [isEditMode, editData, validatorOptions, reviewerOptions]);

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)

            if (selectedReviewer1 && selectedReviewer2 && selectedReviewer1.value === selectedReviewer2.value) {
                toast.warning('Reviewer 1 dan Reviewer 2 tidak boleh sama')
                setIsSubmitting(false)
                return
            }

            const missingFields = []

            // Karena sekarang UI semua seragam, validasinya juga diseragamkan
            if (!userData.nama) missingFields.push('Nama')
            if (!selectedUnit?.value) missingFields.push('Unit Bisnis')
            if (!selectedValidator) missingFields.push('Validator')
            if (!selectedReviewer1) missingFields.push('Reviewer 1')
            if (!selectedReviewer2) missingFields.push('Reviewer 2')

            const multipleItems = reimbursements.length > 1

            reimbursements.forEach((r, index) => {
                const getFieldLabel = (baseLabel) => {
                    return multipleItems ? `${baseLabel} (Item ${index + 1})` : baseLabel
                }

                if (r.isLainnya) {
                    if (!r.jenisLain) missingFields.push(getFieldLabel('Jenis Reimbursement'))
                    if (!r.biaya) missingFields.push(getFieldLabel('Biaya'))
                    if (!r.lokasi) missingFields.push(getFieldLabel('Lokasi'))
                    if (!r.plat) missingFields.push(getFieldLabel('Plat Kendaraan'))
                    if (!r.tanggal) missingFields.push(getFieldLabel('Tanggal Aktivitas'))
                } else {
                    if (!r.jenis) missingFields.push(getFieldLabel('Jenis Reimbursement'))
                    if (!r.biaya) missingFields.push(getFieldLabel('Biaya'))
                    if (!r.lokasi) missingFields.push(getFieldLabel('Lokasi'))
                    if (!r.plat) missingFields.push(getFieldLabel('Plat Kendaraan'))
                    if (!r.tanggal) missingFields.push(getFieldLabel('Tanggal Aktivitas'))
                }
            })

            if (!isEditMode && attachmentFiles.length === 0) {
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

            // --- PERUBAHAN: Terima array URL lampiran ---
            const lampiranUrls = await uploadAttachments(attachmentFiles, displayId)

            const totalBiaya = reimbursements.reduce((total, item) => {
                const biayaNumber = parseInt(item.biaya.replace(/[^0-9]/g, ''))
                return total + biayaNumber
            }, 0)

            const parseRupiah = (value) => {
                return Number(value.replace(/[^,\d]/g, '').replace(',', '.')) || 0
            }

            const reimbursementData = {
                user: {
                    uid: userData.uid,
                    nama: userData.nama,
                    bankName: userData.bankName,
                    accountNumber: userData.accountNumber,
                    unit: selectedUnit.value,
                    unitCode: getUnitCode(selectedUnit.value),
                    department: userData.department,
                    // Ambil dari dropdown secara langsung untuk SEMUA role
                    validator: [selectedValidator.value],
                    reviewer1: [selectedReviewer1.value],
                    reviewer2: [selectedReviewer2.value]
                },
                reimbursements: reimbursements.map((item) => ({
                    biaya: parseRupiah(item.biaya),
                    lokasi: item.lokasi,
                    plat: item.plat,
                    tanggal: item.tanggal,
                    isLainnya: item.isLainnya,
                    jenis: item.isLainnya ? item.jenisLain : item.jenis.value
                })),
                displayId: displayId,
                kategori: 'BBM',
                status: 'Diajukan',
                approvedByReviewer1: false,
                approvedByReviewer2: false,
                approvedBySuperAdmin: false,
                rejectedBySuperAdmin: false,
                tanggalPengajuan: todayDate,
                totalBiaya: totalBiaya,
                // --- PERUBAHAN: Simpan sebagai Array agar bisa di-map saat rendering Detail ---
                lampiran: attachmentFiles.map(f => f.name), 
                lampiranUrl: lampiranUrls, 
                statusHistory: [
                    {
                        status: 'Diajukan',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid
                    }
                ]
            }

            // --- PERCABANGAN LOGIKA SIMPAN vs UPDATE ---
            if (isEditMode) {
                // JIKA EDIT: Gunakan updateDoc untuk memperbarui dokumen yang sudah ada
                const reimbursementRef = doc(db, 'reimbursement', editData.id)
                
                // Siapkan data yang boleh diubah oleh Super Admin
                let updateData = {
                    reimbursements: reimbursementData.reimbursements,
                    totalBiaya: reimbursementData.totalBiaya,
                    statusHistory: arrayUnion({
                        status: 'Data Diubah oleh Super Admin',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid,
                        reason: 'Super Admin mengedit detail form BBM'
                    })
                }

                // Jika Super Admin mengunggah file baru, perbarui lampirannya.
                // Jika tidak, biarkan lampiran yang lama tetap ada.
                if (attachmentFiles.length > 0) {
                    updateData.lampiran = reimbursementData.lampiran;
                    updateData.lampiranUrl = reimbursementData.lampiranUrl;
                }

                await updateDoc(reimbursementRef, updateData)
                toast.success('Reimbursement BBM berhasil diperbarui!')
                
                setIsSubmitting(false)
                
                // Arahkan kembali ke halaman tabel cek pengajuan setelah berhasil edit
                navigate('/reimbursement/cek-pengajuan')

            } else {
                // JIKA BIKIN BARU: Gunakan alur addDoc seperti biasa
                const docRef = await addDoc(collection(db, 'reimbursement'), reimbursementData)
                await setDoc(doc(db, 'reimbursement', docRef.id), { ...reimbursementData, id: docRef.id })
                
                toast.success('Reimbursement BBM berhasil diajukan!')
                
                resetForm()
                setIsSubmitting(false)
            }
            
        } catch (error) {
            console.error('Error submitting reimbursement:', error)
            toast.error('Terjadi kesalahan saat menyimpan data. Silakan coba lagi.')
            setIsSubmitting(false)
        }
    }

    // --- PERUBAHAN: Tampilan UI untuk Multi Upload ---
    const renderFileUpload = () => {
        return (
            <div className="flex flex-col items-start w-full">
                <div className="flex flex-col xl:flex-row items-start xl:items-center w-full">
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf"
                        multiple // Mengizinkan seleksi lebih dari 1 file sekaligus
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
                
                {/* Menampilkan list file yang berhasil ditambahkan */}
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

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Tambah <span className="font-bold">Reimbursement BBM</span>
            </h2>

            <div className="bg-white p-6 rounded-lg shadow">
                {/* --- PERUBAHAN: Layout diseragamkan untuk semua role (Persis seperti gambar Admin) --- */}
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
                        <label className="block text-gray-700 font-medium mb-2">Tanggal Pengajuan</label>
                        <input
                            className="w-full h-10 px-4 py-2 border rounded-md text-gray-500 bg-gray-50 cursor-not-allowed"
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

                    {/* Row 5 */}
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
                            isSearchable={true}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                        />
                    </div>
                </div>

                <hr className="border-gray-300 my-6" />

                {reimbursements.map((reimbursement, index) => (
                    <div key={index}>
                        {index > 0 && (
                            <hr className="border-gray-300 my-6 block xl:hidden" />
                        )}

                        <div className="flex flex-col xl:flex-row justify-stretch gap-2 mb-2">
                            <div className="flex-1 w-full xl:max-w-44">
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
                                            menuPortalTarget={document.body}
                                            menuPosition="absolute"
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
                                        Lokasi Pertamina <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                        Lokasi Pertamina <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    type="text"
                                    value={reimbursement.lokasi}
                                    onChange={(e) => handleInputChange(index, 'lokasi', e.target.value)}
                                />
                            </div>

                            <div className="flex-1 w-full xl:max-w-36">
                                {(index === 0 || window.innerWidth < 1280) && (
                                    <label className="block text-gray-700 font-medium mb-2 xl:hidden">
                                        Plat Nomor <span className="text-red-500">*</span>
                                    </label>
                                )}
                                {index === 0 && (
                                    <label className="hidden xl:block text-gray-700 font-medium mb-2">
                                        Plat Nomor <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <input
                                    className="w-full h-10 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    type="text"
                                    value={reimbursement.plat}
                                    onChange={(e) => {
                                        const filteredValue = e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '')
                                        handleInputChange(index, 'plat', filteredValue)
                                    }}
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

export default RbsBbmForm