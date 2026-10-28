import React, { useEffect } from 'react'
import Layout from './Layout'
import CatatNota from '../components/CatatNota'

const CatatNotaPage = () => {
    useEffect(() => {
        document.title = 'Catat Nota - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <CatatNota />
            </Layout>
        </div>
    )
}

export default CatatNotaPage
