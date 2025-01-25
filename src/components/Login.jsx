import React, { useState } from 'react'
import { db } from '../firebaseConfig'
import { getDocs, where, query, collection } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import LogoHero from '../assets/images/login-hero.jpg'
import Logo from '../assets/images/logo-samudera.png'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const LoginPage = () => {
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(false)
    const [isResetLoading, setIsResetLoading] = useState(false)

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
            // Step 1: Cek email di Firestore
            const emailQuery = query(collection(db, 'users'), where('email', '==', email));
            const emailSnapshot = await getDocs(emailQuery);

            if (emailSnapshot.empty) {
                setError('Email tidak terdaftar di sistem.');
                setIsResetLoading(false);
                return;
            }

            // Step 2: Kirim email reset password via Firebase Authentication
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
            // Step 1: Login via Firebase Authentication
            await signInWithEmailAndPassword(auth, email, password);                        

            // Step 2: Validasi email di Firestore
            const emailQuery = query(collection(db, 'users'), where('email', '==', email));
            const emailSnapshot = await getDocs(emailQuery);

            if (emailSnapshot.empty) {
                console.error('Email ditemukan di Firebase Auth tetapi tidak di Firestore.');
                setError('Email tidak ditemukan di sistem. Silakan hubungi admin.');
                setIsLoading(false);
                return;
            }

            // Step 3: Ambil data pengguna dari Firestore
            const userDoc = emailSnapshot.docs[0];
            const userData = userDoc.data();
            const role = userData.role;
            
            localStorage.setItem('userUid', userDoc.id);
            localStorage.setItem('userRole', role);
            
            if (role === 'Super Admin') {
                navigate('/manage-users');
            } else if (['Admin', 'Validator', 'Reviewer', 'Employee'].includes(role)) {
                navigate(`/dashboard/${role.toLowerCase().replace(' ', '')}`);
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
        <div className="flex h-screen flex-col lg:flex-row">
            <div className="w-full lg:w-[65%] h-full relative">
                <img src={LogoHero} alt="Login Hero" className="w-full h-full object-cover" />

                <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center lg:hidden">
                    <div className="bg-white p-4 md:p-6 rounded-lg w-11/12 max-w-sm md:max-w-md shadow-lg sm:landscape:scale-[0.85] sm:landscape:transform">
                        <div className="mb-4 md:mb-4 text-center">
                            <img src={Logo} alt="Logo" className="w-6/12 mx-auto" />
                        </div>

                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-4 text-center">Login</h1>

                        {error && <p className="text-red-500 text-center text-sm md:text-base">{error}</p>}
                        {successMessage && <p className="text-green-500 text-center text-sm md:text-base">{successMessage}</p>}

                        <form onSubmit={handleLogin}>
                            <div className="mb-4 md:mb-6">
                                <label
                                    htmlFor="email"
                                    className="block text-gray-700 font-medium mb-2 text-sm md:text-base"
                                >
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="user@gmail.com"
                                    className="w-full px-4 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm md:text-base"
                                />
                            </div>

                            <div className="mb-6 md:mb-8">
                                <label
                                    htmlFor="password"
                                    className="block text-gray-700 font-medium mb-2 text-sm md:text-base"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full px-4 py-2 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm md:text-base"
                                    />
                                    <span
                                        onClick={togglePasswordVisibility}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                                    >
                                        <FontAwesomeIcon
                                            icon={showPassword ? faEyeSlash : faEye}
                                            className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500"
                                        />
                                    </span>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <button
                                        type="button"
                                        onClick={handleResetPassword}
                                        className="text-red-600 text-xs md:text-sm hover:underline"
                                        disabled={isResetLoading}
                                    >
                                        {isResetLoading ? 'Mengirim...' : 'Lupa Kata Sandi?'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-red-600 text-white font-semibold py-2 rounded-md hover:bg-red-700 transition duration-300 text-sm md:text-base"
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
                    </div>
                </div>
            </div>

            <div className="hidden lg:flex lg:w-[35%] bg-white flex-col justify-center px-16">
                <div className="mb-8">
                    <img src={Logo} alt="Logo" className="w-8/12 h-full" />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-8">Login</h1>

                {error && <p className="text-red-500 mb-4">{error}</p>}
                {successMessage && <p className="text-green-500 mb-4">{successMessage}</p>}

                <form onSubmit={handleLogin}>
                    <div className="mb-6">
                        <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@gmail.com"
                            className="w-full px-4 py-3 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>

                    <div className="mb-8">
                        <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full px-4 py-3 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <span
                                onClick={togglePasswordVisibility}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                            >
                                <FontAwesomeIcon
                                    icon={showPassword ? faEyeSlash : faEye}
                                    className="h-5 w-5 text-gray-500"
                                />
                            </span>
                        </div>
                        <div className="flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                className="text-red-600 hover:underline"
                                disabled={isResetLoading}
                            >
                                {isResetLoading ? 'Mengirim...' : 'Lupa Kata Sandi?'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-red-600 text-white font-semibold py-3 rounded-md hover:bg-red-700 transition duration-300"
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
            </div>
        </div>
    )
}

export default LoginPage