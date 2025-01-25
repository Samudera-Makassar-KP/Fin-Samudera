import React, { useEffect } from 'react'
import Layout from './Layout'
import LpjBsCheck from '../components/LpjBsCheck'

const LpjCheckPage = () => {
    useEffect(() => {
        document.title = 'Cek LPJ Bon Sementara - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <LpjBsCheck />
            </Layout>
        </div>
    )
}

export default LpjCheckPage