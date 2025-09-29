import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// --- PERUBAHAN 1: Impor fungsi 'doc' dan 'deleteDoc' dari Firestore ---
import { collection, query, where, getDocs, or, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import Select from 'react-select';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import EmptyState from '../assets/images/EmptyState.png';
import * as XLSX from 'xlsx';

const ReportExport = () => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [documentType, setDocumentType] = useState('reimbursement');
    const [data, setData] = useState({
        reimbursements: [],
        bonSementara: [],
        lpj: []
    });
    const [filteredData, setFilteredData] = useState({
        reimbursements: [],
        bonSementara: [],
        lpj: []
    });
    const [loading, setLoading] = useState(true);
    const [yearOptions, setYearOptions] = useState([]);
    const [approvers, setApprovers] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Get current date
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Set default filters
    const [filters, setFilters] = useState({
        bulan: { value: currentMonth, label: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(today) },
        tahun: { value: currentYear, label: `${currentYear}` },
        unit: { value: "all", label: "Semua Unit Bisnis" }
    });

    const unitOptions = [
        { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
        { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
        { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
        { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
        { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
        { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
        { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
        { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' },
        { value: 'Samudera', label: 'Samudera' }
    ]

    useEffect(() => {
        const fetchApprovers = async () => {
            try {
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const usersMap = {};
                usersSnapshot.docs.forEach(doc => {
                    usersMap[doc.id] = doc.data().nama;
                });
                setApprovers(usersMap);
            } catch (error) {
                console.error('Error fetching approvers:', error);
            }
        };

        const fetchApprovedDocuments = async () => {
            setLoading(true);
            try {
                // Fetch reimbursements
                const reimbursementSnapshot = await getDocs(query(
                    collection(db, 'reimbursement'),
                    or(
                        where('status', '==', 'Disetujui'),
                        where('status', '==', 'Dibatalkan')
                    )
                ));

                // Fetch bon sementara
                const bonSementaraSnapshot = await getDocs(query(
                    collection(db, 'bonSementara'),
                    or(
                        where('status', '==', 'Disetujui'),
                        where('status', '==', 'Dibatalkan')
                    )
                ));

                // Fetch LPJ
                const lpjSnapshot = await getDocs(query(
                    collection(db, 'lpj'),
                    or(
                        where('status', '==', 'Disetujui'),
                        where('status', '==', 'Dibatalkan')
                    )
                ));

                const mapDocsToData = (snapshot) => snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const sortByApprovalDate = (items) => items.sort((a, b) => {
                    const dateA = new Date(a.statusHistory[a.statusHistory.length - 1].timestamp);
                    const dateB = new Date(b.statusHistory[b.statusHistory.length - 1].timestamp);
                    return dateB - dateA;
                });

                const reimbursements = sortByApprovalDate(mapDocsToData(reimbursementSnapshot));
                const bonSementara = sortByApprovalDate(mapDocsToData(bonSementaraSnapshot));
                const lpj = sortByApprovalDate(mapDocsToData(lpjSnapshot));

                // Get unique years from all documents
                const allDates = [...reimbursements, ...bonSementara, ...lpj].map(item =>
                    new Date(item.statusHistory[item.statusHistory.length - 1].timestamp).getFullYear()
                );
                const years = [...new Set(allDates)];

                setYearOptions(years.map(year => ({ value: year, label: `${year}` })));
                setData({ reimbursements, bonSementara, lpj });
            } catch (error) {
                console.error('Error fetching documents:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchApprovers();
        fetchApprovedDocuments();
    }, []);

    useEffect(() => {
        const filterDocuments = () => {
            const filterByDateAndUnit = (items) => items.filter(item => {
                const approvalDate = new Date(item.statusHistory[item.statusHistory.length - 1].timestamp);
                const matchesMonth = filters.bulan ? approvalDate.getMonth() + 1 === filters.bulan.value : true;
                const matchesYear = filters.tahun ? approvalDate.getFullYear() === filters.tahun.value : true;
                const matchesUnit = filters.unit.value === "all" ? true : item.user.unit === filters.unit.value;
                return matchesMonth && matchesYear && matchesUnit;
            });

            setFilteredData({
                reimbursements: filterByDateAndUnit(data.reimbursements),
                bonSementara: filterByDateAndUnit(data.bonSementara),
                lpj: filterByDateAndUnit(data.lpj)
            });
        };
        filterDocuments();
    }, [filters, data]);

    // --- PERUBAHAN 2: Fungsi untuk menghapus dokumen ---
    const handleDelete = async (docId, collectionName) => {
        // Tampilkan dialog konfirmasi sebelum menghapus
        const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus dokumen ini? Tindakan ini tidak dapat dibatalkan.");

        if (isConfirmed) {
            try {
                // Hapus dokumen dari Firestore
                await deleteDoc(doc(db, collectionName, docId));

                // Perbarui state lokal untuk menghapus item dari UI secara real-time
                setData(prevData => {
                    const updatedCollection = prevData[collectionName].filter(item => item.id !== docId);
                    return {
                        ...prevData,
                        [collectionName]: updatedCollection
                    };
                });

                alert("Dokumen berhasil dihapus!");

            } catch (error) {
                console.error("Error deleting document: ", error);
                alert("Gagal menghapus dokumen. Silakan coba lagi.");
            }
        }
    };


    const getApproverName = (statusHistory) => {
        const lastEntry = statusHistory[statusHistory.length - 1];
        return approvers[lastEntry?.actor] || 'Unknown';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(date);
    };

    const prepareReimbursementData = (items) => items.map(item => ({
        'Nomor Dokumen': item.displayId,
        'Nama': item.user.nama,
        'Bisnis Unit': item.user.unit,
        'Kategori': item.kategori,
        'Total Biaya': item.totalBiaya,
        'Tanggal Pengajuan': formatDate(item.tanggalPengajuan),
        'Tanggal Disetujui/Dibatalkan': formatDate(item.statusHistory[item.statusHistory.length - 1].timestamp),
        'Disetujui/Dibatalkan Oleh': getApproverName(item.statusHistory),
        'Status': item.status
    }));

    const prepareBonSementaraData = (items) => items.flatMap(doc =>
        doc.bonSementara.map(bs => ({
            'Nomor BS': bs.nomorBS,
            'Nama': doc.user.nama,
            'Bisnis Unit': doc.user.unit,
            'Kategori': bs.kategori,
            'Jumlah BS': bs.jumlahBS,
            'Tanggal Pengajuan': formatDate(doc.tanggalPengajuan),
            'Tanggal Disetujui/Dibatalkan': formatDate(doc.statusHistory[doc.statusHistory.length - 1].timestamp),
            'Disetujui/Dibatalkan Oleh': getApproverName(doc.statusHistory),
            'Status': doc.status
        }))
    );

    const prepareLPJData = (items) => items.map(item => ({
        'Nomor Dokumen': item.displayId,
        'Nama': item.user.nama,
        'Bisnis Unit': item.user.unit,
        'Kategori': item.kategori,
        'Total Biaya': item.totalBiaya,
        'Tanggal Pengajuan': formatDate(item.tanggalPengajuan),
        'Tanggal Disetujui/Dibatalkan': formatDate(item.statusHistory[item.statusHistory.length - 1].timestamp),
        'Disetujui/Dibatalkan Oleh': getApproverName(item.statusHistory),
        'Status': item.status
    }));

    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        let sheetData;
        let sheetName;
        let fileName;

        const unitSuffix = filters.unit.value !== "all"
            ? `${filters.unit.value}_`
            : '';

        switch (documentType) {
            case 'reimbursement':
                sheetData = prepareReimbursementData(filteredData.reimbursements);
                sheetName = 'Reimbursement';
                fileName = `Reimbursement_${unitSuffix}${filters.bulan.label}_${filters.tahun.value}.xlsx`;
                break;
            case 'bonSementara':
                sheetData = prepareBonSementaraData(filteredData.bonSementara);
                sheetName = 'Bon Sementara';
                fileName = `Bon_Sementara_${unitSuffix}${filters.bulan.label}_${filters.tahun.value}.xlsx`;
                break;
            case 'lpj':
                sheetData = prepareLPJData(filteredData.lpj);
                sheetName = 'LPJ BS';
                fileName = `LPJ_BS_${unitSuffix}${filters.bulan.label}_${filters.tahun.value}.xlsx`;
                break;
            default:
                console.error('Unknown document type:', documentType);
                return;
        }

        const ws = XLSX.utils.json_to_sheet(sheetData);

        ws['!cols'] = [
            { wch: 25 }, // Nomor Dokumen
            { wch: 20 }, // Nama
            { wch: 25 }, // Bisnis Unit
            { wch: 15 }, // Kategori
            { wch: 15 }, // Total Biaya
            { wch: 20 }, // Tanggal Pengajuan
            { wch: 20 }, // Tanggal Disetujui/Dibatalkan
            { wch: 25 }, // Disetujui/Dibatalkan Oleh
            { wch: 15 }  // Status
        ];

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, fileName);
    };

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
    };

    const handleFilterChange = (field, selectedOption) => {
        setFilters(prev => ({
            ...prev,
            [field]: selectedOption
        }));
    };

    const selectStyles = {
        control: (base) => ({
            ...base,
            borderColor: '#e5e7eb',
            '&:hover': {
                borderColor: '#3b82f6'
            },
            minHeight: '32px',
            fontSize: '14px',
            display: 'flex',
            flexWrap: 'nowrap',
            overflow: 'auto'
        }),
        valueContainer: (base) => ({
            ...base,
            flexWrap: 'nowrap',
            whiteSpace: 'nowrap',
            overflow: 'auto',
            '::-webkit-scrollbar': {
                display: 'none'
            },
            scrollbarWidth: 'none'
        }),
        menu: (base) => ({
            ...base,
            zIndex: 100
        }),
        option: (base) => ({
            ...base,
            fontSize: '14px',
            padding: '6px 12px',
            cursor: 'pointer'
        }),
        multiValue: (base) => ({
            ...base,
            fontSize: '14px',
            flexShrink: 0
        })
    }

    const getTotalPages = () => {
        switch (documentType) {
            case 'reimbursement':
                return Math.ceil(filteredData.reimbursements.length / itemsPerPage);
            case 'bonSementara':
                const totalBonSementara = filteredData.bonSementara.reduce(
                    (total, doc) => total + doc.bonSementara.length,
                    0
                );
                return Math.ceil(totalBonSementara / itemsPerPage);
            case 'lpj':
                return Math.ceil(filteredData.lpj.length / itemsPerPage);
            default:
                return 0;
        }
    };

    const getCurrentPageData = () => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        switch (documentType) {
            case 'reimbursement':
                return filteredData.reimbursements.slice(startIndex, endIndex);
            case 'bonSementara':
                const flattenedBonSementara = filteredData.bonSementara.flatMap(doc =>
                    doc.bonSementara.map(bs => ({
                        ...bs,
                        user: doc.user,
                        tanggalPengajuan: doc.tanggalPengajuan,
                        statusHistory: doc.statusHistory,
                        status: doc.status,
                        id: doc.id
                    }))
                );
                return flattenedBonSementara.slice(startIndex, endIndex);
            case 'lpj':
                return filteredData.lpj.slice(startIndex, endIndex);
            default:
                return [];
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [documentType, filters]);

    const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
        const getVisiblePages = () => {
            let pages = [];
            const visiblePages = window.innerWidth < 640 ? 1 : 3;

            // Always show first page
            pages.push(
                <button
                    key={1}
                    onClick={() => onPageChange(1)}
                    className={`min-w-[36px] h-9 rounded-full ${currentPage === 1
                        ? 'bg-red-600 text-white'
                        : 'border border-red-600 text-red-600 hover:bg-red-100'
                        }`}
                >
                    1
                </button>
            );

            if (totalPages <= visiblePages + 2) {
                // Show all pages if total is small
                for (let i = 2; i <= totalPages; i++) {
                    pages.push(
                        <button
                            key={i}
                            onClick={() => onPageChange(i)}
                            className={`min-w-[36px] h-9 rounded-full ${currentPage === i
                                ? 'bg-red-600 text-white'
                                : 'border border-red-600 text-red-600 hover:bg-red-100'
                                }`}
                        >
                            {i}
                        </button>
                    );
                }
            } else {
                // Mobile view logic
                if (window.innerWidth < 640) {
                    if (currentPage > 2 && currentPage < totalPages - 1) {
                        pages.push(<span key="ellipsis1" className="px-1">...</span>);
                        pages.push(
                            <button
                                key={currentPage}
                                onClick={() => onPageChange(currentPage)}
                                className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                            >
                                {currentPage}
                            </button>
                        );
                        pages.push(<span key="ellipsis2" className="px-1">...</span>);
                    } else if (currentPage <= 2) {
                        if (currentPage === 2) {
                            pages.push(
                                <button
                                    key={2}
                                    onClick={() => onPageChange(2)}
                                    className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                >
                                    2
                                </button>
                            );
                        }
                        pages.push(<span key="ellipsis1" className="px-1">...</span>);
                    } else {
                        pages.push(<span key="ellipsis1" className="px-1">...</span>);
                        if (currentPage === totalPages - 1) {
                            pages.push(
                                <button
                                    key={totalPages - 1}
                                    onClick={() => onPageChange(totalPages - 1)}
                                    className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                >
                                    {totalPages - 1}
                                </button>
                            );
                        }
                    }
                } else {
                    // Desktop view logic
                    if (currentPage <= visiblePages) {
                        for (let i = 2; i <= visiblePages; i++) {
                            pages.push(
                                <button
                                    key={i}
                                    onClick={() => onPageChange(i)}
                                    className={`min-w-[36px] h-9 rounded-full ${currentPage === i
                                        ? 'bg-red-600 text-white'
                                        : 'border border-red-600 text-red-600 hover:bg-red-100'
                                        }`}
                                >
                                    {i}
                                </button>
                            );
                        }
                        pages.push(<span key="ellipsis1" className="px-1">...</span>);
                    } else if (currentPage > totalPages - visiblePages) {
                        pages.push(<span key="ellipsis1" className="px-1">...</span>);
                        for (let i = totalPages - visiblePages + 1; i < totalPages; i++) {
                            pages.push(
                                <button
                                    key={i}
                                    onClick={() => onPageChange(i)}
                                    className={`min-w-[36px] h-9 rounded-full ${currentPage === i
                                        ? 'bg-red-600 text-white'
                                        : 'border border-red-600 text-red-600 hover:bg-red-100'
                                        }`}
                                >
                                    {i}
                                </button>
                            );
                        }
                    } else {
                        pages.push(<span key="ellipsis1" className="px-1">...</span>);
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                            if (i > 1 && i < totalPages) {
                                pages.push(
                                    <button
                                        key={i}
                                        onClick={() => onPageChange(i)}
                                        className={`min-w-[36px] h-9 rounded-full ${currentPage === i
                                            ? 'bg-red-600 text-white'
                                            : 'border border-red-600 text-red-600 hover:bg-red-100'
                                            }`}
                                    >
                                        {i}
                                    </button>
                                );
                            }
                        }
                        pages.push(<span key="ellipsis2" className="px-1">...</span>);
                    }
                }

                // Always show last page
                if (totalPages > 1) {
                    pages.push(
                        <button
                            key={totalPages}
                            onClick={() => onPageChange(totalPages)}
                            className={`min-w-[36px] h-9 rounded-full ${currentPage === totalPages
                                ? 'bg-red-600 text-white'
                                : 'border border-red-600 text-red-600 hover:bg-red-100'
                                }`}
                        >
                            {totalPages}
                        </button>
                    );
                }
            }

            return pages;
        };

        return totalPages > 1 ? (
            <div className="flex items-center justify-center gap-1 mt-6 text-xs">
                {/* Previous Button */}
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`flex items-center px-2 h-9 rounded-full ${currentPage === 1
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'border border-red-600 text-red-600 hover:bg-red-100'
                        }`}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>

                {/* Page Numbers */}
                {getVisiblePages()}

                {/* Next Button */}
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`flex items-center px-2 h-9 rounded-full ${currentPage === totalPages
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'border border-red-600 text-red-600 hover:bg-red-100'
                        }`}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="size-4"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
            </div>
        ) : null;
    };

    const handleDocumentChange = (documentType) => {
        setDocumentType(documentType);
    };

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-medium mb-4">
                Ekspor <span className="font-bold">Laporan Pengajuan</span>
            </h2>

            <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="mb-4">
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 xl:gap-24">
                        {/* Bagian Judul */}
                        <div className="relative flex-shrink-0">
                            <h3
                                className="text-xl font-medium cursor-pointer hover:text-gray-700 flex items-center gap-2 transition-all duration-200"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                {documentType === 'reimbursement' && 'Pengajuan Reimbursement'}
                                {documentType === 'bonSementara' && 'Pengajuan Bon Sementara'}
                                {documentType === 'lpj' && 'Pengajuan LPJ BS'}
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
                                <div
                                    className="absolute top-full left-0 mt-1 bg-white rounded-lg py-1 z-50 min-w-[250px] md:w-auto"
                                    onMouseLeave={() => setIsDropdownOpen(false)}
                                >
                                    {/* Dropdown Options */}
                                    {["reimbursement", "bonSementara", "lpj"].map((type) => (
                                        <div
                                            key={type}
                                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                                            onClick={() => {
                                                handleDocumentChange(type);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            <span className={`${documentType === type ? "font-medium text-red-600" : ""}`}>
                                                {type === "reimbursement" ? "Reimbursement" : type === "bonSementara" ? "Bon Sementara" : "LPJ BS"}
                                            </span>
                                            {documentType === type && (
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

                        {/* Bagian Filter */}
                        <div className="flex flex-col xl:flex-row items-center gap-2 w-full">
                            {loading ? (
                                <>
                                    <div className="w-full">
                                        <Skeleton height={32} />
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <div className="w-7/12">
                                            <Skeleton height={32} />
                                        </div>
                                        <div className="w-5/12">
                                            <Skeleton height={32} />
                                        </div>
                                    </div>
                                    <div className="w-full xl:w-96">
                                        <Skeleton height={32} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-full">
                                        <Select
                                            value={filters.unit}
                                            onChange={(option) => handleFilterChange('unit', option)}
                                            options={[{ value: 'all', label: 'Semua Unit Bisnis' }, ...unitOptions]}
                                            className="w-full"
                                            styles={selectStyles}
                                            placeholder="Pilih Unit Bisnis"
                                            isSearchable={false}
                                            menuPortalTarget={document.body}
                                            menuPosition="absolute"
                                        />
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <Select
                                            value={filters.bulan}
                                            onChange={(option) => handleFilterChange('bulan', option)}
                                            options={filterOptions.bulan}
                                            className="w-7/12"
                                            styles={selectStyles}
                                            placeholder="Pilih Bulan"
                                            isSearchable={false}
                                            menuPortalTarget={document.body}
                                            menuPosition="absolute"
                                        />
                                        <Select
                                            value={filters.tahun}
                                            onChange={(option) => handleFilterChange('tahun', option)}
                                            options={yearOptions}
                                            className="w-5/12"
                                            styles={selectStyles}
                                            placeholder="Pilih Tahun"
                                            isSearchable={false}
                                            menuPortalTarget={document.body}
                                            menuPosition="absolute"
                                        />
                                    </div>
                                    <button
                                        onClick={handleExport}
                                        disabled={
                                            (documentType === 'reimbursement' && filteredData.reimbursements.length === 0) ||
                                            (documentType === 'bonSementara' && filteredData.bonSementara.length === 0) ||
                                            (documentType === 'lpj' && filteredData.lpj.length === 0)
                                        }
                                        className="flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded 
                                         hover:bg-red-700 hover:text-gray-200 
                                         disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed 
                                         flex-shrink-0 w-full xl:w-auto"
                                    >
                                        <svg
                                            className="w-4 h-4 mr-2"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                            />
                                        </svg>
                                        Ekspor ke Excel
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {loading ? (
                    <Skeleton count={5} height={40} />
                ) : (
                    <>
                        {documentType === 'reimbursement' && filteredData.reimbursements.length === 0 && (
                            <div className="flex justify-center">
                                <figure className="w-44 h-44">
                                    <img src={EmptyState} alt="empty state icon" className="w-full h-full object-contain" />
                                </figure>
                            </div>
                        )}
                        {documentType === 'bonSementara' && filteredData.bonSementara.length === 0 && (
                            <div className="flex justify-center">
                                <figure className="w-44 h-44">
                                    <img src={EmptyState} alt="empty state icon" className="w-full h-full object-contain" />
                                </figure>
                            </div>
                        )}
                        {documentType === 'lpj' && filteredData.lpj.length === 0 && (
                            <div className="flex justify-center">
                                <figure className="w-44 h-44">
                                    <img src={EmptyState} alt="empty state icon" className="w-full h-full object-contain" />
                                </figure>
                            </div>
                        )}
                        <div className="space-y-8">
                            {/* Reimbursement Table */}
                            {documentType === 'reimbursement' && filteredData.reimbursements.length > 0 && (
                                <div>
                                    <div className="w-full overflow-x-auto">
                                        <div className="inline-block min-w-full">
                                            <table className="min-w-full bg-white border rounded-lg text-sm">
                                                <thead>
                                                    <tr className="bg-gray-100 text-left">
                                                        <th className="p-2 border text-center w-auto">No.</th>
                                                        <th className="px-4 py-2 border">Nomor Dokumen</th>
                                                        <th className="px-4 py-2 border">Nama</th>
                                                        <th className="px-4 py-2 border">Bisnis Unit</th>
                                                        <th className="px-4 py-2 border">Kategori</th>
                                                        <th className="px-4 py-2 border">Total Biaya</th>
                                                        <th className="px-4 py-2 border">Tanggal Pengajuan</th>
                                                        <th className="px-4 py-2 border">Tanggal Disetujui/Dibatalkan</th>
                                                        <th className="px-4 py-2 border">Disetujui/Dibatalkan Oleh</th>
                                                        <th className="p-2 border text-center">Status</th>
                                                        {/* --- PERUBAHAN 3: Tambah kolom Aksi --- */}
                                                        <th className="p-2 border text-center">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {getCurrentPageData().map((item, index) => (
                                                        <tr key={item.id}>
                                                            <td className="p-2 border text-center">
                                                                {index + 1 + (currentPage - 1) * itemsPerPage}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                <Link
                                                                    to={`/reimbursement/${item.id}`}
                                                                    className="text-black hover:text-gray-700 hover:underline cursor-pointer"
                                                                >
                                                                    {item.displayId}
                                                                </Link>
                                                            </td>
                                                            <td className="px-4 py-2 border">{item.user.nama}</td>
                                                            <td className="px-4 py-2 border">{item.user.unit}</td>
                                                            <td className="px-4 py-2 border">{item.kategori}</td>
                                                            <td className="px-4 py-2 border">
                                                                Rp{item.totalBiaya.toLocaleString('id-ID')}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {formatDate(item.tanggalPengajuan)}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {formatDate(item.statusHistory[item.statusHistory.length - 1].timestamp)}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {getApproverName(item.statusHistory)}
                                                            </td>
                                                            <td className="p-2 border text-center">
                                                                <span className={`px-4 py-1 rounded-full text-xs font-medium ${item.status === 'Disetujui'
                                                                    ? 'bg-green-200 text-green-800 border-[1px] border-green-600'
                                                                    : 'bg-gray-300 text-gray-700 border-[1px] border-gray-600'
                                                                    }`}>
                                                                    {item.status}
                                                                </span>
                                                            </td>
                                                            {/* --- PERUBAHAN 4: Tambah tombol Edit dan Hapus --- */}
                                                            <td className="p-2 border text-center">
                                                                <div className="flex justify-center items-center gap-2">
                                                                    {/* Tombol Edit: Arahkan ke halaman edit, misalnya /edit-reimbursement/id */}
                                                                    <Link to={`/edit-reimbursement/${item.id}`} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                                                    </Link>
                                                                    {/* Tombol Hapus: Panggil fungsi handleDelete */}
                                                                    <button onClick={() => handleDelete(item.id, 'reimbursements')} className="text-red-600 hover:text-red-800" title="Hapus">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <PaginationControls
                                        currentPage={currentPage}
                                        totalPages={getTotalPages()}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>
                            )}

                            {/* Bon Sementara Table */}
                            {documentType === 'bonSementara' && filteredData.bonSementara.length > 0 && (
                                <div>
                                    <div className="w-full overflow-x-auto">
                                        <div className="inline-block min-w-full">
                                            <table className="min-w-full bg-white border rounded-lg text-sm">
                                                <thead>
                                                    <tr className="bg-gray-100 text-left">
                                                        <th className="p-2 border text-center w-auto">No.</th>
                                                        <th className="px-4 py-2 border">Nomor BS</th>
                                                        <th className="px-4 py-2 border">Nama</th>
                                                        <th className="px-4 py-2 border">Bisnis Unit</th>
                                                        <th className="px-4 py-2 border">Kategori</th>
                                                        <th className="px-4 py-2 border">Jumlah BS</th>
                                                        <th className="px-4 py-2 border">Tanggal Pengajuan</th>
                                                        <th className="px-4 py-2 border">Tanggal Disetujui/Dibatalkan</th>
                                                        <th className="px-4 py-2 border">Disetujui/Dibatalkan Oleh</th>
                                                        <th className="p-2 border text-center">Status</th>
                                                        <th className="p-2 border text-center">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {getCurrentPageData().map((bs, index) => (
                                                        <tr key={`${bs.id}-${index}`}>
                                                            <td className="p-2 border text-center">
                                                                {index + 1 + (currentPage - 1) * itemsPerPage}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                <Link
                                                                    to={`/bon-sementara/${bs.id}`}
                                                                    className="text-black hover:text-gray-700 hover:underline cursor-pointer"
                                                                >
                                                                    {bs.nomorBS}
                                                                </Link>
                                                            </td>
                                                            <td className="px-4 py-2 border">{bs.user.nama}</td>
                                                            <td className="px-4 py-2 border">{bs.user.unit}</td>
                                                            <td className="px-4 py-2 border">{bs.kategori}</td>
                                                            <td className="px-4 py-2 border">
                                                                Rp{(bs.jumlahBS || 0).toLocaleString('id-ID')}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {formatDate(bs.tanggalPengajuan)}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {formatDate(bs.statusHistory[bs.statusHistory.length - 1].timestamp)}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {getApproverName(bs.statusHistory)}
                                                            </td>
                                                            <td className="p-2 border text-center">
                                                                <span className={`px-4 py-1 rounded-full text-xs font-medium ${bs.status === 'Disetujui'
                                                                    ? 'bg-green-200 text-green-800 border-[1px] border-green-600'
                                                                    : 'bg-gray-300 text-gray-700 border-[1px] border-gray-600'
                                                                    }`}>
                                                                    {bs.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 border text-center">
                                                                <div className="flex justify-center items-center gap-2">
                                                                    <Link to={`/edit-bon-sementara/${bs.id}`} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                                                    </Link>
                                                                    <button onClick={() => handleDelete(bs.id, 'bonSementara')} className="text-red-600 hover:text-red-800" title="Hapus">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <PaginationControls
                                        currentPage={currentPage}
                                        totalPages={getTotalPages()}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>
                            )}

                            {/* LPJ Table */}
                            {documentType === 'lpj' && filteredData.lpj.length > 0 && (
                                <div>
                                    <div className="w-full overflow-x-auto">
                                        <div className="inline-block min-w-full">
                                            <table className="min-w-full bg-white border rounded-lg text-sm">
                                                <thead>
                                                    <tr className="bg-gray-100 text-left">
                                                        <th className="p-2 border text-center w-auto">No.</th>
                                                        <th className="px-4 py-2 border">Nomor Dokumen</th>
                                                        <th className="px-4 py-2 border">Nama</th>
                                                        <th className="px-4 py-2 border">Bisnis Unit</th>
                                                        <th className="px-4 py-2 border">Kategori</th>
                                                        <th className="px-4 py-2 border">Total Biaya</th>
                                                        <th className="px-4 py-2 border">Tanggal Pengajuan</th>
                                                        <th className="px-4 py-2 border">Tanggal Disetujui/Dibatalkan</th>
                                                        <th className="px-4 py-2 border">Disetujui/Dibatalkan Oleh</th>
                                                        <th className="p-2 border text-center">Status</th>
                                                        <th className="p-2 border text-center">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {getCurrentPageData().map((item, index) => (
                                                        <tr key={item.id}>
                                                            <td className="p-2 border text-center">
                                                                {index + 1 + (currentPage - 1) * itemsPerPage}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                <Link
                                                                    to={`/lpj/${item.id}`}
                                                                    className="text-black hover:text-gray-700 hover:underline cursor-pointer"
                                                                >
                                                                    {item.displayId}
                                                                </Link>
                                                            </td>
                                                            <td className="px-4 py-2 border">{item.user.nama}</td>
                                                            <td className="px-4 py-2 border">{item.user.unit}</td>
                                                            <td className="px-4 py-2 border">{item.kategori}</td>
                                                            <td className="px-4 py-2 border">
                                                                Rp{item.totalBiaya.toLocaleString('id-ID')}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {formatDate(item.tanggalPengajuan)}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {formatDate(item.statusHistory[item.statusHistory.length - 1].timestamp)}
                                                            </td>
                                                            <td className="px-4 py-2 border">
                                                                {getApproverName(item.statusHistory)}
                                                            </td>
                                                            <td className="p-2 border text-center">
                                                                <span className={`px-4 py-1 rounded-full text-xs font-medium ${item.status === 'Disetujui'
                                                                    ? 'bg-green-200 text-green-800 border-[1px] border-green-600'
                                                                    : 'bg-gray-300 text-gray-700 border-[1px] border-gray-600'
                                                                    }`}>
                                                                    {item.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 border text-center">
                                                                <div className="flex justify-center items-center gap-2">
                                                                    <Link to={`/edit-lpj/${item.id}`} className="text-blue-600 hover:text-blue-800" title="Edit">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                                                    </Link>
                                                                    <button onClick={() => handleDelete(item.id, 'lpj')} className="text-red-600 hover:text-red-800" title="Hapus">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <PaginationControls
                                        currentPage={currentPage}
                                        totalPages={getTotalPages()}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReportExport;