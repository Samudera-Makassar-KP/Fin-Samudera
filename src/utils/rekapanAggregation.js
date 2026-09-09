// Util agregasi untuk menu Rekapan (lihat SUMMARY_PENGEMBANGAN.md Bagian A).
// Fungsi murni, tidak menyentuh Firestore -- data mentah diambil di komponen
// (RekapanUnitBisnis.jsx), lalu diagregasi di sini.

import { BBM_PRICE_PER_LITER } from '../constants/bbmPrice'
import { canonicalizeCategoryLabel } from '../constants/rekapanCategoryGroups'

export const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

const MONTH_COUNT = 12

export const formatRupiah = (value) => `Rp${Math.round(value || 0).toLocaleString('id-ID')}`

export const emptyMonths = () => Array(MONTH_COUNT).fill(0)

export const sumMonths = (months) => (months || []).reduce((total, value) => total + (value || 0), 0)

const parseDateParts = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return null
    return { month: date.getMonth(), year: date.getFullYear() }
}

// Item reimbursement punya field `tanggal` (tanggal aktivitas) per item -- itu basis
// tanggal yang dipakai. `doc.tanggalPengajuan` cuma fallback kalau `tanggal` kosong/rusak.
export const resolveReimbursementItemDate = (item, doc) =>
    parseDateParts(item?.tanggal) || parseDateParts(doc?.tanggalPengajuan)

// PENTING: item `lpj` TIDAK PUNYA field tanggal per item sama sekali (dikonfirmasi dari
// struktur FormLpjUmum.jsx & FormLpjMarketing.jsx) -- satu-satunya basis tanggal yang
// tersedia untuk LPJ adalah `tanggalPengajuan` di level dokumen. Ini keterbatasan data,
// bukan bug: rekap LPJ dikelompokkan per tanggal submit, bukan tanggal aktivitas asli.
export const resolveLpjDocDate = (doc) => parseDateParts(doc?.tanggalPengajuan)

const matchesUnitFilter = (unit, units) => !units || units.length === 0 || units.includes(unit)

// Semua jenis/namaItem BBM (RBS BBM, RBS Operasional, RBS Umum, LPJ Umum, LPJ Marketing)
// selalu diberi prefix "BBM " di form-nya masing-masing -- dipakai untuk mengecualikan
// item BBM dari rekap kategori umum (`aggregateByCategory`) dan menariknya semua ke
// rekap khusus BBM (`aggregateBbm`), TERLEPAS dari `kategori` di level dokumen (dokumen
// Operasional/GA-Umum/LPJ bisa berisi campuran item BBM & non-BBM dalam satu pengajuan).
const isBbmValue = (value) => typeof value === 'string' && value.startsWith('BBM ')

// Sebagian transaksi LAMA diisi bebas di field jenis/namaItem (mis. "BBM 1273
// XBO 04/07/26" -- plat + tanggal diketik manual sebagai teks, bukan lewat
// field `plat` yang baru ada belakangan) -- tetap valid sebagai BBM
// (isBbmValue di atas), TAPI kalau dipakai apa adanya sebagai kunci breakdown
// `byJenis`, tiap transaksi jadi kategori sendiri-sendiri (banjir di dropdown
// filter "Tampilkan Rekapan"). Dikanonisasi ke salah satu jenis BBM baku
// (BBM_PRICE_PER_LITER) kalau cocok, selain itu digabung jadi "BBM Lainnya".
const canonicalJenisLabel = (jenis) => {
    if (jenis && Object.prototype.hasOwnProperty.call(BBM_PRICE_PER_LITER, jenis)) return jenis
    return 'BBM Lainnya'
}

// Kunci unik per baris/item BBM di dalam dokumen reimbursement/lpj (item tidak
// punya id sendiri, cuma posisi di array) -- dipakai sebagai doc ID di koleksi
// Firestore `rekapanBbmSharing` (lihat RekapanUnitBisnis.jsx, panel "Kelola
// Sharing BBM") supaya Admin bisa menandai SATU baris tertentu "dibagi" atau
// tidak, tanpa menyentuh dokumen reimbursement/lpj aslinya sama sekali.
export const buildBbmItemKey = (docType, docId, itemIndex) => `${docType}_${docId}_${itemIndex}`

/**
 * Rekap per kategori (ATK, RTG, RTK, Entertaint, Parkir, Meals Lembur, Meals Meeting, Toll,
 * Lainnya, dst) dari `reimbursement` dan `lpj` -- item berjenis BBM dikecualikan di sini,
 * ditangani `aggregateBbm` supaya tidak dihitung dua kali. Kategori Entertaint/Meals Lembur/
 * Parkir digabung lintas RBS Operasional & RBS Umum/LPJ (bukan dipisah per asal form) --
 * lihat catatan asumsi di rencana pengembangan.
 *
 * `categoryGroups` (opsional, Bagian AA): array `{ label, members }[]` dari koleksi
 * Firestore `rekapanCategoryGroups` -- label mentah (`item.jenis`/`item.namaItem`)
 * yang mengandung salah satu `members` grup dikanonisasi jadi `group.label` sebelum
 * dipakai sebagai key kategori, supaya beberapa variasi teks (mis. "Meeting",
 * "Biaya Meeting", "Cemilan kue ruang meeting") menyatu jadi SATU baris/tabel per
 * Unit Bisnis, bukan tabel terpisah per variasi. Lihat canonicalizeCategoryLabel di
 * src/constants/rekapanCategoryGroups.js. Tanpa `categoryGroups`, perilaku sama
 * seperti sebelumnya (tiap label mentah jadi kategori sendiri).
 *
 * `sharingClassification`/`defaultPoolShares` (opsional, Bagian AC): sama persis
 * mekanismenya dengan `aggregateBbm` -- per BARIS (bukan blanket per kategori/unit),
 * ditandai manual oleh Admin/Super Admin lewat panel "Kelola Sharing" (key = sama
 * `buildBbmItemKey(docType, docId, itemIndex)`, koleksi Firestore `rekapanBbmSharing`
 * yang SAMA dipakai lintas kategori -- key sudah unik per item apa pun kategorinya,
 * tidak ada tabrakan). Baris tanpa entry tetap 100% ke unit pengaju (default aman).
 * Baris `dikecualikan` tidak muncul sama sekali. Baris `dibagi` displit ke unit lain
 * (pool default atau custom), diproses UNCONDITIONAL (termasuk dokumen yang difilter
 * dari tampilan lewat `units`) supaya unit tujuan share tetap dapat porsinya --
 * filter `units` baru diterapkan ke HASIL AKHIR, sama pola dengan `aggregateBbm`.
 *
 * @returns {{ [kategori: string]: { [unit: string]: number[] } }}
 */
export function aggregateByCategory(reimbursementDocs, lpjDocs, { year, units, categoryGroups, sharingClassification, defaultPoolShares } = {}) {
    const result = {}

    const addToResult = (category, unit, month, amount) => {
        if (!category || !unit || month == null || !amount) return
        if (!result[category]) result[category] = {}
        if (!result[category][unit]) result[category][unit] = emptyMonths()
        result[category][unit][month] += amount
    }

    const processItem = (docType, docId, itemIndex, category, unit, month, amount) => {
        const classification = sharingClassification?.[buildBbmItemKey(docType, docId, itemIndex)]
        if (classification?.dikecualikan) return

        if (classification?.dibagi) {
            const shares = (classification.splitMode === 'custom' && classification.customShares)
                ? classification.customShares
                : defaultPoolShares

            if (shares && Object.keys(shares).length > 0) {
                Object.entries(shares).forEach(([unitName, pct]) => {
                    addToResult(category, unitName, month, amount * ((pct || 0) / 100))
                })
                return
            }
        }

        addToResult(category, unit, month, amount)
    }

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit

        ;(doc.reimbursements || []).forEach((item, itemIndex) => {
            if (isBbmValue(item.jenis)) return
            const dateParts = resolveReimbursementItemDate(item, doc)
            if (!dateParts || dateParts.year !== year) return
            const category = canonicalizeCategoryLabel(item.jenis, categoryGroups)
            processItem('reimbursement', doc.id, itemIndex, category, unit, dateParts.month, item.biaya || 0)
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit

        const dateParts = resolveLpjDocDate(doc)
        if (!dateParts || dateParts.year !== year) return

        ;(doc.lpj || []).forEach((item, itemIndex) => {
            if (isBbmValue(item.namaItem)) return
            const jumlahBiaya = item.jumlahBiaya ?? (Number(item.biaya) || 0) * (Number(item.jumlah) || 0)
            const category = canonicalizeCategoryLabel(item.namaItem, categoryGroups)
            processItem('lpj', doc.id, itemIndex, category, unit, dateParts.month, jumlahBiaya)
        })
    })

    if (units && units.length > 0) {
        Object.keys(result).forEach((category) => {
            Object.keys(result[category]).forEach((unitName) => {
                if (!matchesUnitFilter(unitName, units)) delete result[category][unitName]
            })
        })
    }

    return result
}

/**
 * Daftar MENTAH (bukan dikanonisasi) semua label kategori non-BBM (`item.jenis`/
 * `item.namaItem`) yang pernah dipakai di `reimbursement`/`lpj` yang Disetujui --
 * unik & terurut abjad, TIDAK difilter tahun/unit (Admin perlu lihat semua variasi
 * yang pernah ada untuk membuat grup). Dipakai panel "Kelola Kategori" di
 * RekapanUnitBisnis.jsx sebagai daftar pilihan checkbox saat membuat/menambah
 * anggota grup (lihat canonicalizeCategoryLabel).
 *
 * @returns {string[]}
 */
export function listCategoryRawLabels(reimbursementDocs, lpjDocs) {
    const labels = new Set()

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        ;(doc.reimbursements || []).forEach((item) => {
            if (isBbmValue(item.jenis) || !item.jenis) return
            labels.add(item.jenis)
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        ;(doc.lpj || []).forEach((item) => {
            if (isBbmValue(item.namaItem) || !item.namaItem) return
            labels.add(item.namaItem)
        })
    })

    return Array.from(labels).sort((a, b) => a.localeCompare(b))
}

// Nomor plat yang sama sering diketik beda-beda (spasi lebih/kurang) di
// keterangan -- dinormalisasi (huruf besar, semua spasi dibuang) supaya jadi
// SATU baris rekap, bukan tercecer. Hasil normalisasi juga dipakai sebagai
// label tampilan (diformat ulang jadi "AB 1234 CD" kalau cocok pola plat
// Indonesia umum, kalau tidak cocok ditampilkan apa adanya tanpa spasi).
export const normalizePlatKey = (rawPlat) => {
    if (!rawPlat) return null
    return rawPlat.toString().trim().toUpperCase().replace(/\s+/g, '')
}

export const formatPlatDisplay = (normalizedKey) => {
    if (!normalizedKey) return normalizedKey
    const match = normalizedKey.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/)
    if (!match) return normalizedKey
    return [match[1], match[2], match[3]].filter(Boolean).join(' ')
}

/**
 * Rekap khusus BBM: total Rupiah per unit per bulan, breakdown per jenis BBM
 * (Pertalite/Pertamax/Pertamax Turbo/Solar/Dexlite), plus drill-down per plat
 * nomor (liter & Rupiah, plat dinormalisasi -- lihat normalizePlatKey). Menarik
 * item BBM dari SEMUA sumber -- `reimbursement` (RBS BBM, RBS Operasional, RBS
 * Umum) dan `lpj` (LPJ Umum, LPJ Marketing) -- dikenali dari prefix "BBM " pada
 * `item.jenis`/`item.namaItem`, bukan cuma dokumen dengan `kategori === 'BBM'`.
 *
 * Di LPJ, `item.biaya` adalah harga satuan (per liter) & `item.jumlah` adalah kuantitas
 * (liter) -- total Rupiah aktualnya `item.jumlahBiaya` (biaya x jumlah), BUKAN `item.biaya`
 * itu sendiri. Di `reimbursement`, `item.biaya` sudah berupa total Rupiah & `item.liter`
 * sudah berupa liter langsung -- keduanya tidak perlu dihitung ulang.
 *
 * Sharing (Bagian U): sejak ini, TIDAK ADA lagi redistribusi otomatis-blanket
 * untuk semua BBM 1 unit -- setiap BARIS BBM dicek satu-satu lewat
 * `sharingClassification` (opsional): { [buildBbmItemKey(...)]: { dibagi:
 * boolean, splitMode: 'pool'|'custom', customShares?: {[unit]: persen},
 * dikecualikan?: boolean } }, data dari koleksi Firestore `rekapanBbmSharing`
 * (diisi manual Admin/Super Admin lewat panel "Kelola Sharing BBM" -- lihat
 * RekapanUnitBisnis.jsx). Baris yang BELUM diklasifikasi (tidak ada entry)
 * defaultnya TETAP 100% ke unit pengaju -- TIDAK ada asumsi "otomatis dibagi"
 * lagi (beda dari versi pertama Bagian T yang keliru: MJS di-share 100%-nya
 * secara blanket, padahal kenyataannya cuma sebagian transaksi yang genuinely
 * dibagi ke unit lain).
 *
 * Baris yang `dibagi: true` displit ke `defaultPoolShares` (persentase pool
 * "All Employee" dari computeAllEmployeeShares(), sama untuk semua baris yang
 * pakai splitMode 'pool') KECUALI baris itu punya `customShares` sendiri
 * (splitMode 'custom' -- persentase spesifik cuma untuk baris/plat itu).
 *
 * Baris yang `dikecualikan: true` (Bagian V) TIDAK MUNCUL SAMA SEKALI di
 * Rekapan -- beda dari "tidak dibagi" (yang tetap tampil 100% di unit
 * pengaju). Dipakai untuk BBM yang sebenarnya di luar scope Biaya GA (mis.
 * kendaraan operasional/project yang kebetulan disubmit lewat form GA/Umum).
 * `dikecualikan` diprioritaskan di atas `dibagi` -- tidak ikut `totals`
 * MAUPUN `byPlat`/`byJenis` sama sekali.
 *
 * `byPlat`/`byJenis` TIDAK ikut sharing (redistribusi) -- selalu murni data
 * submission asli per unit pengaju, cuma `totals` yang kena redistribusi.
 * Keduanya TETAP ikut aturan `dikecualikan` (dibuang sama sekali).
 *
 * @returns {{ totals: object, byJenis: object, byPlat: { [plat: string]: { liter: number[], biaya: number[] } } }}
 */
export function aggregateBbm(reimbursementDocs, lpjDocs, { year, units, sharingClassification, defaultPoolShares } = {}) {
    const totals = {}
    const byPlat = {}
    const byJenis = {}

    const addToTotals = (unitName, month, amount) => {
        if (!amount) return
        if (!totals[unitName]) totals[unitName] = emptyMonths()
        totals[unitName][month] += amount
    }

    // includeInDrilldown: false kalau dokumen ini difilter dari tampilan (unit
    // lain), TAPI baris tetap diproses untuk `totals` supaya unit yang difilter
    // ke tampilan tetap dapat porsi share-nya kalau baris ini ditandai "dibagi".
    const processItem = ({ docType, docId, itemIndex, unit, month, jenis, plat, liter, biayaTotal, includeInDrilldown }) => {
        const classification = sharingClassification?.[buildBbmItemKey(docType, docId, itemIndex)]

        // Dikecualikan: TIDAK muncul sama sekali di Rekapan (beda dari "tidak
        // dibagi", yang tetap tampil 100% di unit pengaju) -- dipakai untuk BBM
        // yang memang di luar scope Biaya GA (mis. kendaraan operasional/project
        // yang kebetulan disubmit lewat form GA/Umum). Tidak ikut totals MAUPUN
        // byPlat/byJenis.
        if (classification?.dikecualikan) return

        if (includeInDrilldown) {
            const jenisLabel = canonicalJenisLabel(jenis)
            if (!byJenis[jenisLabel]) byJenis[jenisLabel] = {}
            if (!byJenis[jenisLabel][unit]) byJenis[jenisLabel][unit] = emptyMonths()
            byJenis[jenisLabel][unit][month] += biayaTotal

            const platKey = formatPlatDisplay(normalizePlatKey(plat)) || 'Tidak diketahui'
            if (!byPlat[platKey]) byPlat[platKey] = { liter: emptyMonths(), biaya: emptyMonths() }
            byPlat[platKey].liter[month] += liter
            byPlat[platKey].biaya[month] += biayaTotal
        }

        if (classification?.dibagi) {
            const shares = (classification.splitMode === 'custom' && classification.customShares)
                ? classification.customShares
                : defaultPoolShares

            if (shares && Object.keys(shares).length > 0) {
                Object.entries(shares).forEach(([unitName, pct]) => {
                    addToTotals(unitName, month, biayaTotal * ((pct || 0) / 100))
                })
                return
            }
        }

        addToTotals(unit, month, biayaTotal)
    }

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        const includeInDrilldown = matchesUnitFilter(unit, units)

        ;(doc.reimbursements || []).forEach((item, itemIndex) => {
            if (!isBbmValue(item.jenis)) return
            const dateParts = resolveReimbursementItemDate(item, doc)
            if (!dateParts || dateParts.year !== year) return
            processItem({
                docType: 'reimbursement',
                docId: doc.id,
                itemIndex,
                unit,
                month: dateParts.month,
                jenis: item.jenis,
                plat: item.plat,
                liter: item.liter || 0,
                biayaTotal: item.biaya || 0,
                includeInDrilldown
            })
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        const includeInDrilldown = matchesUnitFilter(unit, units)

        const dateParts = resolveLpjDocDate(doc)
        if (!dateParts || dateParts.year !== year) return

        ;(doc.lpj || []).forEach((item, itemIndex) => {
            if (!isBbmValue(item.namaItem)) return
            const liter = Number(item.jumlah) || 0
            const biayaTotal = item.jumlahBiaya ?? (Number(item.biaya) || 0) * liter
            processItem({
                docType: 'lpj',
                docId: doc.id,
                itemIndex,
                unit,
                month: dateParts.month,
                jenis: item.namaItem,
                plat: item.plat,
                liter,
                biayaTotal,
                includeInDrilldown
            })
        })
    })

    // Baris "dibagi" diproses UNCONDITIONALLY di atas (termasuk dari dokumen
    // yang difilter dari tampilan) supaya unit hasil share tetap benar --
    // filter `units` baru diterapkan ke HASIL AKHIR `totals` di sini.
    if (units && units.length > 0) {
        Object.keys(totals).forEach((unitName) => {
            if (!matchesUnitFilter(unitName, units)) delete totals[unitName]
        })
    }

    return { totals, byJenis, byPlat }
}

/**
 * Daftar MENTAH (bukan agregat) semua baris/item BBM dari reimbursement+lpj
 * yang Disetujui, TIDAK difilter per unit (Admin perlu lihat semua unit untuk
 * mengklasifikasi) -- dipakai panel "Kelola Sharing BBM" di RekapanUnitBisnis.jsx
 * supaya Admin/Super Admin bisa tandai satu-satu baris mana yang genuinely
 * dibagi ke unit lain. `key` di tiap item = buildBbmItemKey(...), cocok
 * dengan doc ID di koleksi Firestore `rekapanBbmSharing`.
 *
 * @returns {Array<{ key: string, docType: string, docId: string, itemIndex: number, unit: string, month: number, jenis: string, plat: string, biayaTotal: number }>}
 */
export function listBbmLineItems(reimbursementDocs, lpjDocs, { year } = {}) {
    const items = []

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit

        ;(doc.reimbursements || []).forEach((item, itemIndex) => {
            if (!isBbmValue(item.jenis)) return
            const dateParts = resolveReimbursementItemDate(item, doc)
            if (!dateParts || dateParts.year !== year) return
            items.push({
                key: buildBbmItemKey('reimbursement', doc.id, itemIndex),
                docType: 'reimbursement',
                docId: doc.id,
                itemIndex,
                unit,
                month: dateParts.month,
                category: 'BBM',
                jenis: item.jenis,
                plat: formatPlatDisplay(normalizePlatKey(item.plat)) || 'Tidak diketahui',
                biayaTotal: item.biaya || 0
            })
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        const dateParts = resolveLpjDocDate(doc)
        if (!dateParts || dateParts.year !== year) return

        ;(doc.lpj || []).forEach((item, itemIndex) => {
            if (!isBbmValue(item.namaItem)) return
            const liter = Number(item.jumlah) || 0
            const biayaTotal = item.jumlahBiaya ?? (Number(item.biaya) || 0) * liter
            items.push({
                key: buildBbmItemKey('lpj', doc.id, itemIndex),
                docType: 'lpj',
                docId: doc.id,
                itemIndex,
                unit,
                month: dateParts.month,
                category: 'BBM',
                jenis: item.namaItem,
                plat: formatPlatDisplay(normalizePlatKey(item.plat)) || 'Tidak diketahui',
                biayaTotal
            })
        })
    })

    return items.sort((a, b) => a.month - b.month)
}

/**
 * Daftar MENTAH (bukan agregat) semua baris/item NON-BBM dari reimbursement+lpj
 * yang Disetujui DAN kategorinya (setelah dikanonisasi lewat `categoryGroups`,
 * lihat canonicalizeCategoryLabel) ada di `categories` -- dipakai panel "Kelola
 * Sharing" (Bagian AC) supaya mekanisme dibagi/dikecualikan/split yang sebelumnya
 * cuma ada untuk BBM juga bisa dipakai untuk kategori lain (mis. RTK, RTG).
 * `key` SAMA formatnya dengan `listBbmLineItems` (`buildBbmItemKey`) dan disimpan
 * di koleksi Firestore YANG SAMA (`rekapanBbmSharing`) -- key sudah unik per
 * docType+docId+itemIndex, tidak ada tabrakan antar kategori/BBM walau 1 dokumen
 * bisa berisi campuran item BBM & non-BBM di array yang sama.
 *
 * `plat` selalu `null` (konsep plat nomor tidak relevan untuk kategori non-BBM),
 * disertakan supaya bentuk objeknya kompatibel dengan `renderClassificationRow`
 * yang dipakai bareng dengan item BBM.
 *
 * @returns {Array<{ key: string, docType: string, docId: string, itemIndex: number, unit: string, month: number, category: string, jenis: string, plat: null, biayaTotal: number }>}
 */
export function listCategoryLineItems(reimbursementDocs, lpjDocs, { year, categoryGroups, categories } = {}) {
    const wantedCategories = categories || []
    if (wantedCategories.length === 0) return []

    const items = []

    ;(reimbursementDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit

        ;(doc.reimbursements || []).forEach((item, itemIndex) => {
            if (isBbmValue(item.jenis) || !item.jenis) return
            const category = canonicalizeCategoryLabel(item.jenis, categoryGroups)
            if (!wantedCategories.includes(category)) return
            const dateParts = resolveReimbursementItemDate(item, doc)
            if (!dateParts || dateParts.year !== year) return
            items.push({
                key: buildBbmItemKey('reimbursement', doc.id, itemIndex),
                docType: 'reimbursement',
                docId: doc.id,
                itemIndex,
                unit,
                month: dateParts.month,
                category,
                jenis: item.jenis,
                plat: null,
                biayaTotal: item.biaya || 0
            })
        })
    })

    ;(lpjDocs || []).forEach((doc) => {
        if (doc.status !== 'Disetujui') return
        const unit = doc.user?.unit
        const dateParts = resolveLpjDocDate(doc)
        if (!dateParts || dateParts.year !== year) return

        ;(doc.lpj || []).forEach((item, itemIndex) => {
            if (isBbmValue(item.namaItem) || !item.namaItem) return
            const category = canonicalizeCategoryLabel(item.namaItem, categoryGroups)
            if (!wantedCategories.includes(category)) return
            const jumlahBiaya = item.jumlahBiaya ?? (Number(item.biaya) || 0) * (Number(item.jumlah) || 0)
            items.push({
                key: buildBbmItemKey('lpj', doc.id, itemIndex),
                docType: 'lpj',
                docId: doc.id,
                itemIndex,
                unit,
                month: dateParts.month,
                category,
                jenis: item.namaItem,
                plat: null,
                biayaTotal: jumlahBiaya
            })
        })
    })

    return items.sort((a, b) => a.month - b.month)
}
