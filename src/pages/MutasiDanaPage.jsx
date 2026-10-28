import React, { useEffect } from 'react'
import Layout from './Layout'
import MutasiDana from '../components/MutasiDana'

const MutasiDanaPage = () => {
    useEffect(() => {
        document.title = 'Mutasi Dana - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <MutasiDana />
            </Layout>
        </div>
    )
}

export default MutasiDanaPage
