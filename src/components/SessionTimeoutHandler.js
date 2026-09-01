import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const SessionTimeoutHandler = ({ children, timeoutDuration }) => {
    const navigate = useNavigate();
    const lastActivityRef = useRef(Date.now());

    // Fungsi untuk mengecek apakah sesi sudah timeout
    const checkForInactivity = useCallback(async () => {
        const currentTime = Date.now();
        const timeSinceLastActivity = currentTime - lastActivityRef.current;

        // Jika waktu tidak aktif melebihi batas timeout
        if (timeSinceLastActivity > timeoutDuration) {
            // Sign out dari Firebase Auth juga -- sebelumnya cuma localStorage yang
            // dibersihkan, jadi sesi Firebase Auth tetap hidup di browser walau
            // tampilan sudah "logout". Samakan dengan logout manual di Navbar/Layout.
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Gagal sign out otomatis saat sesi timeout:', error);
            }

            // Hapus data login dari localStorage
            localStorage.removeItem('userUid');
            localStorage.removeItem('userRole');

            // Redirect ke halaman login
            navigate('/', { replace: true });
        }
    }, [timeoutDuration, navigate]);
    
    // Fungsi untuk mengupdate waktu aktivitas terakhir
    const updateLastActivity = () => {
        lastActivityRef.current = Date.now();
    };
    
    useEffect(() => {
        // Periksa apakah user sudah login
        const userUid = localStorage.getItem('userUid');
        if (!userUid) return;
        
        // Set initial activity time
        lastActivityRef.current = Date.now();
        
        // Set event listeners untuk mendeteksi aktivitas user
        const events = [
            'mousedown', 'mousemove', 'keypress',
            'scroll', 'touchstart', 'click'
        ];
        
        // Tambahkan event listeners
        events.forEach(event => {
            window.addEventListener(event, updateLastActivity);
        });
        
        // Set interval untuk memeriksa timeout secara berkala
        const intervalId = setInterval(checkForInactivity, 5000); // Cek setiap 5 detik
        
        // Cleanup
        return () => {
            events.forEach(event => {
                window.removeEventListener(event, updateLastActivity);
            });
            clearInterval(intervalId);
        };
    }, [navigate, timeoutDuration, checkForInactivity]);
    
    return <>{children}</>;
};

export default SessionTimeoutHandler;