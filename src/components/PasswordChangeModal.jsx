import React, { useState, useEffect } from 'react';
import {
    reauthenticateWithCredential,
    updatePassword,
    EmailAuthProvider,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faSpinner } from '@fortawesome/free-solid-svg-icons';

const PasswordChangeModal = ({ isOpen, onClose }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false)
    const [isResetLoading, setIsResetLoading] = useState(false)

    useEffect(() => {
        if (!isOpen) {
            setError('');
            setSuccess('');
            
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
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

    const togglePasswordVisibility = (setter) => () => {
        setter((prev) => !prev);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setError('Pengguna tidak terautentikasi');
                setIsLoading(false);
                return;
            }

            // Validasi pertama: Cek kata sandi lama
            const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
            try {
                await reauthenticateWithCredential(currentUser, credential);
            } catch (reauthError) {
                setIsLoading(false);
                if (reauthError.code === 'auth/invalid-credential') {
                    setError('Kata sandi lama salah');
                    return;
                }
                throw reauthError;
            }

            // Validasi kedua: Pastikan kata sandi baru tidak sama dengan kata sandi lama
            if (oldPassword === newPassword) {
                setError('Kata sandi baru harus berbeda dari kata sandi lama');
                setIsLoading(false);
                return;
            }

            // Validasi ketiga: Panjang kata sandi minimal
            if (newPassword.length < 6) {
                setError('Kata sandi baru minimal 6 karakter');
                setIsLoading(false);
                return;
            }

            // Validasi keempat: Konfirmasi kata sandi
            if (newPassword !== confirmPassword) {
                setError('Kata sandi baru tidak cocok');
                setIsLoading(false);
                return;
            }
            
            try {
                await updatePassword(currentUser, newPassword);                
            } catch (error) {
                console.error('Detailed password update error:', error);
            } finally {
                setIsLoading(false); 
            }

            setSuccess('Kata sandi berhasil diperbarui');
            setTimeout(onClose, 3000);
            
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');

        } catch (error) {
            setError('Gagal mengubah kata sandi: ' + error.message);
        }
    };

    const handleForgotPassword = async () => {
        setError('');
        setSuccess('');
        setIsResetLoading(true)

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setError('Pengguna tidak terautentikasi');
                setIsResetLoading(false);
                return;
            }

            await sendPasswordResetEmail(auth, currentUser.email);
            setSuccess('Email reset kata sandi telah dikirim');
        } catch (error) {
            setError('Gagal mengirim email reset: ' + error.message);
        } finally {
            setIsResetLoading(false); 
        }
    };

    const handleModalClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleInputChange = (setter) => (e) => {
        setError(''); 
        setter(e.target.value);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            onClick={handleModalClick}
        >
            <div className="bg-white rounded-lg p-4 lg:p-6 max-w-md w-full mx-4 relative sm:landscape:scale-[0.85] sm:landscape:transform">
                <div className="flex items-center justify-between w-full mb-2">
                    <h2 className="text-lg md:text-xl font-semibold">
                        Ganti Kata Sandi
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

                <form onSubmit={handlePasswordChange}>
                    <div className="mb-4 relative">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Kata Sandi Lama</label>
                        <div className="relative">
                            <input
                                type={showOldPassword ? "text" : "password"}
                                value={oldPassword}
                                onChange={handleInputChange(setOldPassword)}
                                className="w-full px-3 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none pr-10"
                                required
                            />
                            <span
                                onClick={togglePasswordVisibility(setShowOldPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                            >
                                <FontAwesomeIcon
                                    icon={showOldPassword ? faEyeSlash : faEye}
                                    className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500"
                                />
                            </span>
                        </div>
                    </div>
                    <div className="mb-4 relative">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Kata Sandi Baru</label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={handleInputChange(setNewPassword)}
                                className="w-full px-3 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none pr-10"
                                required
                            />
                            <span
                                onClick={togglePasswordVisibility(setShowNewPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                            >
                                <FontAwesomeIcon
                                    icon={showNewPassword ? faEyeSlash : faEye}
                                    className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500"
                                />
                            </span>
                        </div>
                    </div>
                    <div className="mb-4 relative">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Konfirmasi Kata Sandi Baru</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={handleInputChange(setConfirmPassword)}
                                className="w-full px-3 py-2 border rounded-md hover:border-blue-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none pr-10"
                                required
                            />
                            <span
                                onClick={togglePasswordVisibility(setShowConfirmPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                            >
                                <FontAwesomeIcon
                                    icon={showConfirmPassword ? faEyeSlash : faEye}
                                    className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500"
                                />
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-red-600 text-sm md:text-sm hover:text-red-700 hover:underline"
                            disabled={isResetLoading}
                        >
                            {isResetLoading ? 'Mengirim...' : 'Lupa Kata Sandi?'}
                        </button>
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
                                'Ubah Kata Sandi'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordChangeModal;