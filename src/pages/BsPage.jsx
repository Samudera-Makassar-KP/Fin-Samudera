import React, { useEffect } from 'react'
import Layout from './Layout'
import FormBs from '../components/FormBs'

const FormBsPage = () => {
    useEffect(() => {
        document.title = 'Ajukan Bon Sementara - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <FormBs />
            </Layout>
        </div>
    )
}

export default FormBsPage
