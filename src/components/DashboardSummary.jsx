import React, { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebaseConfig'

const DashboardSummary = ({ uid }) => {
    const [summary, setSummary] = useState({
        jumlahBS: 0,
        nominalBS: 0,
        jumlahRbs: 0,
        nominalRbs: 0,
        totalSudahLpj: 0,
        jumlahBsSudahLpj: 0,
        jumlahBsBelumLpj: 0,
        selisih: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchSummary = async () => {
            if (!uid) {
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                const today = new Date()
                const currentMonth = today.getMonth()
                const currentYear = today.getFullYear()

                const isThisMonth = (dateString) => {
                    if (!dateString) return false
                    const d = new Date(dateString)
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
                }

                // Bon Sementara milik user, difilter ke bulan berjalan
                const bsSnapshot = await getDocs(
                    query(collection(db, 'bonSementara'), where('user.uid', '==', uid))
                )
                const bsAll = bsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                const bsThisMonth = bsAll.filter((item) => isThisMonth(item.tanggalPengajuan))
                const totalNominalBS = bsThisMonth.reduce(
                    (sum, item) => sum + (item.bonSementara?.[0]?.jumlahBS || 0),
                    0
                )

                // Reimbursement milik user, difilter ke bulan berjalan
                const rbsSnapshot = await getDocs(
                    query(collection(db, 'reimbursement'), where('user.uid', '==', uid))
                )
                const rbsAll = rbsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                const rbsThisMonth = rbsAll.filter((item) => isThisMonth(item.tanggalPengajuan))
                const totalNominalRbs = rbsThisMonth.reduce(
                    (sum, item) => sum + (item.totalBiaya || 0),
                    0
                )

                // Dari BS bulan ini, ambil yang sudah Disetujui (uang sudah cair)
                const bsDisetujui = bsThisMonth.filter((item) => item.status === 'Disetujui')
                const totalDisetujui = bsDisetujui.reduce(
                    (sum, item) => sum + (item.bonSementara?.[0]?.jumlahBS || 0),
                    0
                )

                // Cek status LPJ untuk tiap BS yang sudah disetujui
                let totalSudahLpj = 0
                let jumlahBsSudahLpj = 0
                for (const bs of bsDisetujui) {
                    if (!bs.displayId) continue
                    const lpjSnapshot = await getDocs(
                        query(collection(db, 'lpj'), where('nomorBS', '==', bs.displayId))
                    )
                    if (!lpjSnapshot.empty) {
                        const lpjData = lpjSnapshot.docs[0].data()
                        if (lpjData.status === 'Disetujui') {
                            totalSudahLpj += bs.bonSementara?.[0]?.jumlahBS || 0
                            jumlahBsSudahLpj += 1
                        }
                    }
                }
                const jumlahBsBelumLpj = bsDisetujui.length - jumlahBsSudahLpj

                setSummary({
                    jumlahBS: bsThisMonth.length,
                    nominalBS: totalNominalBS,
                    jumlahRbs: rbsThisMonth.length,
                    nominalRbs: totalNominalRbs,
                    totalSudahLpj,
                    jumlahBsSudahLpj,
                    jumlahBsBelumLpj,
                    selisih: totalDisetujui - totalSudahLpj
                })
            } catch (error) {
                console.error('Error fetching dashboard summary:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSummary()
    }, [uid])

    const formatRupiah = (value) => `Rp${(value || 0).toLocaleString('id-ID')}`

    const cards = [
        {
            label: 'Jumlah BS bulan ini',
            value: formatRupiah(summary.nominalBS),
            caption: `${summary.jumlahBS} pengajuan`,
            valueClass: 'text-gray-900',
            bgClass: 'bg-gray-50'
        },
        {
            label: 'Jumlah RBS bulan ini',
            value: formatRupiah(summary.nominalRbs),
            caption: `${summary.jumlahRbs} pengajuan`,
            valueClass: 'text-gray-900',
            bgClass: 'bg-gray-50'
        },
        {
            label: 'Sudah di-LPJ-kan',
            value: formatRupiah(summary.totalSudahLpj),
            caption: `${summary.jumlahBsSudahLpj} BS selesai LPJ`,
            valueClass: 'text-green-700',
            bgClass: 'bg-green-50'
        },
        {
            label: 'Selisih belum LPJ',
            value: formatRupiah(summary.selisih),
            caption:
                summary.jumlahBsBelumLpj > 0
                    ? `${summary.jumlahBsBelumLpj} BS belum dipertanggungjawabkan`
                    : 'Semua BS sudah dipertanggungjawabkan',
            valueClass: summary.selisih > 0 ? 'text-amber-700' : 'text-gray-900',
            bgClass: summary.selisih > 0 ? 'bg-amber-50' : 'bg-gray-50'
        }
    ]

    return (
        <div className="bg-white p-6 rounded-lg mb-6 shadow-sm">
            <h3 className="text-xl font-medium mb-4">Ringkasan bulan ini</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <div key={card.label} className={`rounded-lg p-4 ${card.bgClass}`}>
                        <p className="text-sm text-gray-500 mb-2">{card.label}</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
                        ) : (
                            <>
                                <p className={`text-2xl font-semibold ${card.valueClass}`}>{card.value}</p>
                                {card.caption && (
                                    <p className="text-xs text-gray-400 mt-1">{card.caption}</p>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default DashboardSummary