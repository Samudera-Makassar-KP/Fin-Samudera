import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db } from '../firebaseConfig'
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore'
import Select from 'react-select'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const EditUserForm = () => {
    const navigate = useNavigate()
    const location = useLocation()

    const [formData, setFormData] = useState({
        nama: '',
        email: '',
        password: '',
        posisi: '',
        validator: [],
        reviewer1: [],
        reviewer2: [],
        unit: '',
        role: '',
        department: [],
        bankName: '',
        accountNumber: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [reviewer1Options, setReviewer1Options] = useState([])
    const [reviewer2Options, setReviewer2Options] = useState([])
    const [validatorOptions, setValidatorOptions] = useState([])

    // Options role
    const roleOptions = [
        { value: 'Employee', label: 'Employee' },
        { value: 'Validator', label: 'Validator' },
        { value: 'Reviewer', label: 'Reviewer' },
        { value: 'Admin', label: 'Admin' },
        { value: 'Super Admin', label: 'Super Admin' }
    ]

    // Options unit
    const unitOptions = [
        { value: 'PT Makassar Jaya Samudera', label: 'PT Makassar Jaya Samudera' },
        { value: 'PT Samudera Makassar Logistik', label: 'PT Samudera Makassar Logistik' },
        { value: 'PT Kendari Jaya Samudera', label: 'PT Kendari Jaya Samudera' },
        { value: 'PT Samudera Kendari Logistik', label: 'PT Samudera Kendari Logistik' },
        { value: 'PT Samudera Agencies Indonesia', label: 'PT Samudera Agencies Indonesia' },
        { value: 'PT SILKargo Indonesia', label: 'PT SILKargo Indonesia' },
        { value: 'PT PAD Samudera Perdana', label: 'PT PAD Samudera Perdana' },
        { value: 'PT Masaji Kargosentra Tama', label: 'PT Masaji Kargosentra Tama' }
    ]

    // Options department
    const departmentOptions = [
        { value: 'Operation', label: 'Operation' },
        { value: 'Marketing', label: 'Marketing' },
        { value: 'Finance', label: 'Finance' },
        { value: 'GA/Umum', label: 'GA/Umum' }
    ]

    // Options posisi
    const posisiOptions = [
        { value: 'Staff', label: 'Staff' },
        { value: 'Section Head', label: 'Section Head' },
        { value: 'Department Head', label: 'Department Head' },
        { value: 'General Manager', label: 'General Manager' },
        { value: 'Direktur', label: 'Direktur' }
    ]


    useEffect(() => {
        const getUidFromParams = () => {
            const params = new URLSearchParams(location.search)
            return params.get('uid')
        }

        const fetchUserData = async () => {
            const uid = getUidFromParams() // Ambil UID dari parameter
            if (!uid) {
                console.error('UID not found in URL')
                return
            }

            const docRef = doc(db, 'users', uid) // Gunakan UID sebagai referensi
            try {
                const docSnap = await getDoc(docRef)

                if (docSnap.exists()) {
                    const userData = docSnap.data()
                    setFormData({
                        ...userData,
                        reviewer1: userData.reviewer1 || [],
                        reviewer2: userData.reviewer2 || [],
                        department: userData.department || []
                    })
                } else {
                    console.error('User not found')
                }
            } catch (error) {
                console.error('Error fetching user data:', error)
            }
        }

        fetchUserData()
    }, [location])


    // Mengambil data reviewer dari Firestore
    useEffect(() => {
        const fetchReviewers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users'))
                const reviewerOptions = querySnapshot.docs
                    .map(doc => doc.data())
                    .filter(user =>
                        user.role === 'Reviewer'
                    )
                    .map(user => ({
                        value: user.uid,
                        label: user.nama,
                        uid: user.uid
                    }))

                // Hapus pengguna yang sedang diedit dari opsi reviewer
                const currentUserUid = formData.uid
                const filteredReviewerOptions = reviewerOptions.filter(option => option.value !== currentUserUid)

                setReviewer1Options(filteredReviewerOptions)
                setReviewer2Options(filteredReviewerOptions)

                setFormData(prevFormData => ({
                    ...prevFormData,
                    reviewer1: prevFormData.reviewer1.filter(r => filteredReviewerOptions.some(e => e.value === r)),
                    reviewer2: prevFormData.reviewer2.filter(r => filteredReviewerOptions.some(e => e.value === r)),
                }))
            } catch (error) {
                console.error('Error fetching reviewers:', error)
            }
        }

        if (formData.uid) {
            fetchReviewers()
        }
    }, [formData.uid])

    useEffect(() => {
        const fetchValidators = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users'))
                const validatorOpts = querySnapshot.docs
                    .map(doc => doc.data())
                    .filter(user =>
                        user.role === 'Validator' || user.role === 'Reviewer'
                    )
                    .map(user => ({
                        value: user.uid,
                        label: user.nama,
                        role: user.role,
                        uid: user.uid
                    }))

                // Remove current user from validator options
                const currentUserUid = formData.uid
                const filteredValidatorOptions = validatorOpts.filter(option => option.value !== currentUserUid)

                setValidatorOptions(filteredValidatorOptions)

                // Update formData with validator UIDs
                setFormData(prev => ({
                    ...prev,
                    validator: prev.validator.filter(v => filteredValidatorOptions.some(opt => opt.value === v))
                }))
            } catch (error) {
                console.error('Error fetching validators:', error)
            }
        }

        if (formData.uid) {
            fetchValidators()
        }
    }, [formData.uid])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData({
            ...formData,
            [name]: value
        })
    }

    const handleSelectChange = (selectedOption, field) => {
        if (field === 'role') {
            // When role is changed to Super Admin, reset other fields
            if (selectedOption?.value === 'Super Admin') {
                setFormData({
                    ...formData,
                    role: 'Super Admin',
                    unit: '',
                    posisi: '',
                    department: [],
                    bankName: '',
                    accountNumber: '',
                    validator: [],
                    reviewer1: [],
                    reviewer2: []
                })
                return
            }
        }

        const selectedValues = Array.isArray(selectedOption)
            ? selectedOption.map(option => option.value)
            : selectedOption?.value || ''

        if (field === 'reviewer1' || field === 'reviewer2') {
            // Validasi untuk reviewer1 dan reviewer2
            const currentUserUid = formData.uid

            // Filter untuk memastikan reviewer bukan pengguna yang sedang diedit
            const filteredValues = Array.isArray(selectedValues)
                ? selectedValues.filter(value => value !== currentUserUid)
                : selectedValues

            if (field === 'reviewer2' && !filteredValues.length) {
                setFormData({
                    ...formData,
                    [field]: [] // Izinkan reviewer2 kosong
                })
                return
            }

            setFormData({
                ...formData,
                [field]: filteredValues,
            })
        } else if (field === "department") {
            // Khusus untuk department
            setFormData({
                ...formData,
                [field]: Array.isArray(selectedOption)
                    ? selectedOption.map(option => option.value)
                    : selectedOption?.value || ''
            })
        } else {
            // Default handling untuk field lainnya
            setFormData({
                ...formData,
                [field]: Array.isArray(selectedOption)
                    ? selectedOption.map(option => option.value)
                    : selectedOption?.value || ''
            })
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const getUidFromParams = () => {
                const params = new URLSearchParams(location.search)
                return params.get('uid')
            }

            const uid = getUidFromParams()

            // Validasi untuk memastikan tidak ada field yang kosong selain reviewer2
            let fieldsToValidate = []
            if (formData.role === 'Super Admin') {
                // For Super Admin, only validate these fields
                fieldsToValidate = [
                    { name: 'nama', label: 'Nama' },
                    { name: 'email', label: 'Email' },
                    { name: 'password', label: 'Password' },
                    { name: 'role', label: 'Role' }
                ]
            } else if (formData.role === 'Reviewer') {
                // For Reviewer, exclude reviewer1 validation
                fieldsToValidate = [
                    { name: 'nama', label: 'Nama' },
                    { name: 'email', label: 'Email' },
                    { name: 'password', label: 'Password' },
                    { name: 'posisi', label: 'Posisi' },
                    { name: 'unit', label: 'Unit Bisnis' },
                    { name: 'role', label: 'Role' },
                    { name: 'department', label: 'Department' },
                    { name: 'bankName', label: 'Nama Bank' },
                    { name: 'accountNumber', label: 'Nomor Rekening' }
                ]
            } else {
                // For other roles, validate all fields
                fieldsToValidate = [
                    { name: 'nama', label: 'Nama' },
                    { name: 'email', label: 'Email' },
                    { name: 'password', label: 'Password' },
                    { name: 'posisi', label: 'Posisi' },
                    { name: 'unit', label: 'Unit Bisnis' },
                    { name: 'role', label: 'Role' },
                    { name: 'department', label: 'Department' },
                    { name: 'bankName', label: 'Nama Bank' },
                    { name: 'accountNumber', label: 'Nomor Rekening' },
                    { name: 'reviewer1', label: 'Reviewer 1' },
                    { name: 'reviewer2', label: 'Reviewer 2' },
                    { name: 'validator', label: 'Validator' }
                ]
            }

            for (let field of fieldsToValidate) {
                if (!formData[field.name] || (Array.isArray(formData[field.name]) && formData[field.name].length === 0)) {
                    toast.warning(`${field.label} tidak boleh kosong`)
                    setIsSubmitting(false)
                    return
                }
            }

            // Validasi untuk memastikan reviewer1 dan reviewer2 tidak sama, jika berlaku
            if (formData.reviewer1.length > 0 && formData.reviewer2.length > 0) {
                if (formData.reviewer1.some((r) => formData.reviewer2.includes(r))) {
                    toast.warning('Reviewer 1 dan Reviewer 2 tidak boleh sama')
                    setIsSubmitting(false)
                    return
                }
            }

            // Pemetaan validator dari UID
            const validatorUids = formData.validator.filter(uid => validatorOptions.some(option => option.value === uid))

            // Pemetaan reviewer dari UID
            const reviewer1Uids = formData.reviewer1.filter(uid => reviewer1Options.some(option => option.value === uid))
            const reviewer2Uids = formData.reviewer2.filter(uid => reviewer2Options.some(option => option.value === uid))

            // Update formData dengan UID yang valid
            const updatedFormData = {
                ...formData,
                validator: validatorUids,
                reviewer1: reviewer1Uids,
                reviewer2: reviewer2Uids,
            }

            // Simpan data pengguna ke Firestore
            const userRef = doc(db, 'users', uid)
            await updateDoc(userRef, updatedFormData)

            toast.success('Pengguna berhasil diperbarui')
            setTimeout(() => {
                navigate(-1)
            }, 3500)
        } catch (error) {
            console.error('Error updating user data:', error)
            toast.error('Gagal memperbarui pengguna. Silakan coba lagi')
        } finally {
            setIsSubmitting(false)
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
        multiValue: (base) => ({
            ...base,
            fontSize: '14px',
            flexShrink: 0
        }),
        menuList: (base) => ({
            ...base,
            maxHeight: '160px'
        })
    }

    return (
        <div className="container mx-auto py-10 md:py-8 md:pb-20">
            <h2 className="text-xl font-bold mb-4">Manage Users</h2>

            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-medium mb-4">Ubah Data Pengguna</h3>
                <div className='hidden sm:block'>
                    <div className="sm:grid sm:grid-cols-2 gap-6">
                        <div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Nama Lengkap <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="nama"
                                    value={formData.nama}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            {formData.role !== 'Super Admin' && (
                                <div>
                                    <div className="mb-2">
                                        <label className="block font-medium text-gray-700">
                                            Nama Bank <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="bankName"
                                            value={formData.bankName}
                                            onChange={handleChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="mb-2">
                                        <label className="block font-medium text-gray-700">
                                            Nomor Rekening <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="accountNumber"
                                            value={formData.accountNumber}
                                            onChange={handleChange}
                                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {formData.role !== 'Super Admin' && (
                        <div className="sm:grid sm:grid-cols-2 gap-6">
                            <div>
                                <div className="mb-2">
                                    <label className="block font-medium text-gray-700">
                                        Unit Bisnis <span className="text-red-500">*</span>
                                    </label>
                                    <Select
                                        name="unit"
                                        value={unitOptions.find((option) => option.value === formData.unit)}
                                        onChange={(selectedOption) => handleSelectChange(selectedOption, 'unit')}
                                        options={unitOptions}
                                        className="basic-single-select mt-1 hover:border-blue-400"
                                        classNamePrefix="select"
                                        isClearable
                                        styles={selectStyles}
                                        isSearchable={true}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="block font-medium text-gray-700">
                                        Department <span className="text-red-500">*</span>
                                    </label>
                                    <Select
                                        isMulti
                                        name="department"
                                        value={departmentOptions.filter((option) =>
                                            formData.department?.includes(option.label)
                                        )}
                                        onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'department')}
                                        options={departmentOptions}
                                        className="basic-multi-select mt-1"
                                        classNamePrefix="select"
                                        styles={selectStyles}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="mb-2">
                                    <label className="block font-medium text-gray-700">
                                        Validator {formData.role !== 'Reviewer' && <span className="text-red-500">*</span>}
                                    </label>
                                    <Select
                                        isMulti
                                        name="validator"
                                        value={validatorOptions.filter((option) => formData.validator?.includes(option.value))}
                                        options={validatorOptions}
                                        className="basic-multi-select mt-1"
                                        classNamePrefix="select"
                                        styles={selectStyles}
                                        onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'validator')}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="block font-medium text-gray-700">
                                        Reviewer 1
                                    </label>
                                    <Select
                                        isMulti
                                        name="reviewer1"
                                        value={reviewer1Options.filter((option) =>
                                            formData.reviewer1?.includes(option.value)
                                        )}
                                        onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer1')}
                                        options={reviewer1Options}
                                        className="basic-multi-select mt-1"
                                        classNamePrefix="select"
                                        styles={selectStyles}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="sm:grid sm:grid-cols-2 gap-6">
                        <div>
                            {formData.role !== 'Super Admin' && (
                                <div className="mb-2">
                                    <label className="block font-medium text-gray-700">
                                        Posisi <span className="text-red-500">*</span>
                                    </label>
                                    <Select
                                        name="posisi"
                                        value={posisiOptions.find((option) => option.label === formData.posisi)}
                                        onChange={(selectedOption) => handleSelectChange(selectedOption, 'posisi')}
                                        options={posisiOptions}
                                        className="basic-single-select mt-1 hover:border-blue-400"
                                        classNamePrefix="select"
                                        isClearable
                                        styles={selectStyles}
                                        isSearchable={false}
                                    />
                                </div>
                            )}
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    name="role"
                                    value={roleOptions.find((option) => option.label === formData.role)}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'role')}
                                    options={roleOptions}
                                    className="basic-single-select mt-1 hover:border-blue-400"
                                    classNamePrefix="select"
                                    isClearable
                                    styles={selectStyles}
                                    isSearchable={false}
                                />
                            </div>
                        </div>
                        <div>
                            {formData.role !== 'Super Admin' && (
                                <div className="mb-2">
                                    <label className="block font-medium text-gray-700">
                                        Reviewer 2
                                    </label>
                                    <Select
                                        isMulti
                                        name="reviewer2"
                                        value={reviewer2Options.filter((option) => formData.reviewer2?.includes(option.value))}
                                        onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer2')}
                                        options={reviewer2Options}
                                        className="basic-multi-select mt-1"
                                        classNamePrefix="select"
                                        styles={selectStyles}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile/small screen layout */}
                <div className="block sm:hidden">
                    <div className="mb-2">
                        <label className="block font-medium text-gray-700">
                            Nama Lengkap <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="nama"
                            value={formData.nama}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="mb-2">
                        <label className="block font-medium text-gray-700">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="mb-2">
                        <label className="block font-medium text-gray-700">
                            Role <span className="text-red-500">*</span>
                        </label>
                        <Select
                            name="role"
                            value={roleOptions.find((option) => option.label === formData.role)}
                            onChange={(selectedOption) => handleSelectChange(selectedOption, 'role')}
                            options={roleOptions}
                            className="basic-single-select mt-1 hover:border-blue-400"
                            classNamePrefix="select"
                            isClearable
                            styles={selectStyles}
                            isSearchable={false}
                        />
                    </div>
                    {formData.role !== 'Super Admin' && (
                        <div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Posisi <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    name="posisi"
                                    options={posisiOptions}
                                    value={posisiOptions.find(option => option.value === formData.posisi)}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'posisi')}
                                    className="basic-single-select mt-1 hover:border-blue-400"
                                    classNamePrefix="select"
                                    styles={selectStyles}
                                    isSearchable={false}
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Department <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    isMulti
                                    name="department"
                                    options={departmentOptions}
                                    value={departmentOptions.filter(option => formData.department.includes(option.value))}
                                    onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'department')}
                                    className="basic-multi-select mt-1"
                                    classNamePrefix="select"
                                    styles={selectStyles}
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Unit Bisnis <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    name="unit"
                                    options={unitOptions}
                                    value={unitOptions.find(option => option.value === formData.unit)}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'unit')}
                                    className="basic-single-select mt-1 hover:border-blue-400"
                                    classNamePrefix="select"
                                    styles={selectStyles}
                                    isSearchable={true}
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Nama Bank <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Nomor Rekening <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="accountNumber"
                                    value={formData.accountNumber}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 hover:border-blue-400 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Validator {formData.role !== 'Reviewer' && <span className="text-red-500">*</span>}
                                </label>
                                <Select
                                    isMulti
                                    name="validator"
                                    value={validatorOptions.filter((option) => formData.validator?.includes(option.value))}
                                    options={validatorOptions}
                                    className="basic-multi-select mt-1"
                                    classNamePrefix="select"
                                    styles={selectStyles}
                                    onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'validator')}
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Reviewer 1
                                </label>
                                <Select
                                    isMulti
                                    name="reviewer1"
                                    value={reviewer1Options.filter((option) =>
                                        formData.reviewer1?.includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer1')}
                                    options={reviewer1Options}
                                    className="mt-1"
                                    styles={selectStyles}
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block font-medium text-gray-700">
                                    Reviewer 2
                                </label>
                                <Select
                                    isMulti
                                    name="reviewer2"
                                    value={reviewer2Options.filter((option) => formData.reviewer2?.includes(option.value))}
                                    onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer2')}
                                    options={reviewer2Options}
                                    className="mt-1"
                                    styles={selectStyles}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-end mt-6 gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-16 py-3 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 hover:text-gray-700 w-full sm:w-auto"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-16 py-3 bg-red-600 text-white rounded hover:bg-red-700 hover:text-gray-200 w-full sm:w-auto"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default EditUserForm
