import React, { useEffect } from 'react'

const ModalPDF = ({ showModal, previewUrl, onClose, title }) => {
    useEffect(() => {
        if (showModal) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }

        return () => {
            document.body.style.overflow = ''
        }
    }, [showModal])

    if (!showModal) return null

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose()
                }
            }}
            style={{ width: '100%', height: '100%' }}
        >
            <div className="bg-white rounded-lg shadow-lg p-4 relative w-[90%] max-w-6xl h-[80vh]">
                <div className="flex items-center justify-between w-full pb-1 md:pb-2">
                    <h2 className="text-base md:text-lg font-semibold">
                        {title || ''}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 text-4xl"
                    >
                        &times;
                    </button>
                </div>

                <div className="overflow-auto border rounded-lg" style={{ height: 'calc(100% - 50px)' }}>
                    <iframe
                        src={`${previewUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                        width="100%"
                        height="100%"
                        title="Lihat Lampiran"
                        style={{ border: 'none' }}
                    />
                </div>
            </div>
        </div>
    )
}

export default ModalPDF
