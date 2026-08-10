import React, { useState, useEffect, useRef } from 'react'
import { db, storage } from '../firebaseConfig'
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp
} from 'firebase/firestore'
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { getAuth } from 'firebase/auth'

const MAX_FILE_SIZE_MB = 5

const AnnouncementManager = () => {
    const [announcements, setAnnouncements] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedFile, setSelectedFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null })
    const [isDeleting, setIsDeleting] = useState(false)
    const fileInputRef = useRef(null)

    const fetchAnnouncements = async () => {
        setLoading(true)
        try {
            const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
            const snapshot = await getDocs(q)
            const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
            setAnnouncements(items)
        } catch (error) {
            console.error('Error fetching announcements:', error)
            toast.error('Gagal memuat riwayat pengumuman')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAnnouncements()
    }, [])

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.warning('File harus berupa gambar')
            return
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            toast.warning(`Ukuran gambar maksimal ${MAX_FILE_SIZE_MB}MB`)
            return
        }

        setSelectedFile(file)
        setPreviewUrl(URL.createObjectURL(file))
    }

    const resetUploadForm = () => {
        setSelectedFile(null)
        setPreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.warning('Pilih gambar terlebih dahulu')
            return
        }

        setIsUploading(true)
        try {
            const auth = getAuth()
            const adminName = auth.currentUser?.displayName || auth.currentUser?.email || 'Super Admin'

            // Upload gambar ke Storage
            const fileName = `${Date.now()}_${selectedFile.name}`
            const storagePath = `announcements/${fileName}`
            const storageRef = ref(storage, storagePath)
            await uploadBytes(storageRef, selectedFile)
            const imageUrl = await getDownloadURL(storageRef)

            // Nonaktifkan semua pengumuman lama, supaya cuma yang terbaru yang tayang
            const batch = writeBatch(db)
            announcements.forEach((item) => {
                if (item.active) {
                    batch.update(doc(db, 'announcements', item.id), { active: false })
                }
            })
            await batch.commit()

            // Simpan pengumuman baru
            await addDoc(collection(db, 'announcements'), {
                imageUrl,
                imagePath: storagePath,
                active: true,
                createdAt: serverTimestamp(),
                createdBy: adminName
            })

            toast.success('Pengumuman berhasil dipublikasikan')
            resetUploadForm()
            fetchAnnouncements()
        } catch (error) {
            console.error('Error uploading announcement:', error)
            toast.error('Gagal mengunggah pengumuman. Silakan coba lagi')
        } finally {
            setIsUploading(false)
        }
    }

    const toggleActive = async (item) => {
        try {
            if (!item.active) {
                // Aktifkan item ini, nonaktifkan yang lain (biar cuma 1 yang tayang)
                const batch = writeBatch(db)
                announcements.forEach((a) => {
                    if (a.active) {
                        batch.update(doc(db, 'announcements', a.id), { active: false })
                    }
                })
                batch.update(doc(db, 'announcements', item.id), { active: true })
                await batch.commit()
            } else {
                await updateDoc(doc(db, 'announcements', item.id), { active: false })
            }
            toast.success('Status pengumuman diperbarui')
            fetchAnnouncements()
        } catch (error) {
            console.error('Error toggling announcement:', error)
            toast.error('Gagal memperbarui status pengumuman')
        }
    }

    const handleDelete = (item) => {
        setDeleteModal({ isOpen: true, item })
    }

    const cancelDelete = () => {
        setDeleteModal({ isOpen: false, item: null })
    }

    const confirmDelete = async () => {
        if (!deleteModal.item) return
        setIsDeleting(true)
        try {
            const { id, imagePath } = deleteModal.item

            if (imagePath) {
                try {
                    await deleteObject(ref(storage, imagePath))
                } catch (storageError) {
                    console.warn('Gambar tidak ditemukan di storage, lanjut hapus data:', storageError)
                }
            }

            await deleteDoc(doc(db, 'announcements', id))

            toast.success('Pengumuman berhasil dihapus')
            setDeleteModal({ isOpen: false, item: null })
            fetchAnnouncements()
        } catch (error) {
            console.error('Error deleting announcement:', error)
            toast.error('Gagal menghapus pengumuman. Silakan coba lagi')
        } finally {
            setIsDeleting(false)
        }
    }

    const formatDate = (timestamp) => {
        if (!timestamp?.toDate) return '-'
        return timestamp.toDate().toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="container mx-auto py-10 md:py-8 md:pb-20">
            <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Kelola Pengumuman</h2>

            {/* Upload Section */}
            <div className="bg-white p-6 rounded-lg shadow mb-6 dark:bg-gray-800">
                <h3 className="text-xl font-medium mb-4 dark:text-gray-100">Unggah Pengumuman Baru</h3>
                <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
                    Gambar yang diunggah akan otomatis ditampilkan ke semua pengguna saat login (menggantikan pengumuman aktif sebelumnya).
                </p>

                <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex-1">
                        <label className="block font-medium text-gray-700 mb-1 dark:text-gray-300">
                            Pilih Gambar <span className="text-red-500 dark:text-red-400">*</span>
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-700 border border-gray-300 rounded-md cursor-pointer focus:outline-none dark:text-gray-300 dark:border-gray-600 dark:bg-gray-700 file:mr-4 file:py-1.5 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-600 dark:file:text-gray-200"
                        />
                        <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
                            Format gambar, maksimal {MAX_FILE_SIZE_MB}MB
                        </p>

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleUpload}
                                disabled={isUploading || !selectedFile}
                                className="px-8 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? 'Mengunggah...' : 'Publikasikan'}
                            </button>
                            {selectedFile && (
                                <button
                                    onClick={resetUploadForm}
                                    disabled={isUploading}
                                    className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                >
                                    Batal
                                </button>
                            )}
                        </div>
                    </div>

                    {previewUrl && (
                        <div className="w-full sm:w-64 flex-none">
                            <p className="block font-medium text-gray-700 mb-1 dark:text-gray-300">Preview</p>
                            <div className="rounded-lg overflow-hidden border dark:border-gray-600">
                                <img src={previewUrl} alt="Preview pengumuman" className="w-full h-auto object-cover" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History Section */}
            <div className="bg-white p-6 rounded-lg shadow dark:bg-gray-800">
                <h3 className="text-xl font-medium mb-4 dark:text-gray-100">Riwayat Pengumuman</h3>

                {loading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</p>
                ) : announcements.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada pengumuman yang diunggah.</p>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <div className="inline-block min-w-[700px] w-full">
                            <table className="min-w-full bg-white border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600">
                                <thead>
                                    <tr className="bg-gray-100 text-left dark:bg-gray-700">
                                        <th className="px-4 py-2 border w-24 dark:border-gray-600">Gambar</th>
                                        <th className="px-4 py-2 border break-words dark:border-gray-600">Tanggal Unggah</th>
                                        <th className="px-4 py-2 border break-words dark:border-gray-600">Diunggah Oleh</th>
                                        <th className="px-4 py-2 border text-center dark:border-gray-600">Status</th>
                                        <th className="px-2 py-2 border text-center dark:border-gray-600">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {announcements.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-2 border dark:border-gray-600">
                                                <img
                                                    src={item.imageUrl}
                                                    alt="Pengumuman"
                                                    className="w-16 h-16 object-cover rounded"
                                                />
                                            </td>
                                            <td className="px-4 py-2 border dark:border-gray-600">{formatDate(item.createdAt)}</td>
                                            <td className="px-4 py-2 border dark:border-gray-600">{item.createdBy || '-'}</td>
                                            <td className="px-4 py-2 border text-center dark:border-gray-600">
                                                {item.active ? (
                                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        Aktif
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 border text-center dark:border-gray-600">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => toggleActive(item)}
                                                        className="px-3 py-1 rounded text-xs font-medium border border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                                                        title={item.active ? 'Nonaktifkan' : 'Aktifkan'}
                                                    >
                                                        {item.active ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        className="flex items-center justify-center rounded-full p-1 bg-red-200 hover:bg-red-300 text-red-600 border-[1px] border-red-600"
                                                        title="Hapus"
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            viewBox="0 0 20 20"
                                                            fill="currentColor"
                                                            className="size-5"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Konfirmasi Delete */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full dark:bg-gray-800">
                        <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Konfirmasi Hapus</h3>
                        <p className="text-gray-600 mb-6 dark:text-gray-300">
                            Apakah Anda yakin ingin menghapus pengumuman ini?
                            <br />
                            <span className="text-sm text-red-600 mt-2 block dark:text-red-400">
                                Tindakan ini tidak dapat dibatalkan.
                            </span>
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={cancelDelete}
                                disabled={isDeleting}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                                {isDeleting ? 'Menghapus...' : 'Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AnnouncementManager