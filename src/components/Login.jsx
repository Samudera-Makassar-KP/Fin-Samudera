import React, { useState } from 'react'
import { db, functions } from '../firebaseConfig'
import { getDoc, getDocs, where, query, collection, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useNavigate } from 'react-router-dom'
import LogoHero from '../assets/images/login-hero.webp'
import Logo from '../assets/images/logo-samudera.png'
import FinanceIllustration from '../assets/images/finance.png'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash, faSpinner, faUser, faLock } from '@fortawesome/free-solid-svg-icons'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';

// Ganti nilai ini sesuai kebutuhan rilis Anda (ditampilkan di pojok kanan atas, seperti pada mockup)
const APP_VERSION = 'v1.0.0'

const LoginPage = () => {
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(false)
    const [isResetLoading, setIsResetLoading] = useState(false)

    const fetchUserProfile = async (authUser, loginEmail) => {
        try {
            const syncCurrentUserProfile = httpsCallable(functions, 'syncCurrentUserProfile')
            const result = await syncCurrentUserProfile()
            if (result?.data?.role) {
                return result.data
            }
        } catch (syncError) {
            console.warn('Gagal sinkronisasi profil user dari callable:', syncError)
        }

        const uidDoc = await getDoc(doc(db, 'users', authUser.uid))
        if (uidDoc.exists()) {
            return { ...uidDoc.data(), uid: authUser.uid }
        }

        const emailQuery = query(collection(db, 'users'), where('email', '==', loginEmail))
        const emailSnapshot = await getDocs(emailQuery)

        if (emailSnapshot.empty) {
            return null
        }

        const userDoc = emailSnapshot.docs[0]
        return { ...userDoc.data(), uid: authUser.uid }
    }

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword)
    }

    const handleResetPassword = async () => {
        if (!email) {
            setError('Silakan masukkan email terlebih dahulu');
            return;
        }

        setError('');
        setSuccessMessage('');
        setIsResetLoading(true);

        try {
            const emailQuery = query(collection(db, 'users'), where('email', '==', email));
            const emailSnapshot = await getDocs(emailQuery);

            if (emailSnapshot.empty) {
                setError('Email tidak terdaftar di sistem.');
                setIsResetLoading(false);
                return;
            }

            await sendPasswordResetEmail(auth, email);
            setSuccessMessage('Email reset kata sandi telah dikirim. Silakan periksa email Anda.');
        } catch (err) {
            if (err.code === 'auth/invalid-email') {
                setError('Format email tidak valid.');
            } else {
                setError('Terjadi kesalahan saat mengirim email reset. Silakan coba lagi.');
            }
        } finally {
            setIsResetLoading(false);
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const userData = await fetchUserProfile(userCredential.user, email);

            if (!userData) {
                console.error('Email ditemukan di Firebase Auth tetapi tidak di Firestore.');
                setError('Email tidak ditemukan di sistem. Silakan hubungi admin.');
                setIsLoading(false);
                return;
            }

            const role = userData.role;

            localStorage.setItem('userUid', userData.uid || userCredential.user.uid);
            localStorage.setItem('userRole', role);

            if (role === 'Super Admin') {
                navigate('/manage-users');
            } else if (['Admin', 'Validator', 'Reviewer', 'Employee'].includes(role)) {
                navigate('/dashboard');
            } else {
                setError('Role tidak dikenali. Hubungi Super Admin.');
                setIsLoading(false);
            }
        } catch (err) {
            if (err.code === 'auth/invalid-credential') {
                setError('Terjadi kesalahan. Pastikan email dan password Anda sudah benar');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: `url(${LogoHero})` }}
        >
            {/* Overlay tint so the card and watermark text stay readable over the photo */}
            <div className="absolute inset-0 bg-slate-900/20" />

            {/* Version watermark, top right - mirrors the small build tag in the mockup */}
            <span className="absolute top-3 right-4 text-[10px] text-white/80 tracking-wide select-none z-10">
                {APP_VERSION}
            </span>

            {/* Centered card */}
            <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* Left: centered illustration pane */}
                <div className="hidden md:flex md:w-1/2 items-center justify-center bg-slate-50 p-10">
                    <img src={FinanceIllustration} alt="Ilustrasi keuangan" className="w-2/3 h-auto object-contain" />
                </div>

                {/* Right: form pane */}
                <div className="w-full md:w-1/2 flex flex-col justify-center px-8 py-10 md:px-12">
                    <div className="mb-6">
                        <img src={Logo} alt="Logo Samudera Indonesia" className="h-10" />
                    </div>

                    <h1 className="text-xl font-semibold text-gray-900 mb-6">
                        Masuk ke akun Anda!
                    </h1>

                    {error && (
                        <p className="text-red-500 text-sm mb-4">{error}</p>
                    )}
                    {successMessage && (
                        <p className="text-green-600 text-sm mb-4">{successMessage}</p>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className="mb-5">
                            <label htmlFor="email" className="block text-gray-700 font-medium mb-2 text-sm">
                                Email
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                    <FontAwesomeIcon icon={faUser} className="h-4 w-4" />
                                </span>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="user@email.com"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="mb-2">
                            <label htmlFor="password" className="block text-gray-700 font-medium mb-2 text-sm">
                                Password
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                    <FontAwesomeIcon icon={faLock} className="h-4 w-4" />
                                </span>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                                <span
                                    onClick={togglePasswordVisibility}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-gray-400 hover:text-gray-600"
                                >
                                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="h-4 w-4" />
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end mb-6">
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                className="text-red-600 text-xs hover:underline"
                                disabled={isResetLoading}
                            >
                                {isResetLoading ? 'Mengirim...' : 'Lupa Kata Sandi?'}
                            </button>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-700 transition duration-300 text-sm disabled:opacity-70"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                'Login'
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
                        Dengan melanjutkan, Anda menyetujui{' '}
                        <a href="/disclaimer" className="font-semibold text-gray-500 hover:underline">Kebijakan</a>
                        {' '}dan{' '}
                        <a href="/privacy-policy" className="font-semibold text-gray-500 hover:underline">Privasi</a>
                        {' '}kami.
                    </p>
                </div>
            </div>

            <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/80 select-none z-10">
                Copyright © {new Date().getFullYear()} Samudera Indonesia. All rights reserved.
            </p>
        </div>
    )
}

export default LoginPage