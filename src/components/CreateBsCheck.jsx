import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import Modal from './Modal'
import Select from 'react-select'
import EmptyState from '../assets/images/EmptyState.png'
import { toast } from 'react-toastify'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

const CreateBsCheck = () => {
    const [activeTab, setActiveTab] = useState('pending')
    const [data, setData] = useState({ bonSementara: [] })
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [approvedData, setApprovedData] = useState({ bonSementara: [] })
    const [canceledData, setCanceledData] = useState({ bonSementara: [] })
    const [filteredApprovedData, setFilteredApprovedData] = useState({ bonSementara: [] })
    const [filteredCanceledData, setFilteredCanceledData] = useState({ bonSementara: [] })
    const [isValidatorForAny, setIsValidatorForAny] = useState(false);
    const [showModal, setShowModal] = useState(false)
    const [modalProps, setModalProps] = useState({})
    const [loading, setLoading] = useState(true);

    const uid = localStorage.getItem('userUid')

    // Get current date
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1 // JavaScript months are 0-indexed

    const [yearOptions, setYearOptions] = useState([{ value: currentYear, label: `${currentYear}` }])

    // Set default filters with current month and year
    const [filters, setFilters] = useState({
        bulan: { value: currentMonth, label: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(today) },
        tahun: { value: currentYear, label: `${currentYear}` }
    })

    // Fungsi untuk membuka modal
    const openModal = ({ title, message, onConfirm }) => {
        setModalProps({ title, message, onConfirm })
        setShowModal(true)
    }

    // Fungsi untuk menutup modal
    const closeModal = () => {
        setShowModal(false)
    }

    useEffect(() => {
        const uid = localStorage.getItem('userUid')
        const userRole = localStorage.getItem('userRole')
        const fetchUserAndBonSementara = async () => {
            setLoading(true)
            try {
                if (!uid) {
                    console.error('UID tidak ditemukan di localStorage')
                    return
                }

                let pendingBonSementara = []
                let approvedBonSementara = []
                let canceledBonSementara = []

                if (userRole === 'Super Admin') {
                    // Pending BonSementara for Super Admin
                    const pendingQ = query(
                        collection(db, 'bonSementara'),
                        where('status', 'in', ['Diajukan', 'Diproses'])
                    )
                    const pendingSnapshot = await getDocs(pendingQ)
                    pendingBonSementara = pendingSnapshot.docs.map((doc) => ({
                        id: doc.id,
                        displayId: doc.data().displayId,
                        ...doc.data(),
                    }))

                    // Approved BonSementara for Super Admin
                    const approvedQ = query(
                        collection(db, 'bonSementara'),
                        where('status', 'in', ['Diproses', 'Disetujui'])
                    )
                    const approvedSnapshot = await getDocs(approvedQ)
                    approvedBonSementara = approvedSnapshot.docs
                        .map((doc) => ({
                            id: doc.id,
                            displayId: doc.data().displayId,
                            ...doc.data(),
                        }))
                        .filter((doc) =>
                            doc.statusHistory.some((history) =>
                                history.actor === uid &&
                                [
                                    'Disetujui oleh Super Admin (Pengganti Reviewer 1)',
                                    'Disetujui oleh Super Admin (Pengganti Reviewer 2)',
                                    'Disetujui oleh Super Admin',
                                ].includes(history.status)
                            )
                        )
                } else {
                    // Get all documents where user is assigned in any role
                    const [reviewer1Docs, reviewer2Docs] = await Promise.all([
                        // Get documents where user is assigned as reviewer1
                        getDocs(
                            query(
                                collection(db, 'bonSementara'),
                                where('user.reviewer1', 'array-contains', uid),
                                where('status', '==', 'Diajukan')
                            )
                        ),
                        // Get documents where user is assigned as reviewer2
                        getDocs(
                            query(
                                collection(db, 'bonSementara'),
                                where('user.reviewer2', 'array-contains', uid),
                                where('status', '==', 'Diproses')
                            )
                        )
                    ])

                    pendingBonSementara = [
                        ...reviewer1Docs.docs.map(doc => ({
                            id: doc.id,
                            displayId: doc.data().displayId,
                            ...doc.data(),
                        })),
                        ...reviewer2Docs.docs.map(doc => ({
                            id: doc.id,
                            displayId: doc.data().displayId,
                            ...doc.data()
                        }))
                    ]

                    // Remove duplicates if any
                    pendingBonSementara = Array.from(new Set(pendingBonSementara.map(item => item.id)))
                        .map(id => pendingBonSementara.find(item => item.id === id))

                    // Get approved documents
                    const approvedQ = query(
                        collection(db, 'bonSementara'),
                        where('status', 'in', ['Diproses', 'Disetujui'])
                    )
                    const approvedSnapshot = await getDocs(approvedQ)
                    approvedBonSementara = approvedSnapshot.docs
                        .map((doc) => ({
                            id: doc.id,
                            displayId: doc.data().displayId,
                            ...doc.data(),
                        }))
                        .filter((doc) => {
                            const isAssignedAsReviewer1 = doc.user.reviewer1?.includes(uid)
                            const isAssignedAsReviewer2 = doc.user.reviewer2?.includes(uid)

                            return doc.statusHistory.some(
                                (history) =>
                                    history.actor === uid &&
                                    (
                                        (isAssignedAsReviewer1 && history.status === 'Disetujui oleh Reviewer 1') ||
                                        (isAssignedAsReviewer2 && history.status === 'Disetujui oleh Reviewer 2')
                                    )
                            )
                        })

                    // Get canceled documents
                    const canceledQ = query(
                        collection(db, 'bonSementara'),
                        where('status', '==', 'Dibatalkan'),
                        where('user.reviewer1', 'array-contains', uid)
                    );
                    const canceledSnapshot = await getDocs(canceledQ);
                    canceledBonSementara = canceledSnapshot.docs
                        .map((doc) => ({
                            id: doc.id,
                            displayId: doc.data().displayId,
                            ...doc.data()
                        }))
                        .filter(doc =>
                            doc.statusHistory.some(history => history.status === 'Dibatalkan')
                        );

                    setIsValidatorForAny(canceledBonSementara.length > 0);
                }

                // Sort BonSementara by date
                pendingBonSementara.sort((a, b) => {
                    const dateA = new Date(a.tanggalPengajuan)
                    const dateB = new Date(b.tanggalPengajuan)
                    return dateA - dateB
                })

                // Sort approved BonSementara by the latest statusHistory timestamp
                approvedBonSementara.sort((a, b) => {
                    const latestA = Math.max(
                        ...a.statusHistory
                            .filter((history) => history.actor === uid)
                            .map((history) => new Date(history.timestamp))
                    )
                    const latestB = Math.max(
                        ...b.statusHistory
                            .filter((history) => history.actor === uid)
                            .map((history) => new Date(history.timestamp))
                    )
                    return latestB - latestA
                })

                // Sort canceled BonSementara by the latest statusHistory timestamp
                canceledBonSementara.sort((a, b) => {
                    const timestampA = a.statusHistory
                        .find(history => history.status === 'Dibatalkan')?.timestamp || '';
                    const timestampB = b.statusHistory
                        .find(history => history.status === 'Dibatalkan')?.timestamp || '';
                    return new Date(timestampB) - new Date(timestampA);
                });

                const existingYears = new Set(
                    approvedBonSementara
                        .map(item =>
                            item.statusHistory
                                .filter(
                                    status =>
                                        status.actor === uid && status.status.includes('Disetujui')
                                )
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.timestamp
                        )
                        .filter(Boolean) // Hilangkan nilai undefined jika tidak ada tanggal
                        .map(timestamp => new Date(timestamp).getFullYear()) // Ambil tahun dari timestamp
                )

                const updatedYearOptions = Array.from(existingYears)
                    .map(year => ({ value: year, label: `${year}` }))
                    .sort((a, b) => b.value - a.value); // Urutkan tahun dari yang terbaru

                setYearOptions(updatedYearOptions)
                setData({ bonSementara: pendingBonSementara })
                setApprovedData({ bonSementara: approvedBonSementara })
                setCanceledData({ bonSementara: canceledBonSementara })
            } catch (error) {
                console.error('Error fetching bon sementara data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchUserAndBonSementara()
    }, [])

    const getAvailableTabs = () => {
        const tabs = [
            {
                id: "pending",
                label: "Perlu Ditanggapi"
            },
            {
                id: "approved",
                label: "Riwayat Persetujuan"
            }
        ];
        
        if (isValidatorForAny) {
            tabs.push({
                id: "canceled",
                label: "Pengajuan Dibatalkan"
            });
        }

        return tabs;
    };

    // Handle Approve
    const handleApprove = (item) => {
        openModal({
            title: 'Konfirmasi Approve',
            message: `Apakah Anda yakin ingin menyetujui bon sementara dengan Nomor BS ${item.displayId}?`,
            onConfirm: async () => {
                try {
                    const uid = localStorage.getItem('userUid')
                    const userRole = localStorage.getItem('userRole')
                    const bonSementaraRef = doc(db, 'bonSementara', item.id)

                    // Cek apakah UID termasuk dalam super admin, reviewer1, atau reviewer2
                    const isSuperAdmin = userRole === 'Super Admin'
                    const isReviewer1 = item.user.reviewer1.includes(uid)
                    const isReviewer2 = item.user.reviewer2.includes(uid)

                    let updateData = {}
                    const newStatusHistory = {
                        timestamp: new Date().toISOString(),
                        actor: uid
                    }

                    if (isSuperAdmin) {
                        // Super Admin approval logic
                        if (item.status === 'Diajukan') {
                            newStatusHistory.status = 'Disetujui oleh Super Admin (Pengganti Reviewer 1)'
                            updateData = {
                                status: 'Diproses',
                                approvedByReviewer1Status: 'superadmin',
                                approvedBySuperAdmin: true,
                            }
                        } else if (item.status === 'Diproses') {
                            newStatusHistory.status = 'Disetujui oleh Super Admin (Pengganti Reviewer 2)'
                            updateData = {
                                status: 'Disetujui',
                                approvedByReviewer2Status: 'superadmin',
                                approvedBySuperAdmin: true,
                            }
                        }
                    } else if (item.status === 'Diajukan' && isReviewer1) {
                        newStatusHistory.status = 'Disetujui oleh Reviewer 1'
                        updateData = {
                            status: 'Diproses',
                            approvedByReviewer1: true,
                            approvedByReviewer1Status: 'reviewer',
                        }
                    } else if (item.status === 'Diproses' && isReviewer2) {
                        if (
                            item.approvedByReviewer1Status === 'reviewer' ||
                            item.approvedByReviewer1Status === 'superadmin'
                        ) {
                            newStatusHistory.status = 'Disetujui oleh Reviewer 2'
                            updateData = {
                                status: 'Disetujui',
                                approvedByReviewer2: true,
                                approvedByReviewer2Status: 'reviewer',
                            }
                        }
                    }

                    // Update the document if there are changes
                    if (Object.keys(updateData).length > 0) {
                        // Add statusHistory to updateData
                        updateData.statusHistory = arrayUnion(newStatusHistory)

                        // Update Firestore
                        await updateDoc(bonSementaraRef, updateData)

                        // Get updated document after update
                        const updatedDoc = await getDoc(bonSementaraRef)
                        const updatedData = { id: updatedDoc.id, ...updatedDoc.data() }

                        const shouldRemoveFromPending = !isSuperAdmin || updateData.status === 'Disetujui'

                        if (shouldRemoveFromPending) {
                            setData((prevData) => ({
                                bonSementara: prevData.bonSementara.filter((r) => r.id !== item.id)
                            }))
                        } else {
                            setData((prevData) => ({
                                bonSementara: prevData.bonSementara.map((r) => (r.id === item.id ? updatedData : r))
                            }))
                        }

                        // Update approved list dengan data terbaru dari Firestore
                        setApprovedData((prevData) => {
                            const existingIndex = prevData.bonSementara.findIndex((r) => r.id === item.id)
                            const newBonSementara = [...prevData.bonSementara]

                            if (existingIndex !== -1) {
                                newBonSementara[existingIndex] = updatedData
                            } else {
                                newBonSementara.unshift(updatedData)
                            }

                            return {
                                bonSementara: newBonSementara
                            }
                        })

                        toast.success('Bon Sementara berhasil disetujui')
                        closeModal()
                    }
                } catch (error) {
                    console.error('Error approving Bon Sementara:', error)
                    toast.error('Gagal menyetujui Bon Sementara')
                }
            }
        })
    }

    // Handle Reject
    const handleReject = (item) => {
        openModal({
            title: 'Konfirmasi Reject',
            message: `Apakah Anda yakin ingin menolak Bon Sementara dengan Nomor BS ${item.displayId}?`,
            onConfirm: async () => {
                try {
                    const uid = localStorage.getItem('userUid')
                    const userRole = localStorage.getItem('userRole')
                    const bonSementaraRef = doc(db, 'bonSementara', item.id)

                    // Cek apakah UID termasuk dalam super admin, reviewer1, atau reviewer2
                    const isSuperAdmin = userRole === 'Super Admin'
                    const isReviewer1 = item.user.reviewer1.includes(uid)
                    const isReviewer2 = item.user.reviewer2.includes(uid)

                    let updateData = {}

                    if (isSuperAdmin) {
                        // Super Admin rejection logic
                        if (!item.approvedByReviewer1Status) {
                            updateData = {
                                status: 'Ditolak',
                                approvedByReviewer1Status: 'superadmin',
                                rejectedBySuperAdmin: true,
                                statusHistory: arrayUnion({
                                    status: 'Ditolak oleh Super Admin (Pengganti Reviewer 1)',
                                    timestamp: new Date().toISOString(),
                                    actor: uid
                                })
                            }
                        } else if (
                            item.approvedByReviewer1Status === 'superadmin' ||
                            item.approvedByReviewer1Status === 'reviewer'
                        ) {
                            updateData = {
                                status: 'Ditolak',
                                approvedByReviewer2Status: 'superadmin',
                                rejectedBySuperAdmin: true,
                                statusHistory: arrayUnion({
                                    status: 'Ditolak oleh Super Admin (Pengganti Reviewer 2)',
                                    timestamp: new Date().toISOString(),
                                    actor: uid
                                })
                            }
                        }
                    } else {
                        // Existing reviewer rejection logic
                        if (isReviewer1) {
                            updateData = {
                                status: 'Ditolak',
                                approvedByReviewer1Status: 'reviewer',
                                statusHistory: arrayUnion({
                                    status: 'Ditolak oleh Reviewer 1',
                                    timestamp: new Date().toISOString(),
                                    actor: uid
                                })
                            }
                        } else if (
                            isReviewer2 &&
                            (item.approvedByReviewer1Status === 'reviewer' ||
                                item.approvedByReviewer1Status === 'superadmin')
                        ) {
                            updateData = {
                                status: 'Ditolak',
                                statusHistory: arrayUnion({
                                    status: 'Ditolak oleh Reviewer 2',
                                    timestamp: new Date().toISOString(),
                                    actor: uid
                                })
                            }
                        } else {
                            throw new Error('Anda tidak memiliki akses untuk menolak bon sementara ini.')
                        }
                    }

                    // Update the document
                    await updateDoc(bonSementaraRef, updateData)

                    // Remove the rejected item from the list
                    setData(prevData => ({
                        bonSementara: prevData.bonSementara.filter(r => r.id !== item.id)
                    }))

                    toast.success('Bon Sementara berhasil ditolak')
                    closeModal()
                } catch (error) {
                    console.error('Error rejecting bon sementara:', error)
                    toast.error('Gagal menolak Bon Sementara')
                }
            }
        })
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A' // Handle null/undefined
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(date)
    }

    const filterOptions = {
        bulan: [
            { value: 1, label: 'Januari' },
            { value: 2, label: 'Februari' },
            { value: 3, label: 'Maret' },
            { value: 4, label: 'April' },
            { value: 5, label: 'Mei' },
            { value: 6, label: 'Juni' },
            { value: 7, label: 'Juli' },
            { value: 8, label: 'Agustus' },
            { value: 9, label: 'September' },
            { value: 10, label: 'Oktober' },
            { value: 11, label: 'November' },
            { value: 12, label: 'Desember' }
        ]
    }

    // Filtering effect for canceled data
    useEffect(() => {
        const filterData = () => {
            const filteredCanceled = canceledData.bonSementara.filter(item => {
                // Find the cancellation entry in statusHistory
                const canceledEntry = item.statusHistory
                    .find(status => status.status === 'Dibatalkan');

                if (!canceledEntry) return false;

                const itemDate = new Date(canceledEntry.timestamp);
                const matchesMonth = filters.bulan
                    ? itemDate.getMonth() + 1 === filters.bulan.value
                    : true;
                const matchesYear = filters.tahun
                    ? itemDate.getFullYear() === filters.tahun.value
                    : true;

                return matchesMonth && matchesYear;
            });
            setFilteredCanceledData({ bonSementara: filteredCanceled });
        };
        filterData();
    }, [filters.bulan, filters.tahun, canceledData]);

    useEffect(() => {
        const uid = localStorage.getItem('userUid')
        const filterData = () => {
            const filtered = approvedData.bonSementara.filter(item => {
                const approvedTimestamp = item.statusHistory
                    .filter(status => status.actor === uid && status.status.includes('Disetujui'))
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.timestamp

                if (!approvedTimestamp) return false // Skip jika tidak ada tanggal disetujui

                const itemDate = new Date(approvedTimestamp)
                const matchesMonth = filters.bulan
                    ? itemDate.getMonth() + 1 === filters.bulan.value
                    : true
                const matchesYear = filters.tahun
                    ? itemDate.getFullYear() === filters.tahun.value
                    : true

                return matchesMonth && matchesYear
            })
            setFilteredApprovedData({ bonSementara: filtered })
        }
        filterData()
    }, [filters.bulan, filters.tahun, approvedData])

    const handleFilterChange = (field, selectedOption) => {
        setFilters((prev) => ({
            ...prev,
            [field]: selectedOption
        }))
    }

    const selectStyles = {
        control: (base) => ({
            ...base,
            display: 'flex', // Menggunakan Flexbox
            alignItems: 'center', // Teks berada di tengah vertikal
            justifyContent: 'space-between', // Menjaga ikon dropdown di kanan
            borderColor: '#e5e7eb',
            fontSize: '12px', // Ukuran teks
            height: '32px', // Tinggi field tetap
            padding: '0 4px', // Padding horizontal
            lineHeight: 'normal', // Pastikan line-height default
            '&:hover': {
                borderColor: '#3b82f6'
            },
            borderRadius: '8px' // Sudut melengkung
        }),
        menu: (base) => ({
            ...base,
            zIndex: 100
        }),
        option: (base) => ({
            ...base,
            fontSize: '12px',
            padding: '6px 12px',
            cursor: 'pointer'
        })
    }

    const FilterSelect = ({ field, label }) => {
        // For year, use the dynamically generated yearOptions
        const options = field === 'tahun' ? yearOptions : filterOptions[field]

        return (
            <Select
                value={filters[field]}
                onChange={(option) => handleFilterChange(field, option)}
                options={options}
                placeholder={label}
                className="w-full md:w-32 xl:w-40"
                styles={selectStyles}
                isSearchable={false}
                menuPortalTarget={document.body}
                menuPosition="absolute"
            />
        )
    }

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Cek <span className="font-bold">Pengajuan Bon Sementara</span>
            </h2>

            <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
                <div className="mb-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 xl:gap-24">
                        {/* Dropdown Title Section */}
                        <div className="relative flex-shrink-0">
                            <h3
                                className="text-xl font-medium cursor-pointer hover:text-gray-700 flex items-center gap-2 transition-all duration-200"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                {activeTab === 'pending'
                                    ? 'Bon Sementara Perlu Ditanggapi'
                                    : activeTab === 'approved'
                                        ? 'Riwayat Persetujuan Bon Sementara'
                                        : 'Pengajuan Bon Sementara Dibatalkan'}
                                <svg
                                    className={`w-6 h-6 md:w-5 md:h-5 transition-transform duration-200 flex-shrink-0 ${isDropdownOpen ? "rotate-180" : ""}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M5 9l7 7 7-7" />
                                </svg>
                            </h3>

                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg py-1 z-50 min-w-[250px] md:w-auto shadow-lg">
                                    {getAvailableTabs().map((tab) => (
                                        <div
                                            key={tab.id}
                                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                                            onClick={() => {
                                                setActiveTab(tab.id);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            <span className={`${activeTab === tab.id ? "font-medium text-red-600" : ""}`}>
                                                {tab.label}
                                            </span>
                                            {activeTab === tab.id && (
                                                <svg
                                                    className="w-5 h-5 md:w-4 md:h-4 text-red-600 flex-shrink-0"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Filter controls for approved and canceled tabs */}
                        {(activeTab === 'approved' || activeTab === 'canceled') && !loading && (
                            <div className="flex space-x-2 w-full md:w-auto">
                                <FilterSelect field="bulan" label="Bulan" />
                                <FilterSelect field="tahun" label="Tahun" />
                            </div>
                        )}
                    </div>
                </div>

                {activeTab === 'pending' ? (
                    // Pending bonSementara section 
                    loading ? (
                        <Skeleton count={5} height={40} />
                    ) : data.bonSementara.length === 0 ? (
                        <div className="flex justify-center">
                            <figure className="w-44 h-44">
                                <img
                                    src={EmptyState}
                                    alt="Bon Sementara icon"
                                    className="w-full h-full object-contain"
                                />
                            </figure>
                        </div>
                    ) : (
                        <div className="w-full">
                            <div className="w-full overflow-x-auto">
                                <div className="inline-block min-w-[900px] w-full">
                                    <table className="w-full bg-white border rounded-lg text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 text-left">
                                                <th className="p-2 border text-center w-auto">No.</th>
                                                <th className="px-4 py-2 border">Nomor BS</th>
                                                <th className="px-4 py-2 border">Nama</th>
                                                <th className="px-4 py-2 border">Kategori BS</th>
                                                <th className="px-4 py-2 border">Jumlah</th>
                                                <th className="px-4 py-2 border">Tanggal Pengajuan</th>
                                                <th className="p-2 border text-center">Status</th>
                                                <th className="p-2 border text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.bonSementara.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="p-2 border text-center w-auto">{index + 1}</td>
                                                    <td className="px-4 py-2 border">
                                                        <Link
                                                            to={`/create-bs/${item.id}`}
                                                            className="text-black hover:text-gray-700 hover:underline cursor-pointer"
                                                        >
                                                            {item.displayId}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-2 border">{item.user.nama}</td>
                                                    <td className="px-4 py-2 border">
                                                        {item.bonSementara[0].kategori}
                                                    </td>
                                                    <td className="px-4 py-2 border">
                                                        Rp
                                                        {item.bonSementara[0].jumlahBS.toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-4 py-2 border">
                                                        {formatDate(item.tanggalPengajuan)}
                                                    </td>
                                                    <td className="p-2 border text-center">
                                                        <span
                                                            className={`px-4 py-1 rounded-full text-xs font-medium 
                                                    ${item.status === 'Diajukan'
                                                                    ? 'bg-blue-200 text-blue-800 border-[1px] border-blue-600'
                                                                    : item.status === 'Disetujui'
                                                                        ? 'bg-green-200 text-green-800 border-[1px] border-green-600'
                                                                        : item.status === 'Diproses'
                                                                            ? 'bg-yellow-200 text-yellow-800 border-[1px] border-yellow-600'
                                                                            : 'bg-gray-300 text-gray-700 border-[1px] border-gray-600'
                                                                }`}
                                                        >
                                                            {item.status || 'Tidak Diketahui'}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 border text-center">
                                                        <div className="flex justify-center space-x-2">
                                                            <button
                                                                className="rounded-full p-1 bg-green-200 hover:bg-green-300 text-green-600 border-[1px] border-green-600"
                                                                onClick={() => handleApprove(item)}
                                                                title="Approve"
                                                            >
                                                                <svg
                                                                    className="w-6 h-6"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        d="M5 13l4 4L19 7"
                                                                    />
                                                                </svg>
                                                            </button>

                                                            <button
                                                                className="rounded-full p-1 bg-red-200 hover:bg-red-300 text-red-600 border-[1px] border-red-600"
                                                                onClick={() => handleReject(item)}
                                                                title="Reject"
                                                            >
                                                                <svg
                                                                    className="w-6 h-6"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        d="M6 18L18 6M6 6l12 12"
                                                                    />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                ) : activeTab === 'approved' ? (
                    // Approved bonSementara section
                    <div>
                        {loading ? (
                            <Skeleton count={5} height={40} />
                        ) : filteredApprovedData.bonSementara.length === 0 ? (
                            <div className="flex justify-center">
                                <figure className="w-44 h-44">
                                    <img
                                        src={EmptyState}
                                        alt="Bon Sementara icon"
                                        className="w-full h-full object-contain"
                                    />
                                </figure>
                            </div>
                        ) : (
                            <div className="w-full">
                                <div className="w-full overflow-x-auto">
                                    <div className="inline-block min-w-[1000px] w-full">
                                        <table className="min-w-full bg-white border rounded-lg text-sm">
                                            <thead>
                                                <tr className="bg-gray-100 text-left">
                                                    <th className="p-2 border text-center w-auto">No.</th>
                                                    <th className="px-4 py-2 border">Nomor BS</th>
                                                    <th className="px-4 py-2 border">Nama</th>
                                                    <th className="px-4 py-2 border">Kategori BS</th>
                                                    <th className="px-4 py-2 border">Jumlah</th>
                                                    <th className="px-4 py-2 border">Tanggal Pengajuan</th>
                                                    <th className="px-4 py-2 border">Tanggal Disetujui</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredApprovedData.bonSementara.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="p-2 border text-center w-auto">{index + 1}</td>
                                                        <td className="px-4 py-2 border">
                                                            <Link
                                                                to={`/create-bs/${item.id}`}
                                                                className="text-black hover:text-gray-700 hover:underline cursor-pointer"
                                                            >
                                                                {item.displayId}
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-2 border">{item.user.nama}</td>
                                                        <td className="px-4 py-2 border">
                                                            {item.bonSementara[0].kategori}
                                                        </td>
                                                        <td className="px-4 py-2 border">
                                                            Rp{item.bonSementara[0].jumlahBS.toLocaleString('id-ID')}
                                                        </td>
                                                        <td className="px-4 py-2 border">
                                                            {formatDate(item.tanggalPengajuan)}
                                                        </td>
                                                        <td className="p-4 border">
                                                            {formatDate(
                                                                item.statusHistory
                                                                    .filter(
                                                                        (status) =>
                                                                            status.actor === uid &&
                                                                            status.status.includes('Disetujui')
                                                                    )
                                                                    .sort(
                                                                        (a, b) =>
                                                                            new Date(b.timestamp) -
                                                                            new Date(a.timestamp)
                                                                    )[0]?.timestamp
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // Canceled bonSementara section
                    <div>
                        {loading ? (
                            <Skeleton count={5} height={40} />
                        ) : filteredCanceledData.bonSementara.length === 0 ? (
                            <div className="flex justify-center">
                                <figure className="w-44 h-44">
                                    <img
                                        src={EmptyState}
                                        alt="Bon Sementara icon"
                                        className="w-full h-full object-contain"
                                    />
                                </figure>
                            </div>
                        ) : (
                            <div className="w-full">
                                <div className="w-full overflow-x-auto">
                                    <div className="inline-block min-w-[1000px] w-full">
                                        <table className="min-w-full bg-white border rounded-lg text-sm">
                                            <thead>
                                                <tr className="bg-gray-100 text-left">
                                                    <th className="p-2 border text-center w-auto">No.</th>
                                                    <th className="px-4 py-2 border">Nomor BS</th>
                                                    <th className="px-4 py-2 border">Nama</th>
                                                    <th className="px-4 py-2 border">Kategori BS</th>
                                                    <th className="px-4 py-2 border">Jumlah</th>
                                                    <th className="px-4 py-2 border">Tanggal Pengajuan</th>
                                                    <th className="px-4 py-2 border">Tanggal Dibatalkan</th>
                                                    <th className="px-4 py-2 border">Alasan Pembatalan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCanceledData.bonSementara.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="p-2 border text-center w-auto">{index + 1}</td>
                                                        <td className="px-4 py-2 border">
                                                            <Link
                                                                to={`/create-bs/${item.id}`}
                                                                className="text-black hover:text-gray-700 hover:underline cursor-pointer"
                                                            >
                                                                {item.displayId}
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-2 border">{item.user.nama}</td>
                                                        <td className="px-4 py-2 border">
                                                            {item.bonSementara[0].kategori}
                                                        </td>
                                                        <td className="px-4 py-2 border">
                                                            Rp{item.bonSementara[0].jumlahBS.toLocaleString('id-ID')}
                                                        </td>
                                                        <td className="px-4 py-2 border">
                                                            {formatDate(item.tanggalPengajuan)}
                                                        </td>
                                                        <td className="p-4 border">
                                                            {formatDate(
                                                                item.statusHistory
                                                                    .find(status => status.status === 'Dibatalkan')
                                                                    ?.timestamp
                                                            )}
                                                        </td>
                                                        <td className="p-4 border truncate max-w-[150px] overflow-hidden whitespace-nowrap">{item.cancelReason || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal
                showModal={showModal}
                title={modalProps.title}
                message={modalProps.message}
                onClose={closeModal}
                onConfirm={modalProps.onConfirm}
                cancelText="Batal"
                confirmText="Ya"
            />
        </div>
    );
}

export default CreateBsCheck
