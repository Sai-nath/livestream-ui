import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Components
import Login from './components/auth/Login';
import LandingPage from './components/LandingPage';
import Unauthorized from './components/Unauthorized';
import AdminDashboard from './components/admin/AdminDashboard';
import SupervisorDashboard from './components/supervisor/SupervisorDashboard';
import InvestigatorDashboard from './components/investigator/InvestigatorDashboard';
import OfficerDashboard from './components/officer/OfficerDashboard';

function App() {
    // Protected Route Component
    const ProtectedRoute = ({ children, allowedRoles = [] }) => {
        const { user, isAuthenticated, loading } = useAuth();
        
        if (loading) {
            return <div>Loading...</div>;
        }
        
        if (!isAuthenticated) {
            return <Navigate to="/login" />;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
            return <Navigate to="/unauthorized" />;
        }
        
        return children;
    };

    return (
        <AuthProvider>
            <SocketProvider>
                <div className="min-h-screen bg-gray-900">
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/unauthorized" element={<Unauthorized />} />

                        {/* Protected Routes */}
                        <Route path="/admin/*" element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        } />

                        <Route path="/supervisor/*" element={
                            <ProtectedRoute allowedRoles={['SUPERVISOR']}>
                                <SupervisorDashboard />
                            </ProtectedRoute>
                        } />

                        <Route path="/investigator/*" element={
                            <ProtectedRoute allowedRoles={['INVESTIGATOR']}>
                                <InvestigatorDashboard />
                            </ProtectedRoute>
                        } />

                        <Route path="/officer/*" element={
                            <ProtectedRoute allowedRoles={['OFFICER']}>
                                <OfficerDashboard />
                            </ProtectedRoute>
                        } />

                        {/* Catch all route */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>

                    <ToastContainer
                        position="top-right"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="dark"
                    />
                </div>
            </SocketProvider>
        </AuthProvider>
    );
}

export default App;
