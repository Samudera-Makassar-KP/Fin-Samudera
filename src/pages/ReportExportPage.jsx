import React, { useEffect } from 'react'
import Layout from './Layout'
import ReportExport from '../components/ReportExport'

const ReportExportPage = () => {
    useEffect(() => {
        document.title = 'Ekspor Laporan Pengajuan - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <ReportExport />
            </Layout>
        </div>
    )
}

export default ReportExportPage