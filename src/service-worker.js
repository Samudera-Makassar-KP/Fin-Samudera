/* eslint-disable no-restricted-globals */

// File ini dikompilasi otomatis oleh react-scripts (workbox-webpack-plugin
// InjectManifest, aktif kalau src/service-worker.js ada -- lihat webpack.config.js
// react-scripts) jadi service worker asli, dipasang lewat
// src/serviceWorkerRegistration.js. Precache list (self.__WB_MANIFEST) diisi
// otomatis saat build, JANGAN dihapus meski terlihat seperti variabel kosong.

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

// Deploy di aplikasi ini sering & sifatnya bisa kritis (hotfix produksi) --
// service worker baru langsung ambil alih begitu selesai install (skipWaiting +
// clientsClaim), supaya reload/navigasi berikutnya pasti dapat build terbaru,
// tanpa perlu user menutup SEMUA tab dulu (perilaku default workbox tanpa ini).
clientsClaim()
self.skipWaiting()

precacheAndRoute(self.__WB_MANIFEST)

// Navigasi (klik link/refresh) untuk rute non-file (react-router) selalu
// dikembalikan ke index.html yang di-cache -- app tetap bisa dibuka walau
// sedang offline/koneksi jelek, konsisten dengan pola SPA routing yang dipakai.
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$')
registerRoute(
    ({ request, url }) => {
        if (request.mode !== 'navigate') return false
        if (url.pathname.startsWith('/_')) return false
        if (url.pathname.match(fileExtensionRegexp)) return false
        return true
    },
    createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
)

// Gambar/asset statis same-origin (logo, ikon dll) -- stale-while-revalidate
// supaya tetap kebuka cepat dari cache tapi otomatis diperbarui di background.
// TIDAK berlaku untuk request ke Firebase (Firestore/Storage/Functions/Auth)
// karena origin-nya beda, jadi data live tidak pernah ke-cache lewat rule ini.
registerRoute(
    ({ url }) => url.origin === self.location.origin && /\.(?:png|jpg|jpeg|svg|gif|webp)$/.test(url.pathname),
    new StaleWhileRevalidate({
        cacheName: 'images',
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })]
    })
)
