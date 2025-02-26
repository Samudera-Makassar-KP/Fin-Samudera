import { useState, useCallback, useEffect } from 'react'
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { toast } from 'react-toastify'

// Custom hook untuk mengelola draft
const useFormDraft = (db, userData, draftType, initialState) => {
    const [hasDraft, setHasDraft] = useState(false)

    const getDraftRef = useCallback(() => {
        return doc(db, 'drafts', `${userData.uid}_${draftType}`)
    }, [db, userData.uid, draftType])

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
                
                await deleteDoc(draftRef)
                setHasDraft(false)
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

    useEffect(() => {
        const checkExistingDraft = async () => {
            if (!userData.uid) return
            
            const draftRef = getDraftRef()
            const draftSnap = await getDoc(draftRef)
            setHasDraft(draftSnap.exists())
        }

        checkExistingDraft()
    }, [userData.uid, getDraftRef])

    return {
        hasDraft,
        saveDraft,
        loadDraft
    }
}

export default useFormDraft