import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const BankUpdateModal = ({ isOpen, onClose }) => {
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [initialBankName, setInitialBankName] = useState(''); 
    const [initialAccountNumber, setInitialAccountNumber] = useState(''); 
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!isOpen) {
            setError('');
            setSuccess('');
            setBankName('');
            setAccountNumber('');
        }
    }, [isOpen]);
    
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);
    
    useEffect(() => {
        const fetchAccountInfo = async () => {
            if (isOpen) {
                try {
                    const auth = getAuth();
                    const uid = auth.currentUser?.uid;

                    if (uid) {
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            setBankName(userData.bankName || '');
                            setAccountNumber(userData.accountNumber || '');
                            setInitialBankName(userData.bankName || ''); 
                            setInitialAccountNumber(userData.accountNumber || '');
                        }
                    }
                } catch (error) {
                    console.error('Error fetching account info:', error);
                    setError('Gagal mengambil informasi rekening');
                }
            }
        };

        fetchAccountInfo();
    }, [isOpen]);

    const handleAccountUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const auth = getAuth();
            const uid = auth.currentUser?.uid;

            if (!uid) {
                setError('Pengguna tidak terautentikasi');
                setIsLoading(false);
                return;
            }
            
            if (!bankName.trim()) {
                setError('Nama bank harus diisi');
                setIsLoading(false);
                return;
            }
            if (!accountNumber.trim()) {
                setError('Nomor rekening harus diisi');
                setIsLoading(false);
                return;
            }

            if (bankName.trim() === initialBankName) {
                setError('Tidak ada perubahan pada nama bank Anda');
                setIsLoading(false);
                return;
            }
            
            if (accountNumber.trim() === initialAccountNumber) {
                setError('Tidak ada perubahan pada nomor rekening Anda');
                setIsLoading(false);
                return;
            }
            
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                bankName: bankName.trim(),
                accountNumber: accountNumber.trim()
            });

            setSuccess('Informasi rekening berhasil diperbarui');        
            setTimeout(onClose, 3000);
        } catch (error) {
            console.error('Error updating account info:', error);
            setError('Gagal memperbarui informasi rekening');
        } finally {
            setIsLoading(false); 
        }
    };

    const handleModalClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            onClick={handleModalClick}
        >
            <div className="bg-white px-6 py-4 rounded-lg w-96 relative">
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
                    <div className="mb-4">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Nama Bank</label>
                        <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            placeholder="Masukkan nama bank"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Nomor Rekening</label>
                        <input
                            type="text"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                            placeholder="Masukkan nomor rekening"
                            required
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="bg-red-600 text-white px-6 py-3 rounded-md text-sm md:text-sm hover:bg-red-700 hover:text-gray-200 transition-colors"
                            disabled={isLoading}
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