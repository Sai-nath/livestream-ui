import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { user, isAuthenticated, loading } = useAuth();
    const location = useLocation();
    
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }
    
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/unauthorized" replace />;
    }
    
    return children;
};

const AppContent = () => {
    const { isAuthenticated, loading, user } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={
                    isAuthenticated ? (
                        <Navigate to={`/${user?.role?.toLowerCase() || ''}`} replace />
                    ) : (
                        <LandingPage />
                    )
                } />
                <Route path="/login" element={
                    isAuthenticated ? (
                        <Navigate to={`/${user?.role?.toLowerCase() || ''}`} replace />
                    ) : (
                        <Login />
                    )
                } />
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
    );
};

function App() {
    return (
        <AuthProvider>
            <SocketProvider>
                <AppContent />
            </SocketProvider>
        </AuthProvider>
    );
}

export default App;
