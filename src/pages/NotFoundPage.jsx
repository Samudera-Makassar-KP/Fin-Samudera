import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
    const navigate = useNavigate();

    const handleBack = () => {        
        const userUid = localStorage.getItem('userUid');

        if (userUid) {            
            navigate(-1);
            return;
        } else {
            navigate('/', { replace: true }); 
            window.location.reload();
            return;  
        }        
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <p className="text-4xl font-bold mb-6">Halaman Tidak Ditemukan</p>
            <button
                onClick={handleBack}
                className="px-16 py-2 bg-red-600 text-white rounded hover:bg-red-700 hover:text-gray-200"
            >
                Kembali
            </button>
        </div>
    );
};

export default NotFoundPage;