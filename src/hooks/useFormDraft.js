import { useState, useCallback, useEffect } from 'react'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { toast } from 'react-toastify'

const useFormDraft = (db, userData, draftType, draftId = '') => {
    const [hasDraft, setHasDraft] = useState(false)

    const getDraftRef = useCallback(() => {
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
    const clearDraft = async () => {
        try {
            const draftRef = getDraftRef()
            await deleteDoc(draftRef)
            setHasDraft(false)
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