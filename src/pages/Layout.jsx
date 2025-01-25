import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import { auth } from '../firebaseConfig';
import { signOut } from "firebase/auth";
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

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
        <div className="min-h-screen flex flex-col">
            <Navbar toggleSidebar={toggleSidebar} />
            <div className="flex mt-6 flex-1">
                <Sidebar 
                    isOpen={isSidebarOpen} 
                    toggleSidebar={toggleSidebar}
                    onLogout={handleLogout}
                />
                <div className="flex-1 bg-gray-100 p-4 md:p-6 ml-0 lg:ml-64 overflow-hidden">
                    <main className="w-full overflow-hidden">{children}</main>
                </div>
            </div>
            
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

            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                closeOnClick
                pauseOnHover
                style={{
                    padding: window.innerWidth <= 640 ? '0 48px' : 0,
                    margin: window.innerWidth <= 640 ? '48px 0 0 36px' : 0
                }}
                toastClassName="toast-item mt-2 xl:mt-0"
            />
        </div>
    );
};

export default Layout;