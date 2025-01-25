import React, { useState, useEffect } from 'react'
import { db } from '../firebaseConfig'
import { doc, getDoc } from 'firebase/firestore'
import ReimbursementTable from '../components/ReimbursementTable'
import LpjBsTable from '../components/LpjBsTable'
import CreateBsTable from '../components/CreateBsTable'
import ReportCard from '../components/ReportCard'
import Layout from './Layout'

const ValidatorDashboard = ({ userUid }) => {
    const [user, setUser] = useState(null)

    const uid = userUid || localStorage.getItem('userUid')

    useEffect(() => {
        document.title = 'Dashboard - Samudera Indonesia'

        const fetchUserData = async () => {
            try {
                if (uid) {
                    const userDoc = await getDoc(doc(db, 'users', uid))
                    if (userDoc.exists()) {
                        setUser({
                            name: userDoc.data().nama || 'User ',
                            role: userDoc.data().role
                        })
                    } else {
                        console.log('User  data not found in Firestore')
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error)
            }
        }

        fetchUserData()
    }, [uid])

    return (
        <div>
            <Layout>
                <div className="container mx-auto py-10 md:py-8">
                    <div className="w-full">
                        <h2 className="text-xl font-medium mb-4">
                            Welcome, <span className="font-bold">{user?.name || 'User '}</span>
                        </h2>
                        <ReportCard />
                        <ReimbursementTable />
                        <CreateBsTable />
                        <LpjBsTable />
                    </div>
                </div>
            </Layout>
        </div>
    )
}

export default ValidatorDashboard