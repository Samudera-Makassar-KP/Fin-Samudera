import React, { useEffect } from 'react'
import Layout from './Layout'
import EditUserForm from '../components/FormEditUser'

const EditUserPage = () => {
    useEffect(() => {
        document.title = 'Edit Pengguna - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <EditUserForm />
            </Layout>
        </div>
    )
}

export default EditUserPage
