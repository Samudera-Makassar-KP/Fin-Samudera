import React from 'react';

const BsTimerDisplay = ({ approvalDate, lpjStatus, lpjStatusHistory }) => {
    const [timeDisplay, setTimeDisplay] = React.useState('');
    const [isOverdue, setIsOverdue] = React.useState(false);

    React.useEffect(() => {
        const calculateTime = () => {
            const now = new Date();
            const bsApprovalDate = new Date(approvalDate);
            const deadlineDate = new Date(bsApprovalDate.getTime() + (3 * 24 * 60 * 60 * 1000));
            
            if (lpjStatus === 'Sudah LPJ') {
                // Find the LPJ approval timestamp from status history
                const lpjApprovalEntry = lpjStatusHistory?.find(entry => 
                    entry.status === 'Disetujui oleh Reviewer 2' || 
                    entry.status === 'Disetujui oleh Super Admin (Pengganti Reviewer 2)'
                );
                
                if (lpjApprovalEntry) {
                    const lpjApprovalDate = new Date(lpjApprovalEntry.timestamp);
                    // Only consider it overdue if LPJ was completed after the deadline
                    setIsOverdue(lpjApprovalDate > deadlineDate);
                    
                    // Calculate time difference between lpjApprovalDate and deadlineDate
                    const diffTime = Math.abs(lpjApprovalDate - deadlineDate);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

                    let timeString = '';
                    if (diffDays > 0) timeString += `${diffDays}h `;
                    if (diffHours > 0) timeString += `${diffHours}j `;
                    timeString += `${diffMinutes}m`;

                    setTimeDisplay(timeString);
                }
            } else {
                // For pending LPJ, compare current time with deadline
                setIsOverdue(now > deadlineDate);
                
                const diffTime = Math.abs(deadlineDate - now);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

                let timeString = '';
                if (diffDays > 0) timeString += `${diffDays}h `;
                if (diffHours > 0) timeString += `${diffHours}j `;
                timeString += `${diffMinutes}m`;

                setTimeDisplay(timeString);
            }
        };

        calculateTime();
        const timer = setInterval(calculateTime, 60000); // Update every minute

        return () => clearInterval(timer);
    }, [approvalDate, lpjStatus, lpjStatusHistory]);

    // Determine display style based on LPJ status and time
    const getDisplayStyle = () => {
        if (lpjStatus === 'Sudah LPJ') {
            return {
                bgColor: 'bg-green-50 border border-green-400',
                textColor: 'text-green-700',
                subTextColor: 'text-green-600',
                icon: (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="w-4 h-4 text-green-500"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                )
            };
        }
        if ((lpjStatus === 'Sedang LPJ' || lpjStatus === 'Belum LPJ') && isOverdue) {
            return {
                bgColor: 'bg-red-50 border border-red-400',
                textColor: 'text-red-700',
                subTextColor: 'text-red-600',
                icon: (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="w-4 h-4 text-red-500"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                )
            };
        }
        if (lpjStatus === 'Sedang LPJ') {
            return {
                bgColor: 'bg-blue-50 border border-blue-400',
                textColor: 'text-blue-700',
                subTextColor: 'text-blue-600',
                icon: (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="w-4 h-4 text-blue-500"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                        <path d="M12 6v6l4 2" />
                    </svg>
                )
            };
        }
        return {
            bgColor: 'bg-yellow-50 border border-yellow-400',
            textColor: 'text-yellow-700',
            subTextColor: 'text-yellow-600',
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="w-4 h-4 text-yellow-500"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            )
        };
    };

    const style = getDisplayStyle();

    const getTimeText = () => {
        if (lpjStatus === 'Sudah LPJ') {
            return isOverdue ? `Terlambat ${timeDisplay}` : `${timeDisplay} lebih awal`;
        }
        return isOverdue ? `Terlewat: ${timeDisplay}` : `Tersisa: ${timeDisplay}`;
    };

    return (
        <div className={`flex items-center gap-2 px-4 py-1 rounded-lg ${style.bgColor}`}>
            <div className="flex items-center gap-2">                
                <div className="flex flex-col items-center">
                    <div className={`flex items-center gap-1 text-sm font-medium ${style.textColor}`}>
                        {style.icon}
                        <span>
                            {lpjStatus}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className={`text-xs ${style.subTextColor}`}>
                            {getTimeText()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BsTimerDisplay;