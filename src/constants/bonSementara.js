// Bagian BO: permintaan SMDR-Finance -- BS dengan total nominal DI ATAS angka
// ini wajib menyertakan lampiran pendukung (penawaran/invoice/dsb). Di bawah
// atau sama dengan angka ini, kolom lampiran tidak ditampilkan sama sekali.
export const BS_LAMPIRAN_THRESHOLD = 3000000

export const getBsTotal = (bonSementaraItems = []) =>
    bonSementaraItems.reduce((total, item) => {
        const raw = typeof item?.jumlahBS === 'number'
            ? item.jumlahBS
            : Number(String(item?.jumlahBS ?? '').replace(/[^,\d]/g, '').replace(',', '.')) || 0
        return total + raw
    }, 0)

export const requiresBsLampiran = (bonSementaraItems = []) =>
    getBsTotal(bonSementaraItems) > BS_LAMPIRAN_THRESHOLD
