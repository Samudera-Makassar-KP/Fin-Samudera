import React, { useEffect } from 'react'
import Layout from './Layout'
import DetailCreateBs from '../components/DetailCreateBs'

const DetailCreateBsPage = () => {
    useEffect(() => {
        document.title = 'Detail Create BS - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <DetailCreateBs />
            </Layout>
        </div>
    )
}

export default DetailCreateBsPage