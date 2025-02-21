import React, { useEffect, useState, useRef } from 'react'
import { db } from '../firebaseConfig'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import ReimbursementTable from '../components/ReimbursementTable'
import CreateBsTable from '../components/CreateBsTable'
import LpjBsTable from '../components/LpjBsTable'
import Layout from './Layout'
import BSAlerts from '../components/BSAlerts'
import DefaultBankModal from '../components/DefaultBankModal'

const DEFAULT_BANK = {
    bankName: 'ABC',
    accountNumber: '123'
}

const AdminDashboard = ({ userUid }) => {
    const [user, setUser] = useState({
        name: 'User',
        bankName: DEFAULT_BANK.bankName,
        accountNumber: DEFAULT_BANK.accountNumber
    });
    const [showBankModal, setShowBankModal] = useState(false)
    const createBsTableRef = useRef(null);

    const uid = userUid || localStorage.getItem('userUid')

    const checkBankInfo = (userData) => {
        return (
            userData.bankName === DEFAULT_BANK.bankName &&
            userData.accountNumber === DEFAULT_BANK.accountNumber
        );
    };

    useEffect(() => {
        document.title = 'Dashboard - Samudera Indonesia'

        const fetchUserData = async () => {
            try {
                if (uid) {
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUser({
                            name: userData.nama || 'User',
                            bankName: userData.bankName || DEFAULT_BANK.bankName,
                            accountNumber: userData.accountNumber || DEFAULT_BANK.accountNumber
                        });

                        setShowBankModal(checkBankInfo({
                            bankName: userData.bankName || DEFAULT_BANK.bankName,
                            accountNumber: userData.accountNumber || DEFAULT_BANK.accountNumber
                        }));
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        const userRef = doc(db, 'users', uid);
        const unsubscribe = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                const bankName = userData.bankName || DEFAULT_BANK.bankName;
                const accountNumber = userData.accountNumber || DEFAULT_BANK.accountNumber;

                setUser({
                    name: userData.nama || 'User',
                    bankName,
                    accountNumber
                });

                setShowBankModal(checkBankInfo({ bankName, accountNumber }));
            }
        });

        fetchUserData()

        return () => unsubscribe();
    }, [uid])

    const scrollToCreateBsTable = () => {
        createBsTableRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    };

    return (
        <div>
            <Layout>
                <div className="container mx-auto py-10 md:py-8">
                    <div className="w-full">
                        <h2 className="text-xl font-medium mb-4">
                            Welcome, <span className="font-bold">{user?.name || 'User'}</span>
                        </h2>
                        <BSAlerts scrollToTable={scrollToCreateBsTable} />
                        <ReimbursementTable />
                        <div ref={createBsTableRef}>
                            <CreateBsTable />
                        </div>
                        <LpjBsTable />
                    </div>
                </div>
            </Layout>

            <DefaultBankModal
                isOpen={showBankModal}
                onUpdate={() => setShowBankModal(false)}
                initialData={{
                    bankName: user.bankName,
                    accountNumber: user.accountNumber
                }}
            />
        </div>
    )
}

export default AdminDashboard
