import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../firebaseConfig'
import { collection, getDocs } from 'firebase/firestore'
import Select from 'react-select'
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const ManageUser = () => {
    const [users, setUsers] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [filters, setFilters] = useState({
        posisi: '',
        unit: '',
        role: '',
        department: ''
    })
    const itemsPerPage = 10 // Jumlah item per halaman
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)

    const filterOptions = {
        posisi: [
            { value: 'Staff', label: 'Staff' },
            { value: 'Section Head', label: 'Section Head' },
            { value: 'Department Head', label: 'Department Head' },
            { value: 'General Manager', label: 'General Manager' },
            { value: 'Direktur', label: 'Direktur' }
        ],
        unit: [
            { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
            { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
            { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
            { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
            { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
            { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
            { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
            { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' },
            { value: 'Samudera', label: 'Samudera' },
        ],
        department: [
            { value: 'Operation', label: 'Operation' },
            { value: 'Marketing', label: 'Marketing' },
            { value: 'Finance', label: 'Finance' },
            { value: 'GA/Umum', label: 'GA/Umum' },
            { value: 'HC', label: 'HC' },
            { value: 'QHSE', label: 'QHSE' },
            { value: 'VMS', label: 'VMS' },
            { value: 'IT', label: 'IT' },
            { value: 'Panitia', label: 'Panitia' },
        ],
        role: [
            { value: 'Employee', label: 'Employee' },
            { value: 'Validator', label: 'Validator' },
            { value: 'Reviewer', label: 'Reviewer' },
            { value: 'Admin', label: 'Admin' },
            { value: 'Super Admin', label: 'Super Admin' }
        ]
    }

    // Fungsi untuk mengambil data dari Firestore
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true)
            try {
                const querySnapshot = await getDocs(collection(db, 'users'))
                const usersData = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }))

                const sortedUsers = usersData.sort((a, b) => {
                    return (a.nama || '').localeCompare(b.nama || '')
                })
                setUsers(sortedUsers)
            } catch (error) {
                console.error("Error fetching users:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchUsers()
    }, [])

    const handleEdit = (uid) => {
        navigate(`/manage-users/edit?uid=${uid}`)
    }

    // Fungsi untuk menangani input pencarian
    const handleSearch = (event) => {
        setSearchTerm(event.target.value)
        setCurrentPage(1) // Reset ke halaman pertama saat melakukan pencarian
    }

    const handleFilterChange = (field, selectedOption) => {
        setFilters((prev) => ({
            ...prev,
            [field]: selectedOption
        }))
        setCurrentPage(1)
    }

    const resetFilters = () => {
        setFilters({
            posisi: '',
            unit: '',
            role: '',
            department: ''
        })
        setSearchTerm('')
        setCurrentPage(1)
    }

    // Filter data pengguna berdasarkan nilai pencarian dan filter
    const filteredUsers = users.filter((user) => {
        const searchTermLower = searchTerm.toLowerCase()
        const matchesSearch =
            user.nama?.toLowerCase().includes(searchTermLower) || user.email?.toLowerCase().includes(searchTermLower)

        const matchesFilters = Object.entries(filters).every(([field, selectedOption]) => {
            if (!selectedOption) return true
            if (field === 'department' && Array.isArray(user[field])) {
                return user[field].includes(selectedOption.value)
            }
            return user[field] === selectedOption.value
        })
        return matchesSearch && matchesFilters
        // // Menyaring pengguna dengan role 'Super Admin' agar tidak ditampilkan
        // return matchesSearch && matchesFilters && user.role !== 'Super Admin'
    })

    // Menghitung total halaman
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)

    // Mendapatkan data pengguna untuk halaman saat ini
    const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    // Fungsi untuk berpindah ke halaman berikutnya
    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1)
        }
    }

    // Fungsi untuk berpindah ke halaman sebelumnya
    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1)
        }
    }

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

    const FilterSelect = ({ field, label }) => (
        <Select
            value={filters[field]}
            onChange={(option) => handleFilterChange(field, option)}
            options={filterOptions[field]}
            placeholder={label}
            isClearable
            className="w-full"
            styles={selectStyles}
            isSearchable={false}
            menuPortalTarget={document.body}
            menuPosition="absolute"
        />
    )

    return (
        <div className="container mx-auto py-10 md:py-8">
            <h2 className="text-xl font-bold mb-4">Manage Users</h2>

            <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
                <h3 className="text-xl font-medium mb-4">Daftar Pengguna</h3>

                {/* Desktop Layout */}
                <div className="hidden xl:flex text-sm items-center gap-2 mb-4">
                    {loading ? (
                        <>
                            <div className="flex-1"><Skeleton height={32} width={190} /></div>
                            <div className="w-full"><Skeleton height={32} /></div>
                            <div className="w-full"><Skeleton height={32} /></div>
                            <div className="w-full"><Skeleton height={32} /></div>
                            <div className="w-full"><Skeleton height={32} /></div>
                            <div className="w-full"><Skeleton height={32} /></div>
                            <div className="w-full"><Skeleton height={32} /></div>
                        </>
                    ) : (
                        <>
                            <input
                                type="text"
                                placeholder="Cari pengguna..."
                                value={searchTerm}
                                onChange={handleSearch}
                                className="flex-1 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            />
                            <FilterSelect field="posisi" label="Posisi" />
                            <FilterSelect field="unit" label="Unit Bisnis" />
                            <FilterSelect field="role" label="Role" />
                            <FilterSelect field="department" label="Department" />

                            <button
                                onClick={resetFilters}
                                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex-none"
                            >
                                Reset Filter
                            </button>
                            <Link to="/manage-users/add">
                                <button className="px-8 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 hover:text-gray-200 w-max">
                                    Tambah Data
                                </button>
                            </Link>
                        </>
                    )}
                </div>

                {/* Tablet Layout */}
                <div className="hidden sm:flex xl:hidden flex-col gap-4">
                    {loading ? (
                        <>
                            <div className="flex flex-row items-start gap-2">
                                <div className="flex-1">
                                    <Skeleton height={32} />
                                </div>
                                <div className="flex flex-row gap-2">
                                    <div><Skeleton height={32} width={120} /></div>
                                    <div><Skeleton height={32} width={120} /></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 w-full mb-4">
                                <div className="w-full"><Skeleton height={32} /></div>
                                <div className="w-full"><Skeleton height={32} /></div>
                                <div className="w-full"><Skeleton height={32} /></div>
                                <div className="w-full"><Skeleton height={32} /></div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-row items-start gap-4">
                                <input
                                    type="text"
                                    placeholder="Cari pengguna..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    className="flex-1 px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                />

                                <div className="flex flex-row gap-2">
                                    <button
                                        onClick={resetFilters}
                                        className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                    >
                                        Reset Filter
                                    </button>

                                    <Link to="/manage-users/add">
                                        <button className="px-8 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 hover:text-gray-200">
                                            Tambah Data
                                        </button>
                                    </Link>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 w-full mb-4">
                                <FilterSelect field="posisi" label="Posisi" />
                                <FilterSelect field="unit" label="Unit Bisnis" />
                                <FilterSelect field="role" label="Role" />
                                <FilterSelect field="department" label="Department" />
                            </div>
                        </>
                    )}
                </div>

                {/* Mobile Layout */}
                <div className="flex sm:hidden flex-col gap-4">
                    {loading ? (
                        <>
                            <div className="flex flex-col gap-4">
                                <div>
                                    <Skeleton height={32} />
                                </div>

                                <div className="flex flex-col gap-4">
                                    <div>
                                        <Skeleton height={32} />
                                    </div>

                                    <div>
                                        <Skeleton height={32} />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 w-full mb-4">
                                <div className="w-full"><Skeleton height={32} /></div>
                                <div className="w-full"><Skeleton height={32} /></div>
                                <div className="w-full"><Skeleton height={32} /></div>
                                <div className="w-full"><Skeleton height={32} /></div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col gap-4">
                                <input
                                    type="text"
                                    placeholder="Cari pengguna..."
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    className="w-full px-4 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-xs"
                                />

                                <div className="flex flex-col gap-4">
                                    <Link to="/manage-users/add" className="w-full">
                                        <button className="w-full px-8 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 hover:text-gray-200">
                                            Tambah Data
                                        </button>
                                    </Link>

                                    <button
                                        onClick={resetFilters}
                                        className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                    >
                                        Reset Filter
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 w-full mb-4">
                                <FilterSelect field="posisi" label="Posisi" />
                                <FilterSelect field="unit" label="Unit Bisnis" />
                                <FilterSelect field="role" label="Role" />
                                <FilterSelect field="department" label="Department" />
                            </div>
                        </>
                    )}

                    
                </div>

                {loading ? (
                    <Skeleton count={5} height={40} />
                ) : (
                    <>
                        <div className="w-full">
                            <div className="w-full overflow-x-auto">
                                <div className="inline-block min-w-[1000px] w-full">
                                    <table className="min-w-full bg-white border rounded-lg text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 text-left">
                                                <th className="px-2 py-2 border text-center w-auto">No.</th>
                                                <th className="px-4 py-2 border break-words">Nama</th>
                                                <th className="px-4 py-2 border break-words">Email</th>
                                                <th className="px-4 py-2 border break-words">Posisi</th>
                                                <th className="px-4 py-2 border break-words">Unit Bisnis</th>
                                                <th className="px-4 py-2 border break-words">Role</th>
                                                <th className="px-4 py-2 border break-words">Department</th>
                                                <th className="px-2 py-2 border text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentUsers.map((user, index) => (
                                                <tr key={user.id}>
                                                    <td className="px-2 py-2 border text-center w-auto">
                                                        {index + 1 + (currentPage - 1) * itemsPerPage}
                                                    </td>
                                                    <td className="px-4 py-2 border">{user.nama}</td>
                                                    <td className="px-4 py-2 border">{user.email}</td>
                                                    <td className="px-4 py-2 border">{user.posisi}</td>
                                                    <td className="px-4 py-2 border">{user.unit}</td>
                                                    <td className="px-4 py-2 border">{user.role}</td>
                                                    <td className="px-4 py-2 border">
                                                        {Array.isArray(user.department)
                                                            ? user.department.join(', ')
                                                            : user.department}
                                                    </td>
                                                    <td className="px-2 py-2 border text-center">
                                                        <div className="flex justify-center space-x-2">
                                                            <button
                                                                onClick={() => handleEdit(user.uid)}
                                                                className="flex items-center justify-center rounded-full p-1 bg-green-200 hover:bg-green-300 text-green-600 border-[1px] border-green-600"
                                                                title="Edit"
                                                            >
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 20 20"
                                                                    fill="currentColor"
                                                                    className="size-5"
                                                                >
                                                                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                                                                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
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
                    </>
                )}
                {/* Pagination Controls dengan Ellipsis - Mobile Friendly */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-6 text-xs">
                        {/* Tombol Previous */}
                        <button
                            onClick={prevPage}
                            disabled={currentPage === 1}
                            className={`flex items-center px-2 h-9 rounded-full ${
                                currentPage === 1
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

                        {/* Tombol Halaman dengan Ellipsis */}
                        {(() => {
                            let pages = []
                            // Mengurangi jumlah halaman yang ditampilkan di mobile
                            const visiblePages = window.innerWidth < 640 ? 1 : 3

                            // Selalu tampilkan halaman pertama
                            pages.push(
                                <button
                                    key={1}
                                    onClick={() => setCurrentPage(1)}
                                    className={`min-w-[36px] h-9 rounded-full ${
                                        currentPage === 1
                                            ? 'bg-red-600 text-white'
                                            : 'border border-red-600 text-red-600 hover:bg-red-100'
                                    }`}
                                >
                                    1
                                </button>
                            )

                            if (totalPages <= visiblePages + 2) {
                                // Jika total halaman sedikit, tampilkan semua
                                for (let i = 2; i <= totalPages; i++) {
                                    pages.push(
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i)}
                                            className={`min-w-[36px] h-9 rounded-full ${
                                                currentPage === i
                                                    ? 'bg-red-600 text-white'
                                                    : 'border border-red-600 text-red-600 hover:bg-red-100'
                                            }`}
                                        >
                                            {i}
                                        </button>
                                    )
                                }
                            } else {
                                // Logika untuk mobile view
                                if (window.innerWidth < 640) {
                                    // Jika current page bukan di awal atau akhir, tampilkan ellipsis di kedua sisi
                                    if (currentPage > 2 && currentPage < totalPages - 1) {
                                        pages.push(
                                            <span key="ellipsis1" className="px-1">
                                                ...
                                            </span>
                                        )
                                        pages.push(
                                            <button
                                                key={currentPage}
                                                onClick={() => setCurrentPage(currentPage)}
                                                className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                            >
                                                {currentPage}
                                            </button>
                                        )
                                        pages.push(
                                            <span key="ellipsis2" className="px-1">
                                                ...
                                            </span>
                                        )
                                    } else if (currentPage <= 2) {
                                        // Tampilkan halaman 2 jika current page di awal
                                        if (currentPage === 2) {
                                            pages.push(
                                                <button
                                                    key={2}
                                                    onClick={() => setCurrentPage(2)}
                                                    className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                                >
                                                    2
                                                </button>
                                            )
                                        }
                                        pages.push(
                                            <span key="ellipsis1" className="px-1">
                                                ...
                                            </span>
                                        )
                                    } else {
                                        // Tampilkan ellipsis dan halaman sebelum terakhir jika di akhir
                                        pages.push(
                                            <span key="ellipsis1" className="px-1">
                                                ...
                                            </span>
                                        )
                                        if (currentPage === totalPages - 1) {
                                            pages.push(
                                                <button
                                                    key={totalPages - 1}
                                                    onClick={() => setCurrentPage(totalPages - 1)}
                                                    className="min-w-[36px] h-9 rounded-full bg-red-600 text-white"
                                                >
                                                    {totalPages - 1}
                                                </button>
                                            )
                                        }
                                    }
                                } else {
                                    // Desktop view logic
                                    if (currentPage <= visiblePages) {
                                        for (let i = 2; i <= visiblePages; i++) {
                                            pages.push(
                                                <button
                                                    key={i}
                                                    onClick={() => setCurrentPage(i)}
                                                    className={`min-w-[36px] h-9 rounded-full ${
                                                        currentPage === i
                                                            ? 'bg-red-600 text-white'
                                                            : 'border border-red-600 text-red-600 hover:bg-red-100'
                                                    }`}
                                                >
                                                    {i}
                                                </button>
                                            )
                                        }
                                        pages.push(
                                            <span key="ellipsis1" className="px-1">
                                                ...
                                            </span>
                                        )
                                    } else if (currentPage > totalPages - visiblePages) {
                                        pages.push(
                                            <span key="ellipsis1" className="px-1">
                                                ...
                                            </span>
                                        )
                                        for (let i = totalPages - visiblePages + 1; i < totalPages; i++) {
                                            pages.push(
                                                <button
                                                    key={i}
                                                    onClick={() => setCurrentPage(i)}
                                                    className={`min-w-[36px] h-9 rounded-full ${
                                                        currentPage === i
                                                            ? 'bg-red-600 text-white'
                                                            : 'border border-red-600 text-red-600 hover:bg-red-100'
                                                    }`}
                                                >
                                                    {i}
                                                </button>
                                            )
                                        }
                                    } else {
                                        pages.push(
                                            <span key="ellipsis1" className="px-1">
                                                ...
                                            </span>
                                        )
                                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                            if (i > 1 && i < totalPages) {
                                                pages.push(
                                                    <button
                                                        key={i}
                                                        onClick={() => setCurrentPage(i)}
                                                        className={`min-w-[36px] h-9 rounded-full ${
                                                            currentPage === i
                                                                ? 'bg-red-600 text-white'
                                                                : 'border border-red-600 text-red-600 hover:bg-red-100'
                                                        }`}
                                                    >
                                                        {i}
                                                    </button>
                                                )
                                            }
                                        }
                                        pages.push(
                                            <span key="ellipsis2" className="px-1">
                                                ...
                                            </span>
                                        )
                                    }
                                }

                                // Selalu tampilkan halaman terakhir
                                if (totalPages > 1) {
                                    pages.push(
                                        <button
                                            key={totalPages}
                                            onClick={() => setCurrentPage(totalPages)}
                                            className={`min-w-[36px] h-9 rounded-full ${
                                                currentPage === totalPages
                                                    ? 'bg-red-600 text-white'
                                                    : 'border border-red-600 text-red-600 hover:bg-red-100'
                                            }`}
                                        >
                                            {totalPages}
                                        </button>
                                    )
                                }
                            }

                            return pages
                        })()}

                        {/* Tombol Next */}
                        <button
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                            className={`flex items-center px-2 h-9 rounded-full ${
                                currentPage === totalPages
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
                )}
            </div>
        </div>
    )
}

export default ManageUser
