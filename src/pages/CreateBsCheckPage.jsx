import React, { useEffect } from 'react'
import Layout from './Layout'
import CreateBsCheck from '../components/CreateBsCheck'

const CreateBsCheckPage = () => {
    useEffect(() => {
        document.title = 'Cek Create Bon Sementara - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <CreateBsCheck />
            </Layout>
        </div>
    )
}

export default CreateBsCheckPage