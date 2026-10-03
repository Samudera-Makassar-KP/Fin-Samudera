import React, { useEffect } from 'react'
import Layout from './Layout'
import Maker from '../components/Maker'

const MakerPage = () => {
    useEffect(() => {
        document.title = 'Maker - Samudera Indonesia'
    }, [])

    return (
        <div>
            <Layout>
                <Maker />
            </Layout>
        </div>
    )
}

export default MakerPage
