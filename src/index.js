import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)

// Daftarkan service worker supaya aplikasi bisa di-install (Android/desktop)
// atau Add to Home Screen (iOS) dan tetap terbuka saat offline/koneksi jelek.
serviceWorkerRegistration.register()
