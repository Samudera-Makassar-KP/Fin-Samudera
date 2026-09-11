import React from 'react'
import ReactDOM from 'react-dom/client'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)

// Bagian AY: sebelumnya `register()` dipanggil TANPA config sama sekali --
// service-worker.js SUDAH pakai skipWaiting()+clientsClaim() supaya versi
// baru langsung aktif begitu selesai install, TAPI itu cuma membuat request
// JARINGAN berikutnya dari tab ini lewat SW baru -- kode JS yang SUDAH
// TERLANJUR jalan di memori tab (bundle lama) TIDAK ikut berubah sampai
// tab-nya benar-benar di-reload. Sebelum ini, tidak ada tanda apa pun ke user
// kalau versi baru sudah tersedia (cuma console.log yang tidak pernah
// dilihat) -- user bisa terus memakai tab lama BERHARI-HARI tanpa sadar,
// dan begitu ada perubahan yang mengunci jalur lama (mis. Bagian AW,
// storage.rules diperketat), tab lama itu mendadak gagal dengan cara yang
// membingungkan (error yang terlihat baru padahal cuma karena kode lama
// dijalankan lawan backend yang sudah berubah). Sekarang begitu versi baru
// terdeteksi, muncul toast PERSISTEN (tidak auto-close) yang bisa diklik
// untuk reload -- tidak dipaksa reload otomatis supaya tidak mengganggu
// isian form yang sedang diketik user.
serviceWorkerRegistration.register({
    onUpdate: () => {
        toast.info('Versi baru aplikasi tersedia -- klik pesan ini untuk muat ulang.', {
            autoClose: false,
            closeOnClick: false,
            onClick: () => window.location.reload()
        })
    }
})
