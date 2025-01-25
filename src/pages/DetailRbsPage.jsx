import React, { useEffect } from 'react'
import Layout from './Layout'
import DetailRbs from '../components/DetailRbs'

const DetailReimbursementPage = () => {
    useEffect(() => {
        document.title = 'Detail Reimbursement - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <DetailRbs />
            </Layout>
        </div>
    )
}

export default DetailReimbursementPage