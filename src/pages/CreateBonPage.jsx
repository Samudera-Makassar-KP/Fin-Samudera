import React, { useEffect } from 'react'
import Layout from './Layout'
import CreateBonForm from '../components/FormCreateBon'

const CreateBon = () => {
    useEffect(() => {
        document.title = 'Create BS - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <CreateBonForm />
            </Layout>
        </div>
    )
}

export default CreateBon
