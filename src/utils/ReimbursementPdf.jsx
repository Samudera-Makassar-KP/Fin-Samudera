import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer'
import Logo from '../assets/images/logo-samudera.png'
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

Font.register({
    family: 'Optima',
    fonts: [
        { src: require('../assets/fonts/Optima.ttf') },
        { src: require('../assets/fonts/Optima_Medium.ttf'), fontWeight: 'medium' },
        { src: require('../assets/fonts/Optima_B.ttf'), fontWeight: 'bold' },
        { src: require('../assets/fonts/Optima_Italic.ttf'), fontStyle: 'italic' }
    ]
})

const styles = StyleSheet.create({
    page: {
        padding: 24,
        fontFamily: 'Poppins'
    },
    logo: {
        width: 160,
        height: 24,
        marginBottom: 12,
        alignSelf: 'flex-start'
    },
    header: {
        marginBottom: 10,
        fontSize: 8,
        justifyContent: 'space-between',
        fontFamily: 'Optima',
        alignItems: 'flex-end'
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
    bankInfo: {
        borderWidth: 2,
        fontWeight: 'semibold',
        padding: 4
    },
    footer: {
        marginTop: 16,
        fontSize: 7
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4
    }
})

const getApprovedValidatorName = async (reimbursementDetail) => {
    if (!reimbursementDetail || !reimbursementDetail.statusHistory) {
        return { validatorName: '' }
    }

    const { statusHistory } = reimbursementDetail

    // Find validator approval in status history - check for both regular validator and super admin
    const validatorApproval = statusHistory.find(
        (history) =>
            history.status.toLowerCase().includes('disetujui oleh validator') ||
            history.status.toLowerCase().includes('disetujui oleh super admin (pengganti validator)')
    )

    if (validatorApproval) {
        try {
            const validatorDocRef = doc(db, 'users', validatorApproval.actor)
            const validatorSnapshot = await getDoc(validatorDocRef)

            if (validatorSnapshot.exists()) {
                // If it's super admin validation, return "Super Admin" as the name
                if (validatorApproval.status.toLowerCase().includes('super admin')) {
                    return { validatorName: 'Super Admin' }
                }
                // Otherwise return the validator's actual name
                const validatorName = validatorSnapshot.data().nama
                return { validatorName }
            }
        } catch (error) {
            console.error('Error fetching validator name:', error)
        }
    }

    return { validatorName: '' }
}

const getApprovedReviewerNames = async (reimbursementDetail) => {
    if (!reimbursementDetail || !reimbursementDetail.statusHistory) {
        return { reviewer1Name: '-', reviewer2Name: '-' }
    }

    const { statusHistory } = reimbursementDetail

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

const ReimbursementPDF = ({ reimbursementDetail, approvedReviewers, approvedValidator }) => {
    if (!reimbursementDetail || reimbursementDetail.status !== 'Disetujui') {
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
                <Image src={Logo} style={styles.logo} />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={{ fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>
                        {reimbursementDetail.user?.unit || '-'}
                    </Text>
                    <Text>Jl. Sungai Saddang No. 82, Kota Makassar</Text>
                    <Text style={{ marginTop: 10, fontWeight: 'bold' }}>samudera.id</Text>
                </View>

                {/* Table */}
                <View style={styles.tableContainer}>
                    {/* REIMBURSEMENT Row */}
                    <View style={[styles.tableRow, { position: 'relative' }]}>
                        <Text style={{ position: 'absolute', left: 4, top: 4, fontSize: 10 }}>
                            {reimbursementDetail.displayId || '-'}
                        </Text>
                        <View
                            style={[
                                styles.tableCell,
                                {
                                    width: '100%',
                                    textAlign: 'center',
                                    fontWeight: 'semibold',
                                    fontSize: 10,
                                    borderRight: 0
                                }
                            ]}
                        >
                            <Text>REIMBURSEMENT</Text>
                        </View>
                    </View>


                    {/* Header Row */}
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <View style={[styles.tableHeaderCell, { width: '6%' }]}>
                            <Text>NO.</Text>
                        </View>
                        <View style={[styles.tableHeaderCell, { width: '68%' }]}>
                            <Text>ACTIVITIES NAME</Text>
                        </View>
                        <View style={[styles.tableHeaderCell, { width: '12%' }]}>
                            <Text>KETERANGAN</Text>
                        </View>
                        <View style={[styles.tableHeaderCell, { width: '14%', borderRight: 0 }]}>
                            <Text>JUMLAH (IDR)</Text>
                        </View>
                    </View>

                    {/* Kegiatan Row */}
                    <View style={[styles.tableRow, { borderBottom: 0 }]}>
                        <View style={[styles.tableCell, { width: '6%', textAlign: 'center' }]}>
                            <Text> </Text>
                        </View>
                        <View
                            style={[styles.tableCell, { width: '68%', fontWeight: 'bold', textTransform: 'uppercase' }]}
                        >
                            <Text>
                                BIAYA REIMBURSE {reimbursementDetail.user?.nama || '-'} UNTUK KEGIATAN{' '}
                                {reimbursementDetail.kategori || '-'}
                            </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '12%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '14%', textAlign: 'right', borderRight: 0 }]}>
                            <Text> </Text>
                        </View>
                    </View>

                    {/* Data Row */}
                    {reimbursementDetail.reimbursements?.map((item, index) => (
                        <View key={index} style={[styles.tableRow, { borderBottom: 0 }]}>
                            <View style={[styles.tableCell, { width: '6%', textAlign: 'center' }]}>
                                <Text>{index + 1}</Text>
                            </View>
                            <View
                                style={[
                                    styles.tableCell,
                                    { width: '68%', justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'row' }
                                ]}
                            >
                                <Text style={{ width: 100 }}>
                                    {item.tanggal
                                        ? new Date(item.tanggal)
                                            .toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: '2-digit'
                                            })
                                            .replace(/\./g, '')
                                            .replace(/\s/g, '-')
                                        : '-'}
                                </Text>
                                <Text style={{ marginLeft: 12 }}>{item.jenis || '-'}</Text>
                            </View>
                            <View style={[styles.tableCell, { width: '12%', alignItems: 'flex-start' }]}>
                                <Text style={{ flexWrap: 'wrap', textAlign: 'left', overflow: 'hidden' }}>
                                    {(item.keterangan || '').replace(/(\d)/g, '$1\u200B')}
                                </Text>
                            </View>
                            <View style={[styles.tableCell, { width: '14%', textAlign: 'right', borderRight: 0 }]}>
                                <Text>{(item.biaya || 0).toLocaleString('id-ID')}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Empty Row */}
                    <View style={[styles.tableRow, { borderBottom: 0 }]}>
                        <View style={[styles.tableCell, { width: '6%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '68%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '12%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '14%', borderRight: 0 }]}>
                            <Text> </Text>
                        </View>
                    </View>

                    {/* Terbilang Row */}
                    <View style={[styles.tableRow]}>
                        <View style={[styles.tableCell, { width: '6%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '68%', textTransform: 'uppercase' }]}>
                            <Text>TERBILANG: {terbilang(reimbursementDetail.totalBiaya || 0)}</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '12%' }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '14%', borderRight: 0 }]}>
                            <Text> </Text>
                        </View>
                    </View>

                    {/* Total Row */}
                    <View style={[styles.tableRow]}>
                        <View style={[styles.tableCell, { width: '6%', borderRight: 0 }]}>
                            <Text> </Text>
                        </View>
                        <View style={[styles.tableCell, { width: '80%', textAlign: 'right' }]}>
                            <Text>TOTAL:</Text>
                        </View>
                        <View style={[styles.tableCell, { width: '14%', borderRight: 0, textAlign: 'right' }]}>
                            <Text>{reimbursementDetail.totalBiaya?.toLocaleString('id-ID') || '-'}</Text>
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <View style={[styles.footerRow, { paddingLeft: 4 }]}>
                            <Text>Dokumen Ini Sudah Mendukung Signature Digital</Text>
                        </View>
                        <View style={[styles.footerRow, { alignItems: 'flex-end', columnGap: 4, marginTop: 2 }]}>
                            <View
                                style={[
                                    styles.bankInfo,
                                    { flexDirection: 'row', columnGap: 4, alignItems: 'flex-start' }
                                ]}
                            >
                                {/* Label */}
                                <View style={{ flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                                    <Text>Nama Account</Text>
                                    <Text>Bank Penerima</Text>
                                    <Text>No Rekening</Text>
                                </View>

                                {/* Tanda Titik Dua */}
                                <View style={{ flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                                    <Text>:</Text>
                                    <Text>:</Text>
                                    <Text>:</Text>
                                </View>

                                {/* Value */}
                                <View style={{ flexDirection: 'column', gap: 2, paddingRight: 32 }}>
                                    <Text>{reimbursementDetail.user?.nama || '-'}</Text>
                                    <Text>{reimbursementDetail.user?.bankName || '-'}</Text>
                                    <Text>{reimbursementDetail.user?.accountNumber || '-'}</Text>
                                </View>
                            </View>

                            <View
                                style={{
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    paddingVertical: 2,
                                    paddingRight: 4
                                }}
                            >
                                {approvedValidator.validatorName && (
                                    <Text>Validate By {approvedValidator.validatorName}</Text>
                                )}
                                <Text>
                                    Approved By {approvedReviewers.reviewer1Name}
                                    {approvedReviewers.reviewer2Name ? ` & ${approvedReviewers.reviewer2Name}` : ''}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    )
}

const generateReimbursementPDF = async (reimbursementDetail) => {
    try {
        // Cek apakah reimbursement sudah disetujui
        if (reimbursementDetail.status !== 'Disetujui') {
            toast.error('Reimbursement belum disetujui')
            return
        }

        // Ambil nama reviewer sebelum PDF dirender
        const approvedReviewers = await getApprovedReviewerNames(reimbursementDetail)
        const approvedValidator = await getApprovedValidatorName(reimbursementDetail)

        // Buat dokumen PDF
        const pdfBlob = await pdf(
            <ReimbursementPDF
                reimbursementDetail={reimbursementDetail}
                approvedReviewers={approvedReviewers}
                approvedValidator={approvedValidator}
            />
        ).toBlob()

        const sanitizedKategori = reimbursementDetail.kategori.replace(/\//g, '_')

        const storageRef = ref(
            storage,
            `Reimbursement/${sanitizedKategori}/${reimbursementDetail.displayId}/${reimbursementDetail.displayId}.pdf`
        )
        await uploadBytes(storageRef, pdfBlob)

        const downloadURL = await getDownloadURL(storageRef)
        return downloadURL
    } catch (error) {
        console.error('Gagal mengunduh:', error)
        toast.error('Gagal mengunduh Reimbursement')
        return null
    }
}

    ; <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover />

export { ReimbursementPDF, generateReimbursementPDF }
