import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { doc, setDoc, getDoc, addDoc, collection, runTransaction, getDocs, query, where, updateDoc, arrayUnion } from 'firebase/firestore'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from '../firebaseConfig'
import Select from 'react-select'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

const FormBs = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const isEditMode = location.state?.isEditMode || false
    const editData = location.state?.editData || null

    const [todayDate, setTodayDate] = useState('')
    const [alreadyFetchBS, setAlreadyFetchBS] = useState(false)
    const [userData, setUserData] = useState({
        uid: '',
        nama: '',
        bankName: '',
        accountNumber: '',
        unit: [], // Sekarang array
        posisi: '',
        reviewer1: [],
        reviewer2: []
    })

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUserDataLoaded, setIsUserDataLoaded] = useState(false)

    const initialBonSementaraState = {
        nomorBS: '',
        aktivitas: '',
        jumlahBS: '',
        kategori: '',
        tanggalPengajuan: todayDate
    }

    const [bonSementara, setBonSementara] = useState([initialBonSementaraState])

    useEffect(() => {
        if (todayDate) {
            setBonSementara((prevBonSementara) =>
                prevBonSementara.map((item) => ({ ...item, tanggalPengajuan: todayDate }))
            )
        }
    }, [todayDate])

    const [selectedUnit, setSelectedUnit] = useState(null)
    const [userUnitOptions, setUserUnitOptions] = useState([])
    const [isAdmin, setIsAdmin] = useState(false)

    const [reviewerOptions, setReviewerOptions] = useState([])
    const [selectedReviewer1, setSelectedReviewer1] = useState(null)
    const [selectedReviewer2, setSelectedReviewer2] = useState(null)

    // Deteksi apakah user hanya memiliki 1 unit bisnis
    const isSingleUnit = !isAdmin && userUnitOptions.length === 1

    // Fetch reviewer untuk semua role
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

// --- HOOK 1: Inisialisasi Awal (Hanya jalan sekali saat mount) ---
    useEffect(() => {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        setTodayDate(formattedDate);

        const uid = localStorage.getItem('userUid');
        if (uid) {
            fetchUserData(uid); // Kirimkan uid ke fungsi fetch
        }
    }, []);

    // --- FUNGSI FETCH USER DATA (Pisahkan dari Hook agar bersih) ---
    const fetchUserData = async (uid) => {
        // Pintu penjaga: Jika mode edit, jangan ambil data user login
        if (isEditMode && editData) {
            setIsUserDataLoaded(true);
            return;
        }

        try {
            const userDocRef = doc(db, 'users', uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                const adminStatus = data.role === 'Admin' || data.role === 'Super Admin';
                setIsAdmin(adminStatus);

                const userUnitsArray = Array.isArray(data.unit) ? data.unit : (data.unit ? [data.unit] : []);

                setUserData({
                    uid: data.uid || '',
                    nama: data.nama || '',
                    bankName: data.bankName || '',
                    accountNumber: data.accountNumber || '',
                    unit: userUnitsArray,
                    posisi: data.posisi || '',
                    department: data.department || [],
                    reviewer1: data.reviewer1 || [],
                    reviewer2: data.reviewer2 || []
                });

                const unitOptionsForUser = userUnitsArray.map(u => ({ value: u, label: u }));
                setUserUnitOptions(unitOptionsForUser);

                if (!adminStatus && unitOptionsForUser.length === 1) {
                    setSelectedUnit(unitOptionsForUser[0]);
                } else if (!adminStatus && unitOptionsForUser.length === 0) {
                    setSelectedUnit(null);
                }

                setIsUserDataLoaded(true);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            toast.error('Error fetching user data');
        }
    };

    // --- HOOK 2: BLOK AUTO-FILL (BERDIRI SENDIRI DI LUAR) ---
    // Hook ini akan jalan setiap kali editData atau reviewerOptions berubah
    useEffect(() => {
        if (isEditMode && editData) {
            // 1. Set Data User Pengaju Asli
            if (editData.user) {
                setUserData({
                    uid: editData.user.uid || '',
                    nama: editData.user.nama || '',
                    bankName: editData.user.bankName || '',
                    accountNumber: editData.user.accountNumber || '',
                    unit: [editData.user.unit], 
                    posisi: editData.user.posisi || '',
                    department: editData.user.department || [],
                    reviewer1: editData.user.reviewer1 || [],
                    reviewer2: editData.user.reviewer2 || []
                });

                setSelectedUnit({ value: editData.user.unit, label: editData.user.unit });
                
                if (reviewerOptions.length > 0) {
                    const rev1 = reviewerOptions.find(opt => editData.user.reviewer1.includes(opt.value));
                    const rev2 = reviewerOptions.find(opt => editData.user.reviewer2.includes(opt.value));
                    if (rev1) setSelectedReviewer1(rev1);
                    if (rev2) setSelectedReviewer2(rev2);
                }
            }

            // 2. Set Item Bon Sementara
            if (editData.bonSementara && Array.isArray(editData.bonSementara)) {
                const formattedBS = editData.bonSementara.map(item => ({
                    ...item,
                    jumlahBS: item.jumlahBS?.toString() || '',
                    kategori: item.kategori || ''
                }));
                setBonSementara(formattedBS);

                if (formattedBS[0]?.kategori) {
                    setSelectedKategori({ value: formattedBS[0].kategori, label: formattedBS[0].kategori });
                }
            }
            
            setIsUserDataLoaded(true);
        }
    }, [isEditMode, editData, reviewerOptions]);
    
    // --- Logika Auto-Fill Reviewer 1 dan 2 untuk user dengan 1 Unit Bisnis ---
    useEffect(() => {
        if (isSingleUnit) {
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
    }, [isSingleUnit, reviewerOptions, userData]);

    const kategoriOptions = [
        { value: 'GA/Umum', label: 'GA/Umum' },
        { value: 'Marketing/Operasional', label: 'Marketing/Operasional' }
    ]

    const [selectedKategori, setSelectedKategori] = useState(null)

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A'
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date)
    }

    const handleKategoriChange = (selectedOption) => {
        setSelectedKategori(selectedOption)
        setBonSementara((prevBonSementara) =>
            prevBonSementara.map((item, index) => (index === 0 ? { ...item, kategori: selectedOption.value } : item))
        )
    }

    const customStyles = {
        control: (base, state) => ({
            ...base,
            padding: '0 7px',
            height: '40px',
            minHeight: '40px',
            borderColor: '#e5e7eb',
            backgroundColor: state.isDisabled ? '#f9fafb' : 'white', // Warna background saat disabled
            '&:hover': {
                borderColor: state.isDisabled ? '#e5e7eb' : '#3b82f6'
            }
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '0 7px',
            height: '40px',
            minHeight: '40px'
        })
    }

    const resetForm = () => {
        setBonSementara([
            {
                ...initialBonSementaraState,
                tanggalPengajuan: todayDate
            }
        ])
        
        setSelectedKategori(null)

        if (isAdmin || userUnitOptions.length > 1) {
            setSelectedUnit(null)
            setSelectedReviewer1(null)
            setSelectedReviewer2(null)
        }
    }

    const formatRupiah = (number) => {
        if (number === undefined || number === null) return ''
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

    const handleInputChange = (index, field, value) => {
        if (field === 'nomorBS') return // Hindari perubahan manual

        let formattedValue = value

        if (field === 'jumlahBS') {
            formattedValue = formatRupiah(value)
        }

        const updatedBonSementara = bonSementara.map((item, i) =>
            i === index ? { ...item, [field]: formattedValue } : item
        )
        setBonSementara(updatedBonSementara)
    }

    const [currentCounter, setCurrentCounter] = useState(null);

    const getCurrentCounter = async (unitCode) => {
        try {
            const counterRef = doc(db, 'businessUnitCounters', unitCode);
            const counterDoc = await getDoc(counterRef);

            const today = new Date();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');

            if (!counterDoc.exists()) {
                await setDoc(counterRef, {
                    lastNumber: 500,
                    lastResetMonth: month
                });
                return '0000501';
            }

            const lastResetMonth = counterDoc.data().lastResetMonth || '00';

            if (lastResetMonth !== month) {
                await setDoc(counterRef, {
                    lastNumber: 500,
                    lastResetMonth: month
                });
                return '0000501';
            }

            const currentNumber = counterDoc.data().lastNumber;
            return (currentNumber + 1).toString().padStart(7, '00005');
        } catch (error) {
            console.error('Error getting current counter:', error);
            return '0000501';
        }
    };

    const BUSINESS_UNIT_CODES = useMemo(() => ({
        'PT Makassar Jaya Samudera': '019',
        'PT Samudera Makassar Logistik': '035',
        'PT Kendari Jaya Samudera': '083',
        'PT Samudera Kendari Logistik': 'SKEL',
        'PT Samudera Agencies Indonesia': 'SAI',
        'PT SILKargo Indonesia': 'SKI',
        'PT PAD Samudera Perdana': 'SP',
        'PT Masaji Kargosentra Tama': 'MKT',
        'Samudera': 'SMDR',
    }), []);

    const handleUnitChange = async (selectedOption) => {
        setSelectedUnit(selectedOption);

        if (!selectedOption) {
            setBonSementara(prev => prev.map(item => ({ ...item, nomorBS: '' })));
            return;
        }

        try {
            const today = new Date();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear().toString().slice(-2);
            const tanggalKode = `${year}${month}`;

            const kodeUnitBisnis = BUSINESS_UNIT_CODES[selectedOption.value];

            if (!kodeUnitBisnis) {
                throw new Error(`No code found for business unit: ${selectedOption.value}`);
            }

            const sequence = await getCurrentCounter(kodeUnitBisnis);
            setCurrentCounter(sequence);

            const newNomorBS = `BS${tanggalKode}${kodeUnitBisnis}${sequence}`;

            setBonSementara(prevBonSementara =>
                prevBonSementara.map(item => ({ ...item, nomorBS: newNomorBS }))
            );

        } catch (error) {
            console.error('Error generating new BS number:', error);
            toast.error('Error generating new BS number: ' + error.message);
        }
    };

    const generateNomorBS = useCallback(async () => {
        try {
            if (alreadyFetchBS) return null;

            if (!isUserDataLoaded) {
                return null;
            }

            const currentUnit = selectedUnit ? selectedUnit.value : (userData.unit.length === 1 ? userData.unit[0] : null);

            if (!currentUnit) {
                return null; // Tunggu sampai user pilih unit
            }

            setAlreadyFetchBS(true);

            const today = new Date();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear().toString().slice(-2);
            const tanggalKode = `${year}${month}`;

            const kodeUnitBisnis = BUSINESS_UNIT_CODES[currentUnit];

            if (!kodeUnitBisnis) {
                throw new Error(`No code found for business unit: ${currentUnit}`);
            }

            const sequence = await getCurrentCounter(kodeUnitBisnis);
            setCurrentCounter(sequence);

            const nomorBS = `BS${tanggalKode}${kodeUnitBisnis}${sequence}`;
            return nomorBS;

        } catch (error) {
            console.error('Error generating nomor BS:', error);
            toast.error('Error: ' + error.message);
            return null;
        }
    }, [alreadyFetchBS, isUserDataLoaded, selectedUnit, userData.unit, BUSINESS_UNIT_CODES]);

    useEffect(() => {
        const fetchNomorBS = async () => {
            if (!isUserDataLoaded || alreadyFetchBS || !selectedUnit) return

            const nomorBS = await generateNomorBS()
            if (nomorBS) {
                setBonSementara((prevBonSementara) =>
                    prevBonSementara.map((item, index) => (index === 0 ? { ...item, nomorBS: nomorBS } : item))
                )
            }
        }

        fetchNomorBS()
    }, [todayDate, alreadyFetchBS, isUserDataLoaded, generateNomorBS, selectedUnit])

    useEffect(() => {
        if (isEditMode && editData && editData.bonSementara) {
            
            // A. Set Data Bon Sementara
            const formattedBS = editData.bonSementara.map(item => ({
                ...item,
                jumlahBS: item.jumlahBS?.toString() || '',
                kategori: typeof item.kategori === 'string' ? item.kategori : item.kategori?.value || ''
            }));
            setBonSementara(formattedBS);

            // B. Set Dropdown Kategori
            if (formattedBS[0]?.kategori) {
                const matchedKategori = kategoriOptions.find(opt => opt.value === formattedBS[0].kategori);
                setSelectedKategori(matchedKategori || { value: formattedBS[0].kategori, label: formattedBS[0].kategori });
            }

            // C. Set Data User Pengaju Asli
            setTimeout(() => {
                if (editData.user) {
                    setUserData(prev => ({
                        ...prev,
                        uid: editData.user.uid,
                        nama: editData.user.nama,
                        bankName: editData.user.bankName || '',
                        accountNumber: editData.user.accountNumber || '',
                        posisi: editData.user.posisi || '',
                        department: editData.user.department || ''
                    }));

                    if (editData.user.unit) {
                        setSelectedUnit({ value: editData.user.unit, label: editData.user.unit });
                    }

                    const findOption = (options, val) => options.find(o => o.value === val) || { value: val, label: val };

                    if (editData.user.reviewer1 && editData.user.reviewer1.length > 0) {
                        setSelectedReviewer1(findOption(reviewerOptions, editData.user.reviewer1[0]));
                    }
                    if (editData.user.reviewer2 && editData.user.reviewer2.length > 0) {
                        setSelectedReviewer2(findOption(reviewerOptions, editData.user.reviewer2[0]));
                    }
                }
            }, 100);
        }
    }, [isEditMode, editData, reviewerOptions])

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
            if (!selectedReviewer1) missingFields.push('Reviewer 1')
            if (!selectedReviewer2) missingFields.push('Reviewer 2')

            const multipleItems = bonSementara.length > 1

            bonSementara.forEach((r, index) => {
                const getFieldLabel = (baseLabel) => {
                    return multipleItems ? `${baseLabel} (Item ${index + 1})` : baseLabel
                }

                if (!r.nomorBS) missingFields.push(getFieldLabel('Nomor BS'))
                if (!r.jumlahBS) missingFields.push(getFieldLabel('Jumlah BS'))
                if (!r.kategori) missingFields.push(getFieldLabel('Kategori'))
                if (!r.aktivitas) missingFields.push(getFieldLabel('Aktivitas'))
            })

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

            const displayId = bonSementara[0]?.nomorBS
            const kodeUnitBisnis = BUSINESS_UNIT_CODES[selectedUnit.value]

            const parseRupiah = (value) => {
                return Number(value.replace(/[^,\d]/g, '').replace(',', '.')) || 0
            }

            const bonSementaraData = {
                user: {
                    uid: userData.uid,
                    nama: userData.nama,
                    bankName: userData.bankName,
                    accountNumber: userData.accountNumber,
                    unit: selectedUnit.value,
                    posisi: userData.posisi,
                    department: userData.department,
                    reviewer1: [selectedReviewer1.value],
                    reviewer2: [selectedReviewer2.value]
                },
                bonSementara: bonSementara.map((item) => ({
                    nomorBS: item.nomorBS,
                    jumlahBS: parseRupiah(item.jumlahBS),
                    aktivitas: item.aktivitas,
                    kategori: item.kategori
                })),
                displayId: displayId,
                tanggalPengajuan: todayDate,
                status: 'Diajukan',
                approvedByReviewer1: false,
                approvedByReviewer2: false,
                approvedBySuperAdmin: false,
                rejectedBySuperAdmin: false,
                statusHistory: [
                    {
                        status: 'Diajukan',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid
                    }
                ]
            }

            if (isEditMode) {
                // --- LOGIKA JIKA EDIT ---
                const bsRef = doc(db, 'bonSementara', editData.id)
                await updateDoc(bsRef, {
                    bonSementara: bonSementaraData.bonSementara,
                    statusHistory: arrayUnion({
                        status: 'Data Diubah oleh Super Admin',
                        timestamp: new Date().toISOString(),
                        actor: userData.uid,
                        reason: 'Super Admin mengedit detail form Bon Sementara'
                    })
                })
                
                toast.success('Bon Sementara berhasil diperbarui!')
                setIsSubmitting(false)
                navigate('/bon-sementara/cek-pengajuan') // Arahkan kembali ke tabel

            } else {
                // --- LOGIKA JIKA BIKIN BARU ---
                const docRef = await addDoc(collection(db, 'bonSementara'), bonSementaraData)
                await setDoc(doc(db, 'bonSementara', docRef.id), { ...bonSementaraData, id: docRef.id })

                const counterRef = doc(db, 'businessUnitCounters', kodeUnitBisnis)
                await runTransaction(db, async (transaction) => {
                    const counterDoc = await transaction.get(counterRef)
                    const today = new Date()
                    const month = (today.getMonth() + 1).toString().padStart(2, '0')

                    let newLastNumber
                    if (!counterDoc.exists() || counterDoc.data().lastResetMonth !== month) {
                        newLastNumber = 501
                    } else {
                        newLastNumber = counterDoc.data().lastNumber + 1
                    }

                    transaction.set(counterRef, {
                        lastNumber: newLastNumber,
                        lastResetMonth: month
                    })
                })

                toast.success('Bon Sementara berhasil diajukan!')

                setAlreadyFetchBS(false) 
                resetForm()
                setIsSubmitting(false)
                
                const nextSequence = (parseInt(currentCounter) + 1).toString().padStart(7, '00005')
                setCurrentCounter(nextSequence)
            }
        } catch (error) {
            console.error('Error submitting bon sementara:', error)
            toast.error('Terjadi kesalahan saat menyimpan data. Silakan coba lagi.')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Ajukan <span className="font-bold">Bon Sementara</span>
            </h2>

            <div className="bg-white p-6 rounded-lg shadow">
                {/* --- Layout diseragamkan untuk semua role --- */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
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
                            Unit Bisnis <span className="text-red-500">*</span>
                        </label>
                        <Select
                            options={isAdmin ? BUSINESS_UNITS : userUnitOptions}
                            value={selectedUnit}
                            onChange={handleUnitChange}
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

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
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
                            isDisabled={isSingleUnit} // <-- Di-disable jika unit cuma 1
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
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
                            isDisabled={isSingleUnit} // <-- Di-disable jika unit cuma 1
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 xl:gap-6 mb-2 lg:mb-3">
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
                            Kategori BS <span className="text-red-500">*</span>
                        </label>
                        <Select
                            options={kategoriOptions}
                            value={selectedKategori}
                            onChange={handleKategoriChange}
                            placeholder="Pilih Kategori..."
                            className="w-full"
                            styles={customStyles}
                            isSearchable={false}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                        />
                    </div>
                </div>

                <hr className="border-gray-300 my-6" />

                {bonSementara.map((bon, index) => (
                    <div
                        key={index}
                        className="flex flex-col xl:flex-row gap-2 mb-2"
                    >
                        <div className="flex flex-col md:flex-row gap-2 flex-1">
                            <div className="flex-1">
                                {index === 0 && (
                                    <label className="block text-gray-700 font-medium mb-2">
                                        Nomor BS <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <input
                                    className="w-full border border-gray-300 bg-gray-50 text-gray-500 rounded-md h-10 px-4 py-2 cursor-not-allowed"
                                    type="text"
                                    value={bon.nomorBS}
                                    placeholder="Pilih Unit Bisnis untuk generate BS"
                                    disabled
                                    onChange={(e) => handleInputChange(index, "nomorBS", e.target.value)}
                                />
                            </div>

                            <div className="flex-1">
                                {index === 0 && (
                                    <label className="block text-gray-700 font-medium mb-2">
                                        Jumlah BS <span className="text-red-500">*</span>
                                    </label>
                                )}
                                <input
                                    className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                    type="text"
                                    value={formatRupiah(bon.jumlahBS)}
                                    onChange={(e) => handleInputChange(index, "jumlahBS", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1">
                            {index === 0 && (
                                <label className="block text-gray-700 font-medium mb-2">
                                    Aktivitas (Keterangan) <span className="text-red-500">*</span>
                                </label>
                            )}
                            <textarea
                                className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2 resize-none"
                                style={{scrollbarWidth: 'none'}}  
                                type="text"
                                value={bon.aktivitas}
                                onChange={(e) => handleInputChange(index, "aktivitas", e.target.value)}
                            />
                        </div>
                    </div>
                ))}

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

export default FormBs