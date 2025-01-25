import React, { useEffect } from 'react'
import Layout from './Layout'
import DetailLpj from '../components/DetailLpj'

const DetailLpjPage = () => {
    useEffect(() => {
        document.title = 'Detail Lpj - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <DetailLpj />
            </Layout>
        </div>
    )
}

export default DetailLpjPage