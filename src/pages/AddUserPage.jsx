import React, { useEffect } from 'react'
import Layout from './Layout'
import AddUserForm from '../components/FormAddUser'

const AddUserPage = () => {
    useEffect(() => {
        document.title = 'Tambah Pengguna - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <AddUserForm />
            </Layout>
        </div>
    )
}

export default AddUserPage
