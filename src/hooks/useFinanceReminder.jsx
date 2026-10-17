import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { toast } from 'react-toastify'
import { db } from '../firebaseConfig'

// Bagian BP: alur "Kirim Reminder ke Finance" yang sama seperti di BsTable.jsx
// dan ReimbursementTable.jsx (Bagian L/BK), dibungkus jadi hook supaya LPJ
// tidak perlu salinan ketiga. `sendReminder(item, validator)` adalah fungsi
// yang benar-benar mengirim (generate PDF + panggil callable).
//
// Aturan pemilihan Finance (identik dengan BS/RBS): Finance = user role
// Validator yang Unit Bisnis-nya beririsan dengan Unit Bisnis pengaju. Pengaju
// dengan 1 Unit Bisnis -> langsung kirim ke semua Finance unit tsb; pengaju di
// lebih dari 1 Unit Bisnis -> pilih satu Finance lewat modal.
export const useFinanceReminder = (sendReminder) => {
    const [submitterUnits, setSubmitterUnits] = useState([])
    const [financeValidators, setFinanceValidators] = useState([])
    const [reminderSendingId, setReminderSendingId] = useState(null)
    const [pickerModal, setPickerModal] = useState(null) // { item, candidates }

    useEffect(() => {
        const fetchFinanceReminderData = async () => {
            try {
                const uid = localStorage.getItem('userUid')
                if (!uid) return

                const userDoc = await getDoc(doc(db, 'users', uid))
                setSubmitterUnits(Array.isArray(userDoc.data()?.unit) ? userDoc.data().unit : [])

                const validatorSnapshot = await getDocs(
                    query(collection(db, 'userDirectory'), where('role', '==', 'Validator'))
                )
                setFinanceValidators(
                    validatorSnapshot.docs.map((docSnap) => ({
                        uid: docSnap.id,
                        nama: docSnap.data().nama || 'Validator',
                        unit: Array.isArray(docSnap.data().unit) ? docSnap.data().unit : []
                    }))
                )
            } catch (error) {
                console.error('Error fetching data reminder finance:', error)
            }
        }

        fetchFinanceReminderData()
    }, [])

    const send = async (item, validator) => {
        setReminderSendingId(item.id)
        try {
            await sendReminder(item, validator)
            toast.success(`Reminder terkirim ke ${validator.nama}`)
        } catch (error) {
            console.error('Error sending finance reminder:', error)
            toast.error(error?.message || 'Gagal mengirim reminder ke Finance')
        } finally {
            setReminderSendingId(null)
        }
    }

    const requestReminder = (item) => {
        const candidates = financeValidators.filter((validator) =>
            validator.unit.some((unit) => submitterUnits.includes(unit))
        )

        if (candidates.length === 0) {
            toast.error('Tidak ada Finance (Validator) yang terdaftar untuk Unit Bisnis Anda. Hubungi Admin.')
            return
        }

        if (submitterUnits.length <= 1) {
            candidates.forEach((validator) => send(item, validator))
            return
        }

        setPickerModal({ item, candidates })
    }

    const pickFinance = (validator) => {
        if (!pickerModal) return
        const { item } = pickerModal
        setPickerModal(null)
        send(item, validator)
    }

    const financePickerModal = pickerModal && ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={() => setPickerModal(null)}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg p-4 lg:p-6 max-w-md w-full mx-4 relative transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg md:text-xl font-semibold mb-1 md:mb-2 dark:text-gray-100">
                    Pilih Finance
                </h2>
                <p className="mb-3 text-gray-600 dark:text-gray-300 text-sm">
                    Anda terdaftar di lebih dari satu Unit Bisnis. Pilih Finance (Validator) yang akan menerima reminder untuk {pickerModal.item.displayId}:
                </p>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {pickerModal.candidates.map((validator) => (
                        <button
                            key={validator.uid}
                            className="w-full text-left px-4 py-2 rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => pickFinance(validator)}
                        >
                            <div className="font-medium">{validator.nama}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{validator.unit.join(', ')}</div>
                        </button>
                    ))}
                </div>
                <div className="flex justify-end mt-4">
                    <button
                        className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                        onClick={() => setPickerModal(null)}
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )

    return { reminderSendingId, requestReminder, financePickerModal }
}
