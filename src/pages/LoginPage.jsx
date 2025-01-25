import React, { useEffect } from 'react'
import Login from '../components/Login'

const LoginPage = () => {
    useEffect(() => {
        document.title = 'Login - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Login />
        </div>
    )
}

export default LoginPage
