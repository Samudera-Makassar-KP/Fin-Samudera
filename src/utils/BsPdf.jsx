import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer'
import { doc, getDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebaseConfig'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

Font.register({
    family: 'Poppins',
    fonts: [
        { src: require('../assets/fonts/Poppins-Regular.ttf') },
        { src: require('../assets/fonts/Poppins-SemiBold.ttf'), fontWeight: 'semibold' },
        { src: require('../assets/fonts/Poppins-Bold.ttf'), fontWeight: 'bold' },
        { src: require('../assets/fonts/Poppins-Italic.ttf'), fontStyle: 'italic' }
    ]
})

const styles = StyleSheet.create({
    page: {
        padding: 24,
        fontFamily: 'Poppins'
    },
    title: {
        fontSize: 20,
        textAlign: 'center',
        marginBottom: 20
    },
    header: {
        marginBottom: 8,
        fontSize: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        textTransform: 'uppercase'
    },
    tableContainer: {
        border: 1,
        borderColor: '#000'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomColor: '#000',
        borderBottomWidth: 1,
        alignItems: 'center'
    },
    tableHeader: {
        textAlign: 'center'
    },
    tableHeaderCell: {
        fontSize: 8,
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightColor: '#000',
        borderRightWidth: 1,
        height: '100%'
    },
    tableCell: {
        fontSize: 8,
        padding: 4,
        borderRightColor: '#000',
        borderRightWidth: 1,
        height: '100%',
        justifyContent: 'center'
    },
    footer: {
        marginTop: 8,
        fontSize: 8,
        padding: 4
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 32,
        paddingVertical: 0
    }
})

const getApprovedReviewerNames = async (bonSementaraDetail) => {
    if (!bonSementaraDetail || !bonSementaraDetail.statusHistory) {
        return { reviewer1Name: '-', reviewer2Name: '-' }
    }

    const { statusHistory } = bonSementaraDetail

    // Cek apakah Super Admin menggantikan kedua reviewer
    const superAdminForReviewer1 = statusHistory.find(history =>
        history.status.toLowerCase().includes('disetujui oleh super admin (pengganti reviewer 1)')
    )
    const superAdminForReviewer2 = statusHistory.find(history =>
        history.status.toLowerCase().includes('disetujui oleh super admin (pengganti reviewer 2)')
    )

    // Jika Super Admin menggantikan kedua reviewer, langsung return Super Admin
    if (superAdminForReviewer1 && superAdminForReviewer2) {
        return { reviewer1Name: 'Super Admin', reviewer2Name: '' }
    }

    // Cek approval untuk reviewer 1
    const reviewer1Approval = statusHistory.find(
        (history) =>
            history.status.toLowerCase().includes('disetujui oleh super admin (pengganti reviewer 1)') ||
            history.status.toLowerCase().includes('disetujui oleh reviewer 1')
    )

    // Cek approval untuk reviewer 2
    const reviewer2Approval = statusHistory.find(
        (history) =>
            history.status.toLowerCase().includes('disetujui oleh super admin (pengganti reviewer 2)') ||
            history.status.toLowerCase().includes('disetujui oleh reviewer 2')
    )

    let reviewer1Name = '-'
    let reviewer2Name = '-'

    // Set nama untuk reviewer 1
    if (reviewer1Approval) {
        if (reviewer1Approval.status.toLowerCase().includes('super admin')) {
            reviewer1Name = 'Super Admin'
        } else {
            try {
                const reviewer1DocRef = doc(db, 'users', reviewer1Approval.actor)
                const reviewer1Snapshot = await getDoc(reviewer1DocRef)
                if (reviewer1Snapshot.exists()) {
                    reviewer1Name = reviewer1Snapshot.data().nama
                }
            } catch (error) {
                console.error('Error fetching reviewer 1 name:', error)
            }
        }
    }

    // Set nama untuk reviewer 2
    if (reviewer2Approval) {
        if (reviewer2Approval.status.toLowerCase().includes('super admin')) {
            reviewer2Name = 'Super Admin'
        } else {
            try {
                const reviewer2DocRef = doc(db, 'users', reviewer2Approval.actor)
                const reviewer2Snapshot = await getDoc(reviewer2DocRef)
                if (reviewer2Snapshot.exists()) {
                    reviewer2Name = reviewer2Snapshot.data().nama
                }
            } catch (error) {
                console.error('Error fetching reviewer 2 name:', error)
            }
        }
    }

    // Jika reviewer2 tidak ada atau kosong
    if (reviewer2Name === '-' && reviewer1Name !== '-') {
        return { reviewer1Name, reviewer2Name: '' }
    }

    // Jika reviewer1 tidak ada atau kosong
    if (reviewer1Name === '-' && reviewer2Name !== '-') {
        return { reviewer1Name: reviewer2Name, reviewer2Name: '' }
    }

    return { reviewer1Name, reviewer2Name }
}

const BsPDF = ({ bonSementaraDetail, approvedReviewers }) => {
    if (!bonSementaraDetail || bonSementaraDetail.status !== 'Disetujui') {
        return null
    }

    // Fungsi untuk mengubah angka menjadi terbilang
    const terbilang = (angka) => {
        const bilangan = [
            '',
            'Satu',
            'Dua',
            'Tiga',
            'Empat',
            'Lima',
            'Enam',
            'Tujuh',
            'Delapan',
            'Sembilan',
            'Sepuluh',
            'Sebelas',
            'Dua Belas',
            'Tiga Belas',
            'Empat Belas',
            'Lima Belas',
            'Enam Belas',
            'Tujuh belas',
            'Delapan belas',
            'Sembilan belas'
        ]
        const satuan = ['', 'Ribu', 'Juta', 'Miliar', 'Triliun']

        if (angka < 20) return bilangan[angka]

        const prosesTerbilang = (num) => {
            if (num < 20) return bilangan[num]
            if (num < 100) {
                const depan = Math.floor(num / 10)
                const belakang = num % 10
                return (
                    (depan === 1 ? 'Sepuluh' : bilangan[depan] + ' Puluh') +
                    (belakang > 0 ? ' ' + bilangan[belakang] : '')
                )
            }
            if (num < 1000) {
                const depan = Math.floor(num / 100)
                const belakang = num % 100
                return (
                    (depan === 1 ? 'Seratus' : bilangan[depan] + ' Ratus') +
                    (belakang > 0 ? ' ' + prosesTerbilang(belakang) : '')
                )
            }
            return ''
        }

        const formatTerbilang = (num) => {
            if (num === 0) return 'nol'

            let result = ''
            let sisa = num
            let tingkat = 0

            while (sisa > 0) {
                const bagian = sisa % 1000
                if (bagian !== 0) {
                    const sebutan = prosesTerbilang(bagian)
                    result = sebutan + ' ' + satuan[tingkat] + ' ' + result
                }
                sisa = Math.floor(sisa / 1000)
                tingkat++
            }

            return result.trim() + ' Rupiah'
        }

        return formatTerbilang(angka)
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {bonSementaraDetail.bonSementara?.map((item) => (
                    <View style={styles.header}>
                        <View style={{ alignItems: 'center' }}>
                            <Text>{bonSementaraDetail.user?.unit || '-'}</Text>
                            <Text>MAKASSAR</Text>
                        </View>
                        <Text>{item.nomorBS || '-'}</Text>
                    </View>
                ))}

                <Text style={styles.title}>BON SEMENTARA</Text>

                {/* Table */}
                <View style={styles.tableContainer}>
                    {/* Tanggal Pembayaran Oleh Kasir Row */}
                    <View style={[styles.tableRow]}>
                        <View style={[styles.tableCell, { width: '29%', borderRight: 0 }]}>
                            <Text>Tanggal Pembayaran Oleh Kasir</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '1%', borderRight: 0 }]}>
                            <Text>:</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '70%', borderRight: 0 }]}>
                            <Text>
                                {bonSementaraDetail.tanggalPengajuan
                                    ? new Date(bonSementaraDetail.tanggalPengajuan).toLocaleDateString('id-ID', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                    })
                                    : '-'}
                            </Text>
                        </View>
                    </View>

                    {/* Diselesaikan paling lambat tanggal Row */}
                    <View style={[styles.tableRow]}>
                        <View style={[styles.tableCell, { width: '29%', borderRight: 0 }]}>
                            <Text>Diselesaikan paling lambat tanggal</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '1%', borderRight: 0 }]}>
                            <Text>:</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '70%', borderRight: 0 }]}>
                            <Text> </Text>
                        </View>
                    </View>

                    {/* Header Row */}
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <View style={[styles.tableHeaderCell, { width: '6%' }]}>
                            <Text>NO.</Text>
                        </View>
                        <View style={[styles.tableHeaderCell, { width: '74%' }]}>
                            <Text>ACTIVITIES NAME</Text>
                        </View>
                        <View style={[styles.tableHeaderCell, { width: '20%', borderRight: 0 }]}>
                            <Text>JUMLAH (IDR)</Text>
                        </View>
                    </View>

                    {/* Data Row */}
                    {bonSementaraDetail.bonSementara?.map((item, index) => (
                        <View key={index} style={[styles.tableRow, { borderBottom: 0 }]}>
                            <View style={[styles.tableCell, { width: '6%', textAlign: 'center' }]}>
                                <Text>{index + 1}</Text>
                            </View>
                            <View style={[styles.tableCell, { width: '74%' }]}>
                                <Text>{item.aktivitas}</Text>
                            </View>
                            <View style={[styles.tableCell, { width: '20%', textAlign: 'right', borderRight: 0 }]}>
                                <Text>{item?.jumlahBS.toLocaleString('id-ID') ?? 'N/A'}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Empty Row */}
                    <View style={[styles.tableRow, { borderBottom: 0 }]}>
                        <View style={[styles.tableCell, { width: '6%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '74%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '20%', borderRight: 0 }]}>
                            <Text> </Text>
                        </View>
                    </View>

                    {/* Terbilang Row */}
                    {bonSementaraDetail.bonSementara?.map((item) => (
                        <View style={[styles.tableRow]}>
                            <View style={[styles.tableCell, { width: '6%' }]}>
                                <Text> </Text>
                            </View>
                            <View style={[styles.tableCell, { width: '74%', textTransform: 'uppercase' }]}>
                                <Text>TERBILANG: {terbilang(item.jumlahBS || 0)}</Text>
                            </View>
                            <View style={[styles.tableCell, { width: '20%', borderRight: 0 }]}>
                                <Text> </Text>
                            </View>
                        </View>
                    ))}

                    {/* Total Row */}
                    {bonSementaraDetail.bonSementara?.map((item) => (
                        <View style={[styles.tableRow]}>
                            <View style={[styles.tableCell, { width: '6%', borderRight: 0 }]}>
                                <Text> </Text>
                            </View>
                            <View style={[styles.tableCell, { width: '74%', textAlign: 'right' }]}>
                                <Text>TOTAL:</Text>
                            </View>
                            <View style={[styles.tableCell, { width: '20%', borderRight: 0, textAlign: 'right' }]}>
                                <Text>{item.jumlahBS.toLocaleString('id-ID') ?? 'N/A'}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Footer */}
                    <View style={styles.footer}>
                        <View style={styles.footerRow}>
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center'
                                }}
                            >
                                <Text>Diajukan oleh {bonSementaraDetail.user?.nama || '-'}</Text>
                                <Text
                                    style={{
                                        marginTop: '8px'
                                    }}
                                >
                                    Dokumen Ini Sudah Mendukung Signature Digital
                                </Text>
                            </View>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    justifyContent: 'center'
                                }}
                            >
                                <Text> </Text>
                                <Text
                                    style={{
                                        marginTop: 'auto'
                                    }}
                                >
                                    <Text>
                                        Approved By {approvedReviewers.reviewer1Name}
                                        {approvedReviewers.reviewer2Name ? ` & ${approvedReviewers.reviewer2Name}` : ''}
                                    </Text>
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    )
}

const generateBsPDF = async (bonSementaraDetail) => {
    try {
        // Cek apakah Bon Sementara sudah disetujui
        if (bonSementaraDetail.status !== 'Disetujui') {
            toast.error('Bon Sementara belum disetujui')
            return
        }

        // Ambil nama reviewer sebelum PDF dirender
        const approvedReviewers = await getApprovedReviewerNames(bonSementaraDetail)

        // Buat dokumen PDF
        const pdfBlob = await pdf(
            <BsPDF
                bonSementaraDetail={bonSementaraDetail}
                approvedReviewers={approvedReviewers}
            />
        ).toBlob()

        const sanitizedKategori = bonSementaraDetail.bonSementara[0].kategori.replace(/\//g, '_')

        const storageRef = ref(
            storage,
            `BonSementara/${sanitizedKategori}/${bonSementaraDetail.displayId}/${bonSementaraDetail.displayId}.pdf`
        )
        await uploadBytes(storageRef, pdfBlob)

        const downloadURL = await getDownloadURL(storageRef)
        return downloadURL
    } catch (error) {
        console.error('Gagal mengunduh:', error)
        toast.error('Gagal mengunduh Bon Sementara')
        return null
    }
}

    ; <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover />

export { BsPDF, generateBsPDF }
