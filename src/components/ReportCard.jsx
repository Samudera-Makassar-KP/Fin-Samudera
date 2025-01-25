import React, { useState, useEffect } from 'react'
import { db } from '../firebaseConfig'
import { collection, query, where, getDocs } from 'firebase/firestore'

const ReportCard = () => {
    const [reimbursementCount, setReimbursementCount] = useState(0)
    const [bonSementaraCount, setBonSementaraCount] = useState(0)
    const [lpjCount, setLpjCount] = useState(0)
    const [userRole, setUserRole] = useState('')
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const role = localStorage.getItem('userRole')
        setUserRole(role)

        if (role === 'Super Admin') {
            return
        }

        const fetchCounts = async (collectionName) => {
            try {
                const uid = localStorage.getItem('userUid')

                if (!uid) {
                    console.error('UID tidak ditemukan di localStorage')
                    return []
                }

                let queries = []

                // Query untuk dokumen yang user sebagai validator
                const validatorQuery = query(
                    collection(db, collectionName),
                    where('status', '==', 'Diajukan'),
                    where('user.validator', 'array-contains', uid)
                )
                queries.push(getDocs(validatorQuery))

                // Query untuk dokumen yang user sebagai reviewer1
                const r1Query = query(
                    collection(db, collectionName),
                    where('status', '==', 'Divalidasi'),
                    where('user.reviewer1', 'array-contains', uid)
                )
                queries.push(getDocs(r1Query))

                // Query untuk dokumen yang user sebagai reviewer2
                const r2Query = query(
                    collection(db, collectionName),
                    where('status', '==', 'Diproses'),
                    where('user.reviewer2', 'array-contains', uid),
                    where('approvedByReviewer1Status', 'in', ['reviewer', 'superadmin'])
                )
                queries.push(getDocs(r2Query))

                const snapshots = await Promise.all(queries)
                let documents = snapshots.flatMap((snapshot) =>
                    snapshot.docs.map((doc) => ({
                        id: doc.id,
                        displayId: doc.data().displayId,
                        ...doc.data()
                    }))
                )

                // Hapus duplikasi
                documents = Array.from(new Map(documents.map((item) => [item.id, item])).values())
                return documents
            } catch (error) {
                console.error(`Error fetching ${collectionName} data:`, error)
                return []
            }
        }

        const updateCounts = async () => {
            try {
                setIsLoading(true);
                const [reimbursements, bonSementara, lpj] = await Promise.all([
                    fetchCounts('reimbursement'),
                    fetchCounts('bonSementara'),
                    fetchCounts('lpj')
                ]);

                setReimbursementCount(reimbursements.length);
                setBonSementaraCount(bonSementara.length);
                setLpjCount(lpj.length);
            } catch (error) {
                console.error('Error updating counts:', error);
            } finally {
                setIsLoading(false);
            }
        };

        updateCounts()
    }, [])

    if (isLoading) {
        return (
            <div className="w-full">
                {/* Desktop View (1440) */}
                <div
                    className={`hidden xl:flex ${userRole === 'Reviewer' ? 'xl:flex-col xl:gap-6' : 'xl:flex-row xl:gap-6 mb-6'}`}
                >
                    {[1, 2, 3].map((index) => (
                        <div
                            key={index}
                            className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg flex-1"
                        >
                            <div className="animate-pulse rounded-full h-20 w-20 bg-gray-200"></div>
                            <div className="flex-1">
                                <div className="h-6 bg-gray-200 rounded w-32 mb-1 animate-pulse"></div>
                                <div className="h-10 bg-gray-200 rounded w-8 mb-1 animate-pulse"></div>
                                <div className="h-4 bg-gray-200 rounded w-44 animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Laptop View (1024) */}
                <div className="hidden lg:block xl:hidden">
                    {userRole === 'Reviewer' ? (
                        <div className="flex flex-col gap-6">
                            {[1, 2, 3].map((index) => (
                                <div
                                    key={index}
                                    className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg"
                                >
                                    <div className="animate-pulse rounded-full h-20 w-20 bg-gray-200"></div>
                                    <div className="flex-1">
                                        <div className="h-6 bg-gray-200 rounded w-32 mb-1 animate-pulse"></div>
                                        <div className="h-10 bg-gray-200 rounded w-8 mb-1 animate-pulse"></div>
                                        <div className="h-4 bg-gray-200 rounded w-44 animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-row gap-4 mb-6">
                            {[1, 2, 3].map((index) => (
                                <div key={index} className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                                    <div className="animate-pulse rounded-full h-14 w-14 bg-gray-200 mb-1"></div>
                                    <div className="h-5 bg-gray-200 rounded w-32 mb-1 animate-pulse"></div>
                                    <div className="h-7 bg-gray-200 rounded animate-pulse"></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tablet View (768) */}
                <div
                    className={`hidden md:flex md:flex-row md:gap-4 lg:hidden ${userRole === 'Reviewer' ? 'mb-2' : 'mb-6'}`}
                >
                    {[1, 2, 3].map((index) => (
                        <div key={index} className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                            <div className="animate-pulse rounded-full h-14 w-14 bg-gray-200 mb-1"></div>
                            <div className="h-5 bg-gray-200 rounded w-32 mb-1 animate-pulse"></div>
                            <div className="h-7 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                    ))}
                </div>

                {/* Mobile View (below 768px) */}
                <div
                    className={`md:hidden bg-white rounded-lg shadow-sm p-4 ${userRole === 'Reviewer' ? 'mb-2' : 'mb-6'}`}
                >
                    <p className="text-lg font-medium mb-2">Pengajuan Perlu Ditanggapi</p>
                    <div className="flex flex-col">
                        {[1, 2, 3].map((index) => (
                            <React.Fragment key={index}>
                                <div className="flex items-center justify-between w-full bg-white p-3 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="animate-pulse rounded-full h-11 w-11 bg-gray-200"></div>
                                        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
                                    </div>
                                    <div className="animate-pulse bg-gray-200 h-8 w-8 rounded-full"></div>
                                </div>
                                {index !== 3 && <hr className="border-gray-150" />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Desktop View (1440) */}
            <div
                className={`hidden xl:flex ${userRole === 'Reviewer' ? 'xl:flex-col xl:gap-6' : 'xl:flex-row xl:gap-6 mb-6'}`}
            >
                {userRole === 'Reviewer' ? (
                    // Desktop layout untuk Reviewer
                    <>
                        <div className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-8 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M8.25 9.75h4.875a2.625 2.625 0 0 1 0 5.25H12M8.25 9.75 10.5 7.5M8.25 9.75 10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-lg font-medium text-gray-500">Reimbursement</p>
                                <div className="text-4xl font-bold">{reimbursementCount}</div>
                                <p className="text-sm text-gray-500">Pengajuan Perlu Ditanggapi</p>
                            </div>
                        </div>

                        <div className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg">
                            <div className="bg-gradient-to-r from-teal-400 to-green-500 p-6 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-8 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-lg font-medium text-gray-500">Nomor Bon Sementara</p>
                                <div className="text-4xl font-bold">{bonSementaraCount}</div>
                                <p className="text-sm text-gray-500">Pengajuan Perlu Ditanggapi</p>
                            </div>
                        </div>

                        <div className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg">
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-8 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-lg font-medium text-gray-500">LPJ Bon Sementara</p>
                                <div className="text-4xl font-bold">{lpjCount}</div>
                                <p className="text-sm text-gray-500">Pengajuan Perlu Ditanggapi</p>
                            </div>
                        </div>
                    </>
                ) : (
                    // Desktop Non-Reviewer Layout (follows Reviewer layout style but with flex-row)
                    <>
                        <div className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg flex-1">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-8 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M8.25 9.75h4.875a2.625 2.625 0 0 1 0 5.25H12M8.25 9.75 10.5 7.5M8.25 9.75 10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-lg font-medium text-gray-500">Reimbursement</p>
                                <div className="text-4xl font-bold">{reimbursementCount}</div>
                                <p className="text-sm text-gray-500">Pengajuan Perlu Ditanggapi</p>
                            </div>
                        </div>

                        <div className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg flex-1">
                            <div className="bg-gradient-to-r from-teal-400 to-green-500 p-6 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-8 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-lg font-medium text-gray-500">Nomor Bon Sementara</p>
                                <div className="text-4xl font-bold">{bonSementaraCount}</div>
                                <p className="text-sm text-gray-500">Pengajuan Perlu Ditanggapi</p>
                            </div>
                        </div>

                        <div className="bg-white flex items-center space-x-4 px-6 py-4 shadow-sm rounded-lg flex-1">
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-8 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-lg font-medium text-gray-500">LPJ Bon Sementara</p>
                                <div className="text-4xl font-bold">{lpjCount}</div>
                                <p className="text-sm text-gray-500">Pengajuan Perlu Ditanggapi</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Laptop View (1024) */}
            <div className="hidden lg:block xl:hidden">
                <div className={`flex flex-row gap-4 ${userRole === 'Reviewer' ? 'mb-2' : 'mb-6'}`}>
                    <div className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 rounded-full w-fit mb-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                                className="size-6 text-white"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8.25 9.75h4.875a2.625 2.625 0 0 1 0 5.25H12M8.25 9.75 10.5 7.5M8.25 9.75 10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z"
                                />
                            </svg>
                        </div>
                        <p className="text-md font-medium text-gray-500">Reimbursement</p>
                        <div className="text-xl font-bold">
                            {reimbursementCount}{' '}
                            <span className="text-sm font-medium text-gray-500">Pengajuan Perlu Ditanggapi</span>
                        </div>
                    </div>

                    <div className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                        <div className="bg-gradient-to-r from-teal-400 to-green-500 p-4 rounded-full w-fit mb-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                                className="size-6 text-white"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                />
                            </svg>
                        </div>
                        <p className="text-md font-medium text-gray-500">Nomor Bon Sementara</p>
                        <div className="text-xl font-bold">
                            {bonSementaraCount}{' '}
                            <span className="text-sm font-medium text-gray-500">Pengajuan Perlu Ditanggapi</span>
                        </div>
                    </div>

                    <div className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4 rounded-full w-fit mb-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                                className="size-6 text-white"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                                />
                            </svg>
                        </div>
                        <p className="text-md font-medium text-gray-500">LPJ Bon Sementara</p>
                        <div className="text-xl font-bold">
                            {lpjCount}{' '}
                            <span className="text-sm font-medium text-gray-500">Pengajuan Perlu Ditanggapi</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tablet View (768) */}
            <div
                className={`hidden md:flex md:flex-row md:gap-4 lg:hidden ${userRole === 'Reviewer' ? 'mb-2' : 'mb-6'}`}
            >
                <div className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 rounded-full w-fit mb-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            className="size-6 text-white"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8.25 9.75h4.875a2.625 2.625 0 0 1 0 5.25H12M8.25 9.75 10.5 7.5M8.25 9.75 10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z"
                            />
                        </svg>
                    </div>
                    <p className="text-md font-medium text-gray-500">Reimbursement</p>
                    <div className="text-xl font-bold">
                        {reimbursementCount}{' '}
                        <span className="text-sm font-medium text-gray-500">Pengajuan Perlu Ditanggapi</span>
                    </div>
                </div>

                <div className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                    <div className="bg-gradient-to-r from-teal-400 to-green-500 p-4 rounded-full w-fit mb-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            className="size-6 text-white"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                            />
                        </svg>
                    </div>
                    <p className="text-md font-medium text-gray-500">Nomor Bon Sementara</p>
                    <div className="text-xl font-bold">
                        {bonSementaraCount}{' '}
                        <span className="text-sm font-medium text-gray-500">Pengajuan Perlu Ditanggapi</span>
                    </div>
                </div>

                <div className="flex-1 bg-white p-4 rounded-lg shadow-sm">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4 rounded-full w-fit mb-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            className="size-6 text-white"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                            />
                        </svg>
                    </div>
                    <p className="text-md font-medium text-gray-500">LPJ Bon Sementara</p>
                    <div className="text-xl font-bold">
                        {lpjCount} <span className="text-sm font-medium text-gray-500">Pengajuan Perlu Ditanggapi</span>
                    </div>
                </div>
            </div>

            {/* Mobile View (below 768px) */}
            <div className={`md:hidden bg-white rounded-lg shadow-sm p-4 ${userRole === 'Reviewer' ? 'mb-2' : 'mb-6'}`}>
                <p className="text-xl font-medium mb-2">Pengajuan Perlu Ditanggapi</p>
                <div className="flex flex-col">
                    {/* Reimbursement Section */}
                    <div className="flex items-center justify-between w-full bg-white p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-5 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M8.25 9.75h4.875a2.625 2.625 0 0 1 0 5.25H12M8.25 9.75 10.5 7.5M8.25 9.75 10.5 12m9-7.243V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185Z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-md font-medium">Reimbursement</p>
                            </div>
                        </div>
                        <div className="bg-gray-100 px-3 py-1 rounded-full">
                            <span className="text-sm font-bold">{reimbursementCount}</span>
                        </div>
                    </div>

                    <hr className="border-gray-150" />

                    {/* Nomor Bon Section */}
                    <div className="flex items-center justify-between w-full bg-white p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-r from-teal-400 to-green-500 p-3 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-5 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v7.5m2.25-6.466a9.016 9.016 0 0 0-3.461-.203c-.536.072-.974.478-1.021 1.017a4.559 4.559 0 0 0-.018.402c0 .464.336.844.775.994l2.95 1.012c.44.15.775.53.775.994 0 .136-.006.27-.018.402-.047.539-.485.945-1.021 1.017a9.077 9.077 0 0 1-3.461-.203M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-md font-medium">Nomor Bon Sementara</p>
                            </div>
                        </div>
                        <div className="bg-gray-100 px-3 py-1 rounded-full">
                            <span className="text-sm font-bold">{bonSementaraCount}</span>
                        </div>
                    </div>

                    <hr className="border-gray-150" />

                    {/* LPJ Bon Sementara Section */}
                    <div className="flex items-center justify-between w-full bg-white p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-3 rounded-full">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="size-5 text-white"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-md font-medium">LPJ Bon Sementara</p>
                            </div>
                        </div>
                        <div className="bg-gray-100 px-3 py-1 rounded-full">
                            <span className="text-sm font-bold">{lpjCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReportCard
