import React, { useEffect } from 'react'
import Layout from './Layout'
import FormLpjUmum from '../components/FormLpjUmum'

const LpjUmum = () => {
    useEffect(() => {
        document.title = 'LPJ GA/Umum - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <FormLpjUmum />
            </Layout>
        </div>
    )
}

export default LpjUmum
