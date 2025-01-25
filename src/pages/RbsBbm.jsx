import React, { useEffect } from 'react'
import Layout from './Layout'
import FormRbsBbm from '../components/FormRbsBbm'

const RbsBbm = () => {
    useEffect(() => {
        document.title = 'Reimbursement BBM - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <FormRbsBbm />
            </Layout>
        </div>
    )
}

export default RbsBbm
