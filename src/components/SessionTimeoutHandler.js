import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-toastify';
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

    // Bagian AI: deteksi sesi Firebase Auth yang sudah tidak valid lagi (token
    // expired & gagal refresh, akun dihapus/dinonaktifkan, dll) padahal
    // localStorage.userUid masih ada. Sebelumnya kondisi ini TIDAK terdeteksi --
    // ProtectedRoute cuma cek localStorage (bukan status Auth yang sebenarnya),
    // jadi UI tetap tampil "normal" & form tetap bisa diisi, tapi SEMUA panggilan
    // Firestore (baca maupun tulis) gagal diam-diam dengan "Missing or
    // insufficient permissions" karena request.auth null di server -- user cuma
    // lihat pesan generik "Terjadi kesalahan saat menyimpan data" tanpa tahu
    // solusinya, padahal solusinya simpel: login ulang. onAuthStateChanged
    // dijamin Firebase baru terpanggil SETELAH status sesi selesai diperiksa
    // (bukan placeholder loading), jadi begitu ini melaporkan null sementara
    // localStorage masih menganggap sudah login, itu sudah pasti sesi yang
    // genuinely tidak valid -- bukan false positive dari kondisi race saat app
    // baru dimuat.
    useEffect(() => {
        const userUid = localStorage.getItem('userUid');
        if (!userUid) return;

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user && localStorage.getItem('userUid')) {
                localStorage.removeItem('userUid');
                localStorage.removeItem('userRole');
                toast.error('Sesi Anda telah berakhir. Silakan login kembali.');
                navigate('/', { replace: true });
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    return <>{children}</>;
};

export default SessionTimeoutHandler;