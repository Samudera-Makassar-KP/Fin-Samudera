import React, { useEffect } from 'react'
import Layout from './Layout'
import ReimbursementCheck from '../components/ReimbursementCheck'

const RbsCheckPage = () => {
    useEffect(() => {
        document.title = 'Cek Reimbursement - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <ReimbursementCheck />
            </Layout>
        </div>
    )
}

export default RbsCheckPage