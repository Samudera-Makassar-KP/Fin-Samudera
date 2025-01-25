import React, { useState, useEffect, useRef } from 'react'
import { db } from '../firebaseConfig'
import { doc, getDoc } from 'firebase/firestore'
import Logo from '../assets/images/logo-samudera.png'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars } from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal';
import PasswordChangeModal from './PasswordChangeModal'
import BankUpdateModal from './BankUpdateModal'
import { auth } from '../firebaseConfig'
import { signOut } from "firebase/auth";

function Navbar({ toggleSidebar }) {
    const [user, setUser] = useState(null)
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
    const [isBankUpdateModalOpen, setIsBankUpdateModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef(null)
    const navigate = useNavigate()
    
    const role = localStorage.getItem('userRole')
    
    useEffect(() => {
        const uid = localStorage.getItem('userUid')
        const fetchUserData = async () => {
            if (uid) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', uid))
                    if (userDoc.exists()) {
                        const userData = userDoc.data()
                        setUser({
                            name: userData.nama || 'Anonymous',
                            initials: getInitials(userData.nama || 'Anonymous')
                        })
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error)
                }
            }
        }

        fetchUserData()
    }, [])
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleChangePassword = () => {
        setIsPasswordModalOpen(true)
        setIsDropdownOpen(false)
    }

    const handleUpdateAccountInfo = () => {
        setIsBankUpdateModalOpen(true)
        setIsDropdownOpen(false)
    }

    const handleLogout = () => {
        setShowLogoutModal(true);
    };

    const handleCloseLogoutModal = () => {
        if (!isLoading) {
            setShowLogoutModal(false);
        }
    };

    const handleConfirmLogout = async () => {
        setIsLoading(true);
        try {
            await signOut(auth);
            localStorage.clear();
            navigate('/');
        } finally {
            setIsLoading(false);
            setShowLogoutModal(false);
        }
    };

    return (
        <>
            <nav className="bg-white h-16 flex justify-between items-center px-4 md:px-6 shadow fixed top-0 left-0 right-0 z-20 lg:left-60">
                <div className="flex items-center space-x-4">
                    <button onClick={toggleSidebar} className="lg:hidden text-gray-600">
                        <FontAwesomeIcon icon={faBars} size="lg" />
                    </button>
                    <img src={Logo} alt="Samudera Logo" className="h-6 md:h-8" />
                </div>
                <div className="flex items-center space-x-2 md:space-x-4 relative" ref={dropdownRef}>
                    {user ? (
                        <div className="relative flex items-center">
                            <span className="font-medium mr-2 hidden sm:block">{user.name}</span>
                            <div
                                className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-red-600 transition-colors"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                {user.initials}
                            </div>

                            {isDropdownOpen && (
                                <div className="absolute right-0 top-full mt-2 w-44 md:w-60 bg-white border rounded-lg shadow-lg">
                                    <div className="p-3 border-b flex items-center space-x-2">
                                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white">
                                            {user.initials}
                                        </div>
                                        <span className="font-medium truncate">{user.name}</span>
                                    </div>
                                    <ul className="py-1">
                                        <li
                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                            onClick={handleChangePassword}
                                        >
                                            Ganti Kata Sandi
                                        </li>
                                        {role !== 'Super Admin' && (
                                            <li
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                                onClick={handleUpdateAccountInfo}
                                            >
                                                Perbarui Informasi Rekening
                                            </li>
                                        )}
                                        <li
                                            className="px-4 py-2 hover:bg-gray-100 text-red-600 cursor-pointer"
                                            onClick={handleLogout}
                                        >
                                            Logout
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span>Please login</span>
                    )}
                </div>
            </nav>
            
            <Modal
                showModal={showLogoutModal}
                title="Konfirmasi Logout"
                message="Apakah Anda yakin ingin keluar?"
                onClose={handleCloseLogoutModal}
                onConfirm={handleConfirmLogout}
                cancelText="Batal"
                confirmText="Ya, Keluar"
                isLoading={isLoading}
            />

            <PasswordChangeModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />

            <BankUpdateModal isOpen={isBankUpdateModalOpen} onClose={() => setIsBankUpdateModalOpen(false)} />
        </>
    )
}

function getInitials(name) {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
}

export default Navbar