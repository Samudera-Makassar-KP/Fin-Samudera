import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { doc, setDoc, getDoc, addDoc, collection, getDocs, runTransaction, query, where } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import Select from 'react-select'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

const CreateBonForm = () => {
    const [todayDate, setTodayDate] = useState('')
    const [alreadyFetchBS, setAlreadyFetchBS] = useState(false)
    const [userData, setUserData] = useState({
        uid: '',
        nama: '',
        bankName: '',
        accountNumber: '',
        unit: '',
        posisi: '',
        validator: [],
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

    useEffect(() => {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const uid = localStorage.getItem('userUid');

        setTodayDate(formattedDate);

        const fetchUserData = async () => {
            try {
                const userDocRef = doc(db, 'users', uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const adminStatus = data.role === 'Admin';
                    setIsAdmin(adminStatus);

                    // Set user data
                    setUserData({
                        uid: data.uid || '',
                        nama: data.nama || '',
                        bankName: data.bankName || '',
                        accountNumber: data.accountNumber || '',
                        unit: data.unit || '',
                        posisi: data.posisi || '',
                        department: data.department || [],
                        validator: data.validator || [],
                        reviewer1: data.reviewer1 || [],
                        reviewer2: data.reviewer2 || []
                    });

                    setSelectedUnit(
                        adminStatus
                            ? { value: data.unit || '', label: data.unit || 'No Unit Assigned' }
                            : { value: data.unit, label: data.unit }
                    );

                    setIsUserDataLoaded(true);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                toast.error('Error fetching user data');
            }
        };

        if (uid) {
            fetchUserData();
        }
    }, []);


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

                const options = querySnapshot.docs.map(doc => {
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

    const resetForm = () => {
        // Reset bonSementara to initial state with one empty form
        setBonSementara([
            {
                ...initialBonSementaraState,
                tanggalPengajuan: todayDate
            }
        ])

        // Reset the category selection
        setSelectedKategori(null)
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
                // Reset counter for new month
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
        'PT Masaji Kargosentra Tama': 'MKT'
    }), []);

    const handleUnitChange = async (selectedOption) => {
        setSelectedUnit(selectedOption);

        if (!isAdmin) return;

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
                console.error('User data not loaded yet');
                return null;
            }

            setAlreadyFetchBS(true);

            const today = new Date();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear().toString().slice(-2);
            const tanggalKode = `${year}${month}`;

            const currentUnit = isAdmin && selectedUnit
                ? selectedUnit.value
                : userData.unit;

            if (!currentUnit) {
                throw new Error('Business unit is not set');
            }

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
    }, [alreadyFetchBS, isUserDataLoaded, isAdmin, selectedUnit, userData.unit, BUSINESS_UNIT_CODES]);

    useEffect(() => {
        const fetchNomorBS = async () => {
            if (!isUserDataLoaded || alreadyFetchBS) return

            const nomorBS = await generateNomorBS()
            if (nomorBS) {
                setBonSementara((prevBonSementara) =>
                    prevBonSementara.map((item, index) => (index === 0 ? { ...item, nomorBS: nomorBS } : item))
                )
            }
        }

        fetchNomorBS()
    }, [todayDate, alreadyFetchBS, isUserDataLoaded, generateNomorBS]);

    useEffect(() => {
        const fetchNomorBS = async () => {
            if (!isUserDataLoaded || alreadyFetchBS) return

            const nomorBS = await generateNomorBS()
            if (nomorBS) {
                setBonSementara((prevBonSementara) =>
                    prevBonSementara.map((item, index) => (index === 0 ? { ...item, nomorBS: nomorBS } : item))
                )
            }
        }

        fetchNomorBS()
    }, [todayDate, alreadyFetchBS, isUserDataLoaded, generateNomorBS])


    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)

            // Validasi form dengan pesan spesifik
            const missingFields = []

            // Validasi data pengguna
            if (!userData.nama) missingFields.push('Nama')
            if (!selectedUnit?.value) missingFields.push('Unit')
            if (isAdmin && !selectedValidator) missingFields.push('Validator')

            // Tentukan apakah ada lebih dari satu item bon sementara
            const multipleItems = bonSementara.length > 1

            // Validasi setiap bon sementara
            bonSementara.forEach((r, index) => {
                // Fungsi untuk menambahkan keterangan item dengan kondisional
                const getFieldLabel = (baseLabel) => {
                    return multipleItems ? `${baseLabel} (Item ${index + 1})` : baseLabel
                }

                if (!r.nomorBS) missingFields.push(getFieldLabel('Nomor BS'))
                if (!r.jumlahBS) missingFields.push(getFieldLabel('Jumlah BS'))
                if (!r.kategori) missingFields.push(getFieldLabel('Kategori'))
                if (!r.aktivitas) missingFields.push(getFieldLabel('Aktivitas'))
            })

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

            // Gunakan nomorBS pertama sebagai Id
            const displayId = bonSementara[0]?.nomorBS
            const kodeUnitBisnis = BUSINESS_UNIT_CODES[selectedUnit.value];

            // Fungsi untuk mengonversi format Rupiah ke angka
            const parseRupiah = (value) => {
                return Number(value.replace(/[^,\d]/g, '').replace(',', '.')) || 0
            }

            // Map data bon sementara langsung saat akan disimpan
            const bonSementaraData = {
                user: {
                    uid: userData.uid,
                    nama: userData.nama,
                    bankName: userData.bankName,
                    accountNumber: userData.accountNumber,
                    unit: selectedUnit.value,
                    posisi: userData.posisi,
                    department: userData.department,
                    validator: isAdmin ? [selectedValidator.value] : userData.validator,
                    reviewer1: userData.reviewer1,
                    reviewer2: userData.reviewer2
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

            // Simpan ke Firestore
            const docRef = await addDoc(collection(db, 'bonSementara'), bonSementaraData)

            // Update dengan ID dokumen
            await setDoc(doc(db, 'bonSementara', docRef.id), { ...bonSementaraData, id: docRef.id })

            // Reset unit bisnis ke unit awal untuk admin
            if (isAdmin) {
                setSelectedUnit({ value: userData.unit, label: userData.unit })
            }

            // update nilai di collection counter
            const counterRef = doc(db, 'businessUnitCounters', kodeUnitBisnis);
            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                const today = new Date();
                const month = (today.getMonth() + 1).toString().padStart(2, '0');

                let newLastNumber;
                if (!counterDoc.exists() || counterDoc.data().lastResetMonth !== month) {
                    newLastNumber = 501;
                } else {
                    newLastNumber = counterDoc.data().lastNumber + 1;
                }

                transaction.set(counterRef, {
                    lastNumber: newLastNumber,
                    lastResetMonth: month
                });
            })

            console.log('Bon Sementara berhasil dibuat:', {
                firestoreId: docRef.id,
                displayId: displayId
            })
            toast.success('Bon Sementara berhasil diajukan!')

            // Reset form setelah berhasil submit
            if (isAdmin) {
                setSelectedValidator(null)
            }
            resetForm()
            setIsSubmitting(false)
            const nextSequence = (parseInt(currentCounter) + 1).toString().padStart(7, '00005');
            setCurrentCounter(nextSequence);
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
                                    onChange={handleUnitChange}
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
                            <div className='block xl:hidden'>
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
                                />
                            </div>
                        </div>
                    </>
                )}

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
                                    className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
                                    type="text"
                                    value={bon.nomorBS}
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
                            <input
                                className="w-full border border-gray-300 text-gray-900 rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none h-10 px-4 py-2"
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

export default CreateBonForm
