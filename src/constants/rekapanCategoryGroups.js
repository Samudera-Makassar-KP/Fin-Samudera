// Pengelompokan kategori Rekapan non-BBM (Bagian AA) -- item/keterangan bebas teks
// (jenisReimbursement/namaItem) sering diisi variasi kata berbeda untuk maksud yang
// sama (mis. "Meeting", "Biaya Meeting", "Cemilan kue ruang meeting" semua sebenarnya
// biaya Meeting) -- sebelumnya tiap variasi jadi tabel/kategori Rekapan SENDIRI-SENDIRI,
// persis masalah free-text BBM jenis yang sudah dibereskan lewat canonicalJenisLabel
// di rekapanAggregation.js.
//
// Admin/Super Admin mendefinisikan grup lewat panel "Kelola Kategori"
// (RekapanUnitBisnis.jsx): pilih beberapa label mentah yang dianggap sama, kasih 1
// nama tampilan gabungan -- disimpan ke Firestore /rekapanCategoryGroups
// ({ label: string, members: string[] }). Item BARU yang keterangannya MENGANDUNG
// (substring, case-insensitive) salah satu member grup otomatis ikut tergabung tanpa
// perlu Admin approve ulang tiap kali muncul variasi baru (keputusan user: trade-off
// diterima, Admin tanggung jawab pilih member yang cukup spesifik supaya tidak salah
// gabung kategori yang sebenarnya beda).
export function canonicalizeCategoryLabel(rawLabel, groups) {
    if (!rawLabel) return rawLabel
    const lower = rawLabel.toLowerCase()
    const matchedGroup = (groups || []).find((group) =>
        (group.members || []).some((member) => member && lower.includes(member.toLowerCase()))
    )
    return matchedGroup ? matchedGroup.label : rawLabel
}
