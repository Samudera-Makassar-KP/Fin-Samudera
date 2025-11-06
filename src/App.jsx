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
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/protectedRoute';
import RbsCheckPage from './pages/RbsCheckPage';
import LpjCheckPage from './pages/LpjCheckPage';
import ManageUserPage from './pages/ManageUserPage';
import AddUserPage from './pages/AddUserPage';
import EditUserPage from './pages/EditUserPage';
import FormBsPage from './pages/BsPage';
import BsCheckPage from './pages/BsCheckPage';
import DetailBsPage from './pages/DetailBsPage';
import ReportExportPage from './pages/ReportExportPage';
import Dashboard from './pages/Dashboard';
import SessionTimeoutHandler from './components/SessionTimeoutHandler';

const AppContent = () => {
    const userRole = localStorage.getItem('userRole');

    return (
        <SessionTimeoutHandler timeoutDuration={60 * 60 * 1000}> {/* 60 menit timeout */}
            <div>
                <SidebarWrapper role={userRole} />

                <Routes>
                    {/* Login Routes */}
                    <Route path="/" element={<Login />} />

                    {/* Dashboard Routes */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute allowedRoles={['Admin', 'Reviewer', 'Validator', 'Employee']}>
                            <Dashboard />
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
                        <ProtectedRoute allowedRoles={['Reviewer', 'Validator', 'Super Admin', 'Admin']}>
                            <RbsCheckPage />
                        </ProtectedRoute>
                    } />

                    <Route path="/reimbursement/:id" element={
                        <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin', 'Super Admin']}>
                            <DetailReimbursementPage />
                        </ProtectedRoute>
                    } />

                    {/* Bon Sementara Routes */}
                    <Route path="/bon-sementara/ajukan" element={
                        <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin']}>
                            <FormBsPage />
                        </ProtectedRoute>
                    } />

                    <Route path="/bon-sementara/cek-pengajuan" element={
                        <ProtectedRoute allowedRoles={['Reviewer', 'Validator', 'Super Admin']}>
                            <BsCheckPage />
                        </ProtectedRoute>
                    } />

                    <Route path="/bon-sementara/:id" element={
                        <ProtectedRoute allowedRoles={['Employee', 'Reviewer', 'Validator', 'Admin', 'Super Admin']}>
                            <DetailBsPage />
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
                        <ProtectedRoute allowedRoles={['Reviewer', 'Validator', 'Super Admin', 'Admin']}>
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

                    <Route path="/ekspor-laporan-pengajuan" element={
                        <ProtectedRoute allowedRoles={['Super Admin']}>
                            <ReportExportPage />
                        </ProtectedRoute>
                    } />

                    {/* 404 Route */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </div>
        </SessionTimeoutHandler>
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
