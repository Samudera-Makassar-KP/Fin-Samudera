import React, { useEffect } from 'react'
import Layout from './Layout'
import RekapanUnitBisnis from '../components/RekapanUnitBisnis'

const RekapanPage = () => {
    useEffect(() => {
        document.title = 'Rekapan Unit Bisnis - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <RekapanUnitBisnis />
            </Layout>
        </div>
    )
}

export default RekapanPage
