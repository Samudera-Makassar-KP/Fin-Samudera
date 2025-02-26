import React, { useEffect } from 'react'
import Layout from './Layout'
import BsCheck from '../components/BsCheck'

const BsCheckPage = () => {
    useEffect(() => {
        document.title = 'Cek Pengajuan Bon Sementara - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <BsCheck />
            </Layout>
        </div>
    )
}

export default BsCheckPage