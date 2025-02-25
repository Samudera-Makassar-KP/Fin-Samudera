import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const BsAlerts = ({ scrollToTable }) => {
  const [alerts, setAlerts] = useState({
    pending: [],
    overdue: []
  });

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const uid = localStorage.getItem('userUid');
        if (!uid) {
          console.error('UID tidak ditemukan di localStorage');
          return;
        }

        // Query approved BS documents
        const bsQuery = query(
          collection(db, 'bonSementara'),
          where('user.uid', '==', uid),
          where('status', '==', 'Disetujui')
        );

        const bsSnapshot = await getDocs(bsQuery);
        const pendingBS = [];
        const overdueBS = [];

        // Process each BS document
        for (const bsDoc of bsSnapshot.docs) {
          const bsData = bsDoc.data();
          
          // Find approval timestamp
          const approvalEntry = bsData.statusHistory?.find(
            entry => entry.status === 'Disetujui oleh Reviewer 2' || 
                     entry.status === 'Disetujui oleh Super Admin (Pengganti Reviewer 2)'
          );

          if (!approvalEntry) continue;

          // Check LPJ status
          const lpjQuery = query(
            collection(db, 'lpj'),
            where('nomorBS', '==', bsData.displayId)
          );
          const lpjSnapshot = await getDocs(lpjQuery);
          
          // Initialize LPJ status as 'Belum LPJ'
          let lpjStatus = 'Belum LPJ';
          
          if (!lpjSnapshot.empty) {
            const lpjData = lpjSnapshot.docs[0].data();
            // Only change status to 'Sedang LPJ' if LPJ exists but not approved
            if (lpjData.status === 'Disetujui') {
              continue; // Skip if LPJ is already approved
            }
            lpjStatus = 'Sedang LPJ';
          }

          // Calculate days since approval
          const approvalDate = new Date(approvalEntry.timestamp);
          const now = new Date();
          const diffTime = now - approvalDate;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          // Categorize based on days and LPJ status
          if (diffDays < 3 && (lpjStatus === 'Belum LPJ' || lpjStatus === 'Sedang LPJ')) {
            pendingBS.push({
              id: bsDoc.id,
              displayId: bsData.displayId,
              daysLeft: 3 - diffDays,
              status: lpjStatus
            });
          } 
          // If past 3 days and LPJ not approved
          else if (diffDays >= 3 && (lpjStatus === 'Belum LPJ' || lpjStatus === 'Sedang LPJ')) {
            overdueBS.push({
              id: bsDoc.id,
              displayId: bsData.displayId,
              daysPassed: diffDays,
              status: lpjStatus
            });
          }
        }

        setAlerts({
          pending: pendingBS,
          overdue: overdueBS
        });
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };

    fetchAlerts();
  }, []);

  const pendingCount = alerts.pending?.length || 0;
  const overdueCount = alerts.overdue?.length || 0;

  if (pendingCount === 0 && overdueCount === 0) return null;

  return (
    <div
      className="mb-4 p-4 bg-red-100 rounded-lg border border-red-600 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2"
      role="alert"
    >
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <p className="text-sm text-red-800">
          {pendingCount > 0 && overdueCount > 0 ? (
            <>Terdapat <span className="font-medium">{pendingCount + overdueCount} Bon Sementara</span> yang belum dipertanggungjawabkan, <span className="font-medium">{overdueCount}</span> diantaranya telah melewati batas waktu.</>
          ) : pendingCount > 0 ? (
            <>Terdapat <span className="font-medium">{pendingCount} Bon Sementara</span> yang belum dipertanggungjawabkan.</>
          ) : (
            <>Terdapat <span className="font-medium">{overdueCount} Bon Sementara</span> yang telah melewati batas waktu.</>
          )}
          {" "}Segera ajukan LPJ untuk menyelesaikannya.
        </p>
      </div>
      <button
        onClick={scrollToTable}
        className="w-full md:w-auto flex-shrink-0 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white hover:text-gray-200 rounded-md transition-colors"
      >
        Lihat Detail
      </button>
    </div>
  );
};

export default BsAlerts;