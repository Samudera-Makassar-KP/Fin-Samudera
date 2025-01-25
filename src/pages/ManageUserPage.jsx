import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';  // Import Firestore functions
import Layout from './Layout';
import ManageUser from '../components/ManageUser';
import Modal from '../components/Modal';

const ManageUserPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [users, setUsers] = useState([]);  // State untuk menyimpan data pengguna

    useEffect(() => {
        document.title = 'Manage User - Samudera Indonesia';

        // Ambil data pengguna dari Firestore
        const fetchUsers = async () => {
            const usersCollection = collection(db, 'users');  // Nama koleksi 'users'
            const usersSnapshot = await getDocs(usersCollection);  // Ambil dokumen dari koleksi
            const usersList = usersSnapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,  // Menyimpan ID dokumen sebagai 'id'
            }));

            setUsers(usersList);  // Menyimpan data pengguna di state
        };

        fetchUsers();  // Panggil fungsi untuk mengambil data pengguna
    }, []);

    const openModal = (item) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
    };

    const handleDelete = async () => {
        if (selectedItem?.id) {
            try {
                // Menghapus dokumen dari Firestore
                await deleteDoc(doc(db, 'users', selectedItem.id));
                
                // Perbarui state untuk menghapus data yang dihapus dari UI
                setUsers(users.filter(user => user.id !== selectedItem.id));
                
                console.log("Pengguna berhasil dihapus");
            } catch (error) {
                console.error("Error menghapus pengguna:", error);
            }
        }
        closeModal();
    };

    return (
        <div>
            <Layout>
                <ManageUser data={{ user: users }} onOpenModal={openModal} onEdit={(item) => console.log('Edit:', item)} />
                {isModalOpen && (
                    <Modal
                        showModal={isModalOpen}
                        title="Konfirmasi Penghapusan"
                        message={`Apakah Anda yakin ingin menghapus pengguna ${selectedItem?.nama || 'ini'}?`}
                        onClose={closeModal}
                        onConfirm={handleDelete}
                    />
                )}
            </Layout>
        </div>
    );
};

export default ManageUserPage;
