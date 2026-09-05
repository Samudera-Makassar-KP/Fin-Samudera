// Adaptasi dari boilerplate resmi Create React App (cra-template-pwa) untuk
// mendaftarkan src/service-worker.js. Dengan ini, aplikasi bisa di-"Install"
// (Android/desktop Chrome) atau "Add to Home Screen" (iOS Safari) dan tetap
// bisa dibuka walau offline/koneksi jelek (app-shell dari precache).

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
)

export function register(config) {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
        return
    }

    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href)
    if (publicUrl.origin !== window.location.origin) {
        // Service worker tidak akan berfungsi kalau PUBLIC_URL beda origin
        // (mis. di-hosting lewat CDN terpisah) -- lihat dokumentasi CRA.
        return
    }

    window.addEventListener('load', () => {
        const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`

        if (isLocalhost) {
            checkValidServiceWorker(swUrl, config)
            navigator.serviceWorker.ready.then(() => {
                console.log('Aplikasi disajikan cache-first oleh service worker (mode localhost).')
            })
        } else {
            registerValidSW(swUrl, config)
        }
    })
}

function registerValidSW(swUrl, config) {
    navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
            registration.onupdatefound = () => {
                const installingWorker = registration.installing
                if (installingWorker == null) return

                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            console.log('Konten baru tersedia dan akan dipakai otomatis pada navigasi berikutnya.')
                            if (config?.onUpdate) config.onUpdate(registration)
                        } else {
                            console.log('Konten sudah di-cache untuk pemakaian offline.')
                            if (config?.onSuccess) config.onSuccess(registration)
                        }
                    }
                }
            }
        })
        .catch((error) => {
            console.error('Gagal mendaftarkan service worker:', error)
        })
}

function checkValidServiceWorker(swUrl, config) {
    fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
        .then((response) => {
            const contentType = response.headers.get('content-type')
            if (
                response.status === 404 ||
                (contentType != null && contentType.indexOf('javascript') === -1)
            ) {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.unregister().then(() => window.location.reload())
                })
            } else {
                registerValidSW(swUrl, config)
            }
        })
        .catch(() => {
            console.log('Tidak ada koneksi internet. Aplikasi berjalan mode offline.')
        })
}

export function unregister() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then((registration) => registration.unregister())
            .catch((error) => console.error(error.message))
    }
}
