import { useState, useCallback, useEffect } from 'react'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { toast } from 'react-toastify'

const useFormDraft = (db, userData, draftType, draftId = '') => {
    const [hasDraft, setHasDraft] = useState(false)

    const getDraftRef = useCallback(() => {
        if (!userData?.uid) {
            // Jangan pernah bikin ID draft tanpa uid (mis. "_lpj-umum_draft") --
            // ID seperti itu tidak akan pernah cocok dengan ID yang dipakai saat
            // draft aslinya disimpan/dihapus, sehingga bisa menyebabkan draft
            // "nyangkut" (tidak pernah terhapus) atau tidak pernah ketemu saat load.
            return null
        }
        const idSpesifik = draftId || 'baru'
        return doc(db, 'drafts', `${userData.uid}_${draftType}_${idSpesifik}`)
    }, [db, userData?.uid, draftType, draftId])

    const saveDraft = async (formData) => {
        try {
            const draftRef = getDraftRef()
            if (!draftRef) {
                toast.error('Data pengguna belum termuat, coba beberapa saat lagi sebelum menyimpan draft')
                return false
            }

            const draftData = {
                ...formData,
                type: draftType,
                updatedAt: new Date()
            }

            await setDoc(draftRef, draftData)
            setHasDraft(true)
            toast.success('Draft berhasil disimpan')
            return true
        } catch (error) {
            console.error('Error saving draft:', error)
            toast.error('Gagal menyimpan draft')
            return false
        }
    }

    const loadDraft = async () => {
        try {
            const draftRef = getDraftRef()
            if (!draftRef) return null

            const draftSnap = await getDoc(draftRef)
            
            if (draftSnap.exists()) {
                const draftData = draftSnap.data()
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

    // --- FUNGSI CLEARDRAFT WAJIB ADA ---
    // PENTING: return true/false supaya pemanggil (handleSubmit) TAHU kalau
    // penghapusan draft gagal, alih-alih gagal diam-diam seperti sebelumnya
    // (itu penyebab draft "nyangkut" walau dokumen sudah tersubmit).
    const clearDraft = async () => {
        try {
            const draftRef = getDraftRef()
            if (!draftRef) {
                console.warn('clearDraft dibatalkan: userData.uid belum termuat')
                return false
            }

            await deleteDoc(draftRef)
            setHasDraft(false)
            console.log(`🗑️ Draft [${draftRef.id}] berhasil dihapus dari database.`)
            return true
        } catch (error) {
            console.error('Error clearing draft:', error)
            toast.warning('LPJ berhasil disubmit, tapi draft lama gagal dihapus otomatis. Silakan hapus manual di halaman Cek Pengajuan.')
            return false
        }
    }

    useEffect(() => {
        const checkExistingDraft = async () => {
            if (!userData.uid) return
            const draftRef = getDraftRef()
            const draftSnap = await getDoc(draftRef)
            setHasDraft(draftSnap.exists())
            console.log(`🔍 Cek Laci Draft ID [${draftRef.id}] -> ${draftSnap.exists() ? 'ADA ISINYA ✅' : 'KOSONG ❌'}`)
        }

        const timeoutId = setTimeout(() => {
            checkExistingDraft()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [getDraftRef, userData.uid])

    return {
        hasDraft,
        saveDraft,
        loadDraft,
        clearDraft // <-- PASTIKAN INI DI-EKSPOR
    }
}

export default useFormDraft