import React, { useEffect } from 'react'
import Layout from './Layout'
import DetailBs from '../components/DetailBs'

const DetailBsPage = () => {
    useEffect(() => {
        document.title = 'Detail Bon Sementara - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <DetailBs />
            </Layout>
        </div>
    )
}

export default DetailBsPage