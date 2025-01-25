import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebaseConfig'
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore'
import Select from 'react-select'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const AddUserForm = () => {
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        nama: '',
        email: '',
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
    const [reviewerOptions, setReviewerOptions] = useState([])
    const [validatorOptions, setValidatorOptions] = useState([])

    // Fetch reviewers from Firestore
    const fetchReviewers = async () => {
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'Reviewer'))
            const querySnapshot = await getDocs(q)

            const reviewers = querySnapshot.docs.map((doc) => ({
                value: doc.data().nama,
                label: doc.data().nama,
                uid: doc.data().uid
            }))

            setReviewerOptions(reviewers)
        } catch (error) {
            console.error('Error fetching reviewer options:', error)
        }
    }

    // Fetch validators from Firestore
    const fetchValidators = async () => {
        try {
            const q = query(collection(db, 'users'),
                where('role', 'in', ['Validator', 'Reviewer']))
            const querySnapshot = await getDocs(q)

            const validators = querySnapshot.docs.map((doc) => ({
                value: doc.data().nama,
                label: doc.data().nama,
                uid: doc.data().uid
            }))

            setValidatorOptions(validators)
        } catch (error) {
            console.error('Error fetching validator options:', error)
        }
    }

    useEffect(() => {
        fetchReviewers()
        fetchValidators()
    }, [])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData({
            ...formData,
            [name]: value
        })
    }

    const handleSelectChange = (selectedOption, field) => {
        if (field === 'role' && selectedOption?.value === 'Super Admin') {
            setFormData({
                ...formData,
                role: 'Super Admin',
                unit: '',
                posisi: '',
                department: [],
                bankName: '',
                accountNumber: '',
                reviewer1: [],
                reviewer2: [],
                validator: [],
                [field]: selectedOption.value
            })
        } else if (field === 'department') {
            setFormData({
                ...formData,
                [field]: Array.isArray(selectedOption)
                    ? selectedOption.map((option) => option.value)
                    : selectedOption?.value || ''
            })
        } else {
            setFormData({
                ...formData,
                [field]: Array.isArray(selectedOption)
                    ? selectedOption.map((option) => option.uid)
                    : selectedOption?.value || ''
            })
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const missingFields = [];
            let fieldsToValidate = [];

            if (formData.role === 'Super Admin') {
                fieldsToValidate = [
                    { name: 'nama', label: 'Nama' },
                    { name: 'email', label: 'Email' },
                    { name: 'role', label: 'Role' }
                ];
            } else if (formData.role === 'Reviewer') {
                fieldsToValidate = [
                    { name: 'nama', label: 'Nama' },
                    { name: 'email', label: 'Email' },
                    { name: 'posisi', label: 'Posisi' },
                    { name: 'unit', label: 'Unit Bisnis' },
                    { name: 'role', label: 'Role' },
                    { name: 'department', label: 'Department' },
                    { name: 'bankName', label: 'Nama Bank' },
                    { name: 'accountNumber', label: 'Nomor Rekening' }
                ];
            } else {
                fieldsToValidate = [
                    { name: 'nama', label: 'Nama' },
                    { name: 'email', label: 'Email' },
                    { name: 'posisi', label: 'Posisi' },
                    { name: 'unit', label: 'Unit Bisnis' },
                    { name: 'role', label: 'Role' },
                    { name: 'department', label: 'Department' },
                    { name: 'bankName', label: 'Nama Bank' },
                    { name: 'accountNumber', label: 'Nomor Rekening' },
                    { name: 'reviewer1', label: 'Reviewer 1' },
                    { name: 'reviewer2', label: 'Reviewer 2' },
                    { name: 'validator', label: 'Validator' }
                ];
            }

            for (let field of fieldsToValidate) {
                if (!formData[field.name] || (Array.isArray(formData[field.name]) && formData[field.name].length === 0)) {
                    missingFields.push(field.label);
                }
            }

            if (missingFields.length > 0) {
                console.warn('Field yang tidak diisi:', missingFields);
                missingFields.forEach((field) => {
                    toast.warning(
                        <>
                            <b>{field}</b> tidak boleh kosong
                        </>
                    );
                });
                setIsSubmitting(false);
                return;
            }

            // Validasi reviewer1 dan reviewer2 tidak boleh sama
            if (formData.reviewer1?.length > 0 && formData.reviewer2?.length > 0) {
                if (formData.reviewer1.some((r) => formData.reviewer2.includes(r))) {
                    console.warn('Reviewer 1 dan Reviewer 2 sama');
                    toast.warning('Reviewer 1 dan Reviewer 2 tidak boleh sama');
                    setIsSubmitting(false);
                    return;
                }
            }

            try {
                // Password default untuk semua user
                const defaultPassword = 'QWERTY123';

                // Membuat user menggunakan email dan password
                const userCredential = await createUserWithEmailAndPassword(auth, formData.email, defaultPassword);
                const firebaseUser = userCredential.user;

                // Menyimpan data pengguna ke Firestore
                const uid = firebaseUser.uid;
                await setDoc(doc(db, 'users', uid), {
                    uid,
                    nama: formData.nama,
                    email: formData.email,
                    role: formData.role,
                    posisi: formData.role === 'Super Admin' ? '' : formData.posisi,
                    unit: formData.role === 'Super Admin' ? '' : formData.unit,
                    department: formData.role === 'Super Admin' ? [] : formData.department,
                    bankName: formData.role === 'Super Admin' ? '' : formData.bankName,
                    accountNumber: formData.role === 'Super Admin' ? '' : formData.accountNumber,
                    reviewer1: formData.role === 'Super Admin' ? [] : formData.reviewer1,
                    reviewer2: formData.role === 'Super Admin' ? [] : formData.reviewer2,
                    validator: formData.role === 'Super Admin' ? [] : formData.validator,
                });

                toast.success('Pengguna berhasil ditambahkan');

                // Reset form setelah submit
                setFormData({
                    nama: '',
                    email: '',
                    posisi: '',
                    unit: '',
                    role: '',
                    department: [],
                    bankName: '',
                    accountNumber: '',
                    reviewer1: [],
                    reviewer2: [],
                    validator: []
                });

                setTimeout(() => {
                    navigate(-1)
                }, 3500)
            } catch (firebaseError) {
                console.error('Detailed Firebase Error:', firebaseError);

                // More specific error messages
                if (firebaseError.code === 'auth/email-already-in-use') {
                    toast.error('Email sudah terdaftar. Gunakan email lain.');
                } else if (firebaseError.code === 'auth/invalid-email') {
                    toast.error('Format email tidak valid.');
                } else if (firebaseError.code === 'auth/operation-not-allowed') {
                    toast.error('Operasi tidak diizinkan. Periksa pengaturan Firebase.');
                } else if (firebaseError.code === 'auth/weak-password') {
                    toast.error('Password terlalu lemah.');
                } else {
                    toast.error(`Gagal menambahkan pengguna: ${firebaseError.message}`);
                }
            }
        } catch (error) {
            console.error('Error terjadi saat proses submit:', error);
            toast.error('Gagal menambahkan pengguna. Silakan coba lagi');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                <h3 className="text-xl font-medium mb-4">Tambah Pengguna</h3>
                <form onSubmit={handleSubmit}>
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
                        {formData.role !== 'Super Admin' && (
                            <div className="sm:grid sm:grid-cols-2 gap-6">
                                <div>
                                    <div className="mb-2">
                                        <label className="block font-medium text-gray-700">
                                            Unit Bisnis <span className="text-red-500">*</span>
                                        </label>
                                        <Select
                                            name="unit"
                                            options={unitOptions}
                                            className="basic-single-select mt-1 hover:border-blue-400"
                                            classNamePrefix="select"
                                            onChange={(selectedOption) => handleSelectChange(selectedOption, 'unit')}
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
                                            options={departmentOptions}
                                            className="basic-multi-select mt-1"
                                            classNamePrefix="select"
                                            styles={selectStyles}
                                            onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'department')}
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
                                            options={reviewerOptions}
                                            className="basic-multi-select mt-1"
                                            classNamePrefix="select"
                                            styles={selectStyles}
                                            onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer1')}
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
                                            options={posisiOptions}
                                            className="basic-single-select mt-1 hover:border-blue-400"
                                            classNamePrefix="select"
                                            onChange={(selectedOption) => handleSelectChange(selectedOption, 'posisi')}
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
                                        options={roleOptions}
                                        className="basic-single-select mt-1 hover:border-blue-400"
                                        classNamePrefix="select"
                                        onChange={(selectedOption) => handleSelectChange(selectedOption, 'role')}
                                        isMulti={false}
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
                                            options={reviewerOptions}
                                            className="basic-multi-select mt-1"
                                            classNamePrefix="select"
                                            styles={selectStyles}
                                            onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer2')}
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
                                options={roleOptions}
                                className="basic-single-select mt-1 hover:border-blue-400"
                                classNamePrefix="select"
                                onChange={(selectedOption) => handleSelectChange(selectedOption, 'role')}
                                isMulti={false}
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
                                        options={reviewerOptions}
                                        className="basic-multi-select mt-1"
                                        classNamePrefix="select"
                                        styles={selectStyles}
                                        onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer1')}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="block font-medium text-gray-700">
                                        Reviewer 2
                                    </label>
                                    <Select
                                        isMulti
                                        name="reviewer2"
                                        options={reviewerOptions}
                                        className="basic-multi-select mt-1"
                                        classNamePrefix="select"
                                        styles={selectStyles}
                                        onChange={(selectedOptions) => handleSelectChange(selectedOptions, 'reviewer2')}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end mt-6 gap-4">
                        <button onClick={() => navigate(-1)} className="px-16 py-3 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 hover:text-gray-700 w-full sm:w-auto" disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className="px-16 py-3 bg-red-600 text-white rounded hover:bg-red-700 hover:text-gray-200 w-full sm:w-auto" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AddUserForm
