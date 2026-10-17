import React, { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPrint, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'

// Bagian BO: deteksi gambar dari nama objek di URL Storage (bukti pengembalian
// menyimpan nama file asli, mis. ".../lpj_pengembalian/LPJ.../struk.jpg").
const isImageUrl = (url) => {
    try {
        return /\.(jpe?g|png)$/i.test(decodeURIComponent(new URL(url).pathname))
    } catch (error) {
        return false
    }
}

// Gambar yang tampil di iframe tidak punya tombol print bawaan browser (beda
// dengan PDF yang punya toolbar viewer), jadi gambar dicetak lewat jendela
// kecil berisi <img> yang langsung memanggil print() setelah gambar termuat.
// PDF dibuka di tab baru -- viewer PDF browser punya tombol print sendiri,
// dan print() dari iframe lintas-domain (Firebase Storage) diblokir browser.
const printUrl = (url, title) => {
    if (!isImageUrl(url)) {
        window.open(url, '_blank', 'noopener')
        return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const safeTitle = String(title || 'Cetak').replace(/[<>&"]/g, '')
    printWindow.document.write(`<!doctype html><html><head><title>${safeTitle}</title>
        <style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center}img{max-width:100%;max-height:100vh;object-fit:contain}</style>
        </head><body><img id="print-img" alt="${safeTitle}"></body></html>`)
    printWindow.document.close()
    const img = printWindow.document.getElementById('print-img')
    img.onload = () => {
        printWindow.focus()
        printWindow.print()
    }
    img.src = url
}

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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 relative w-[90%] max-w-6xl h-[80vh] transition-colors">
                <div className="flex items-center justify-between w-full pb-1 md:pb-2 gap-2">
                    <h2 className="text-base md:text-lg font-semibold dark:text-gray-100 truncate">
                        {title || ''}
                    </h2>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => printUrl(previewUrl, title)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
                            title={isImageUrl(previewUrl) ? 'Cetak gambar ini' : 'Buka di tab baru untuk dicetak'}
                        >
                            <FontAwesomeIcon icon={isImageUrl(previewUrl) ? faPrint : faUpRightFromSquare} />
                            <span className="hidden md:inline">{isImageUrl(previewUrl) ? 'Print' : 'Buka / Print'}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-4xl leading-none"
                        >
                            &times;
                        </button>
                    </div>
                </div>

                <div className="overflow-auto border dark:border-gray-600 rounded-lg bg-white" style={{ height: 'calc(100% - 50px)' }}>
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
