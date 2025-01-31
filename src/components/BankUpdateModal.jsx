import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const BankUpdateModal = ({ isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        bankName: '',
        accountNumber: ''
    });
    const [initialData, setInitialData] = useState({
        bankName: '',
        accountNumber: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setError('');
            setSuccess('');
            setFormData({ bankName: '', accountNumber: '' });
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            fetchAccountInfo();
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const fetchAccountInfo = async () => {
        try {
            const auth = getAuth();
            const uid = auth.currentUser?.uid;

            if (uid) {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const data = {
                        bankName: userData.bankName || '',
                        accountNumber: userData.accountNumber || ''
                    };
                    setFormData(data);
                    setInitialData(data);
                }
            }
        } catch (error) {
            console.error('Error fetching account info:', error);
            setError('Gagal mengambil informasi rekening');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
        setSuccess('');
    };

    const hasChanges = () => {
        return formData.bankName.trim() !== initialData.bankName.trim() ||
               formData.accountNumber.trim() !== initialData.accountNumber.trim();
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
        if (!hasChanges()) {
            setError('Tidak ada perubahan pada informasi rekening');
            return false;
        }
        return true;
    };

    const handleAccountUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

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

            const updates = {};
            
            if (formData.bankName.trim() !== initialData.bankName.trim()) {
                updates.bankName = formData.bankName.trim();
            }
            if (formData.accountNumber.trim() !== initialData.accountNumber.trim()) {
                updates.accountNumber = formData.accountNumber.trim();
            }

            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, updates);

            setSuccess('Informasi rekening berhasil diperbarui');
            setInitialData(formData);
            
            setTimeout(onClose, 3000);
        } catch (error) {
            console.error('Error updating account info:', error);
            setError('Gagal memperbarui informasi rekening');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-lg p-4 lg:p-6 max-w-md w-full mx-4 relative sm:landscape:scale-[0.85] sm:landscape:transform">
                <div className="flex items-center justify-between w-full mb-2">
                    <h2 className="text-lg md:text-xl font-semibold">
                        Perbarui Informasi Rekening
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 text-4xl"
                    >
                        &times;
                    </button>
                </div>

                {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
                {success && <div className="bg-green-100 text-green-700 p-2 rounded mb-4">{success}</div>}

                <form onSubmit={handleAccountUpdate}>
                    <div className="mb-4 relative">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Nama Bank</label>
                        <div className='relative'>
                            <input
                                type="text"
                                name="bankName"
                                value={formData.bankName}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                placeholder="Masukkan nama bank"
                                required
                            />
                        </div>
                    </div>
                    <div className="mb-4 relative">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Nomor Rekening</label>
                        <div className='relative'>
                            <input
                                type="text"
                                name="accountNumber"
                                value={formData.accountNumber}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                placeholder="Masukkan nomor rekening"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className={`${
                                !hasChanges() 
                                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700 text-white hover:text-gray-200'
                            } px-6 py-3 rounded-md text-sm md:text-sm transition-colors`}
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
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BankUpdateModal;