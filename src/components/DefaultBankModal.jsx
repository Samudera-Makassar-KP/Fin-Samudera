import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const DEFAULT_BANK = {
    bankName: 'ABC',
    accountNumber: '123'
};

const DefaultBankModal = ({ isOpen, onUpdate, initialData }) => {
    const [formData, setFormData] = useState({
        bankName: DEFAULT_BANK.bankName,
        accountNumber: DEFAULT_BANK.accountNumber
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Update form data when initialData changes
        if (initialData) {
            setFormData({
                bankName: initialData.bankName || DEFAULT_BANK.bankName,
                accountNumber: initialData.accountNumber || DEFAULT_BANK.accountNumber
            });
        }
    }, [initialData]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.position = '';
            document.body.style.width = '';
        }
    
        return () => {
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, [isOpen]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const hasChanges = () => {
        return formData.bankName.trim() !== 'ABC' && formData.accountNumber.trim() !== '123'
    };

    const validateForm = () => {
        if (!formData.bankName.trim()) {
            setError('Nama bank harus diisi');
            return false;
        }
        if (!formData.accountNumber.trim()) {
            setError('Nomor rekening harus diisi');
            return false;
        }
        // Tambahan validasi untuk memastikan tidak menggunakan nilai default
        if (formData.bankName.trim() === DEFAULT_BANK.bankName &&
            formData.accountNumber.trim() === DEFAULT_BANK.accountNumber) {
            setError('Mohon gunakan informasi rekening yang valid, bukan nilai default');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const auth = getAuth();
            const uid = auth.currentUser?.uid;

            if (!uid) {
                setError('Pengguna tidak terautentikasi');
                return;
            }

            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                bankName: formData.bankName.trim(),
                accountNumber: formData.accountNumber.trim()
            });

            onUpdate();
        } catch (error) {
            console.error('Error updating bank info:', error);
            setError('Gagal memperbarui informasi rekening');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative sm:landscape:scale-[0.85] sm:landscape:transform">
                <div className="flex items-center mb-4">
                    <div className="w-6 h-6 mr-2 text-red-500 flex items-center justify-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            className="w-6 h-6"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold">Perbarui Informasi Rekening</h2>
                </div>

                <p className="text-gray-600 mb-4">
                    Anda masih menggunakan informasi rekening default. Harap perbarui untuk melanjutkan penggunaan aplikasi.
                </p>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nama Bank
                        </label>
                        <input
                            type="text"
                            name="bankName"
                            value={formData.bankName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Masukkan nama bank"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nomor Rekening
                        </label>
                        <input
                            type="text"
                            name="accountNumber"
                            value={formData.accountNumber}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Masukkan nomor rekening"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className={`${!hasChanges()
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700 text-white hover:text-gray-200'
                            } w-full px-4 py-2 md:px-6 md:py-3 rounded-md text-sm md:text-sm transition-colors`}
                        disabled={isLoading || !hasChanges()}
                    >
                        {isLoading ? (
                            <>
                                <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            'Perbarui Informasi'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default DefaultBankModal;