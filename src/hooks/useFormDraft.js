import { useState, useCallback, useEffect } from 'react'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { toast } from 'react-toastify'

// Custom hook untuk mengelola draft
const useFormDraft = (db, userData, draftType, draftId = '') => {
    const [hasDraft, setHasDraft] = useState(false)

    const getDraftRef = useCallback(() => {
        // Gabungkan UID, Jenis Form, dan Nomor BS biar jadi 1 ID Unik
        const idSpesifik = draftId || 'baru'
        return doc(db, 'drafts', `${userData.uid}_${draftType}_${idSpesifik}`)
    }, [db, userData.uid, draftType, draftId])

    const saveDraft = async (formData) => {
        try {
            const draftRef = getDraftRef()
            const draftData = {
                ...formData,
                type: draftType,
                updatedAt: new Date()
            }

            await setDoc(draftRef, draftData)
            setHasDraft(true)
            toast.success('Draft berhasil disimpan')
        } catch (error) {
            console.error('Error saving draft:', error)
            toast.error('Gagal menyimpan draft')
        }
    }

    const loadDraft = async () => {
        try {
            const draftRef = getDraftRef()
            const draftSnap = await getDoc(draftRef)
            
            if (draftSnap.exists()) {
                const draftData = draftSnap.data()
                
                // Draft JANGAN dihapus saat di-load agar user bisa lanjut edit.
                // Draft hanya dihapus saat tombol Submit ditekan (menggunakan clearDraft).
                toast.success('Draft berhasil dimuat')
                
                return draftData
            }
            return null
        } catch (error) {
            console.error('Error loading draft:', error)
            toast.error('Gagal memuat draft')
            return null
        }
    }

    // --- TAMBAHAN BARU: Fungsi untuk menghapus draft ---
    const clearDraft = async () => {
        try {
            const draftRef = getDraftRef()
            await deleteDoc(draftRef) // Perintah untuk menghapus dari Firebase
            setHasDraft(false) // Reset status draft di UI
            console.log(`🗑️ Draft [${draftRef.id}] berhasil dihapus dari database.`)
        } catch (error) {
            console.error('Error clearing draft:', error)
        }
    }

    useEffect(() => {
        const checkExistingDraft = async () => {
            if (!userData.uid) return
            
            const draftRef = getDraftRef()
            const draftSnap = await getDoc(draftRef)
            
            setHasDraft(draftSnap.exists())
            
            // Console log ini buat bukti ke Imah kalau mesinnya jalan!
            console.log(`🔍 Cek Laci Draft ID [${draftRef.id}] -> ${draftSnap.exists() ? 'ADA ISINYA ✅' : 'KOSONG ❌'}`)
        }

        // Kita kasih JEDA 0.5 detik supaya dia tidak ngecek database setiap ketik 1 huruf
        const timeoutId = setTimeout(() => {
            checkExistingDraft()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [getDraftRef, userData.uid])

    return {
        hasDraft,
        saveDraft,
        loadDraft,
        clearDraft // <-- PASTIKAN INI DIKEMBALIKAN (DI-EXPORT)
    }
}

export default useFormDraft