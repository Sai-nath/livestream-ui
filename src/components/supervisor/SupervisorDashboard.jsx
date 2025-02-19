import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ClaimManagement from './ClaimManagement';
import LiveMonitoring from './LiveMonitoring';
import { FaClipboardList, FaVideo, FaSignOutAlt, FaVideo as FaVideoLogo, FaBars, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import './SupervisorDashboard.css';

const SupervisorDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    if (!user || user.role !== 'SUPERVISOR') {
        return <Navigate to="/unauthorized" />;
    }

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="dashboard-wrapper">
            <header className="dashboard-header">
                <div className="header-left">
                    <button 
                        className="hamburger-btn"
                        onClick={toggleSidebar}
                    >
                        {isSidebarOpen ? <FaTimes /> : <FaBars />}
                    </button>
                    <div className="brand">
                        <FaVideoLogo className="brand-icon" />
                        <span className="brand-text">iNube</span>
                    </div>
                    <span className="dashboard-title">Supervisor Dashboard</span>
                </div>
                <div className="header-right">
                    <span className="welcome-text">Welcome, {user.username}</span>
                    <button className="logout-btn" onClick={logout}>
                        <FaSignOutAlt />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            <div className="dashboard-content">
                <AnimatePresence mode="wait">
                    {isSidebarOpen && (
                        <motion.aside 
                            className="sidebar"
                            initial={{ x: -250 }}
                            animate={{ x: 0 }}
                            exit={{ x: -250 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                            <nav className="sidebar-nav">
                                <button 
                                    onClick={() => navigate('/supervisor/claims')}
                                    className={`nav-item ${location.pathname.includes('/claims') ? 'active' : ''}`}
                                >
                                    <FaClipboardList />
                                    <span>Claims Management</span>
                                </button>
                                <button 
                                    onClick={() => navigate('/supervisor/monitoring')}
                                    className={`nav-item ${location.pathname.includes('/monitoring') ? 'active' : ''}`}
                                >
                                    <FaVideo />
                                    <span>Live Monitoring</span>
                                </button>
                            </nav>
                        </motion.aside>
                    )}
                </AnimatePresence>

                <main className={`main-content ${!isSidebarOpen ? 'expanded' : ''}`}>
                    <Routes>
                        <Route path="/claims" element={<ClaimManagement />} />
                        <Route path="/monitoring" element={<LiveMonitoring />} />
                        <Route path="/" element={<Navigate to="/supervisor/claims" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default SupervisorDashboard;
