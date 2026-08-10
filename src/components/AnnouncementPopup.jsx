import React, { useState, useEffect } from 'react'
import { db } from '../firebaseConfig'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'

const DISMISSED_KEY = 'dismissedAnnouncementId'

const AnnouncementPopup = () => {
    const [announcement, setAnnouncement] = useState(null)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const fetchLatestAnnouncement = async () => {
            try {
                const q = query(
                    collection(db, 'announcements'),
                    where('active', '==', true),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                )
                const snapshot = await getDocs(q)

                if (snapshot.empty) return

                const doc = snapshot.docs[0]
                const data = { id: doc.id, ...doc.data() }

                const dismissedId = localStorage.getItem(DISMISSED_KEY)
                if (dismissedId !== data.id) {
                    setAnnouncement(data)
                    setIsOpen(true)
                }
            } catch (error) {
                console.error('Error fetching announcement:', error)
            }
        }

        fetchLatestAnnouncement()
    }, [])

    const handleClose = () => {
        if (announcement?.id) {
            localStorage.setItem(DISMISSED_KEY, announcement.id)
        }
        setIsOpen(false)
    }

    if (!isOpen || !announcement) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] px-4">
            <div className="relative max-w-sm w-full">
                <button
                    onClick={handleClose}
                    className="absolute -top-3 -right-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black text-white hover:bg-gray-800"
                    title="Tutup"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-5 h-5"
                    >
                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                </button>
                <div className="rounded-2xl overflow-hidden shadow-xl">
                    <img
                        src={announcement.imageUrl}
                        alt="Pengumuman"
                        className="w-full h-auto object-cover"
                    />
                </div>
            </div>
        </div>
    )
}

export default AnnouncementPopup