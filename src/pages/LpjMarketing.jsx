import React, { useEffect } from 'react'
import Layout from './Layout'
import FormLpjMarketing from '../components/FormLpjMarketing'

const LpjMarketing = () => {
    useEffect(() => {
        document.title = 'LPJ Marketing/Operasional - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <FormLpjMarketing />
            </Layout>
        </div>
    )
}

export default LpjMarketing
