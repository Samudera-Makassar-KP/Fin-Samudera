import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/LoginPage';
import SidebarWrapper from './components/sidebarWrapper';
import RbsBbm from './pages/RbsBbm';
import RbsOperasional from './pages/RbsOperasional';
import RbsUmum from './pages/RbsUmum';
import LpjUmum from './pages/LpjUmum';
import LpjMarketing from './pages/LpjMarketing';
import DetailReimbursementPage from './pages/DetailRbsPage';
import DetailLpjPage from './pages/DetailLpjPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ReviewerDashboard from './pages/ReviewerDashboard';
import ValidatorDashboard from './pages/ValidatorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/protectedRoute';
import RbsCheckPage from './pages/RbsCheckPage';
import LpjCheckPage from './pages/LpjCheckPage';
import ManageUserPage from './pages/ManageUserPage';
import AddUserPage from './pages/AddUserPage';
import EditUserPage from './pages/EditUserPage';
import CreateBon from './pages/CreateBonPage';
import CreateBsCheckPage from './pages/CreateBsCheckPage';
import DetailCreateBsPage from './pages/DetailCreateBsPage';

const AppContent = () => {
    const userRole = localStorage.getItem('userRole'); 

    return (
        <div>
            <SidebarWrapper role={userRole} />

            <Routes>
                {/* Login Routes */}
                <Route path="/" element={<Login />} />

                {/* Dashboard Routes */}
                <Route path="/dashboard/admin" element={
                    <ProtectedRoute allowedRoles={['Admin']}>
                        <AdminDashboard />
                    </ProtectedRoute>
                } />
                <Route path="/dashboard/reviewer" element={
                    <ProtectedRoute allowedRoles={['Reviewer']}>
                        <ReviewerDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/dashboard/validator" element={
                    <ProtectedRoute allowedRoles={['Validator']}>
                        <ValidatorDashboard />
                    </ProtectedRoute>
                } />

                <Route path="/dashboard/employee" element={
                    <ProtectedRoute allowedRoles={['Employee']}>
                        <EmployeeDashboard />
                    </ProtectedRoute>
                } />

                {/* Reimbursement Routes */}
                <Route path="/reimbursement/bbm" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin']}>
                        <RbsBbm />
                    </ProtectedRoute>
                } />

                <Route path="/reimbursement/operasional" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin']}>
                        <RbsOperasional />
                    </ProtectedRoute>
                } />

                <Route path="/reimbursement/umum" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin']}>
                        <RbsUmum />
                    </ProtectedRoute>
                } />

                <Route path="/reimbursement/cek-pengajuan" element={
                    <ProtectedRoute allowedRoles={['Reviewer', 'Validator', 'Super Admin']}>
                        <RbsCheckPage />
                    </ProtectedRoute>
                } />

                <Route path="/reimbursement/:id" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin', 'Super Admin']}>
                        <DetailReimbursementPage />
                    </ProtectedRoute>
                } />

                {/* Create BS Routes */}
                <Route path="/create-bs/create" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin']}>
                        <CreateBon />
                    </ProtectedRoute>
                } />

                <Route path="/create-bs/cek-pengajuan" element={
                    <ProtectedRoute allowedRoles={['Reviewer', 'Validator', 'Super Admin']}>
                        <CreateBsCheckPage />
                    </ProtectedRoute>
                } />

                <Route path="/create-bs/:id" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin', 'Super Admin']}>
                        <DetailCreateBsPage />
                    </ProtectedRoute>
                } />

                {/* LPJ BS Routes */}
                <Route path="/lpj/umum" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin']}>
                        <LpjUmum />
                    </ProtectedRoute>
                } />

                <Route path="/lpj/marketing" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin']}>
                        <LpjMarketing />
                    </ProtectedRoute>
                } />

                <Route path="/lpj/cek-pengajuan" element={
                    <ProtectedRoute allowedRoles={['Reviewer', 'Validator', 'Super Admin']}>
                        <LpjCheckPage />
                    </ProtectedRoute>
                } />

                <Route path="/lpj/:id" element={
                    <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin', 'Super Admin']}>
                        <DetailLpjPage />
                    </ProtectedRoute>
                } />

                {/* User Management Routes */}
                <Route path="/manage-users" element={
                    <ProtectedRoute allowedRoles={['Super Admin']}>
                        <ManageUserPage />
                    </ProtectedRoute>
                } />

                <Route path="/manage-users/add" element={
                    <ProtectedRoute allowedRoles={['Super Admin']}>
                        <AddUserPage />
                    </ProtectedRoute>
                } />

                <Route path="/manage-users/edit" element={
                    <ProtectedRoute allowedRoles={['Super Admin']}>
                        <EditUserPage />
                    </ProtectedRoute>
                } />

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </div>
    );
}

const App = () => {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;
