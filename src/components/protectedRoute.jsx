import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const userRole = localStorage.getItem('userRole');
    const userUid = localStorage.getItem('userUid');
    
    if (!userUid) {
        localStorage.clear();        
        return <Navigate to="/" replace />;
    }
    
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/404" replace />;
    }

    return children;
};

export default ProtectedRoute;