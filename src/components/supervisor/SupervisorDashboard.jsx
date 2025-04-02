import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ClaimManagement from './ClaimManagement';
import ClaimSearch from './ClaimSearch';
import LiveMonitoring from './LiveMonitoring';
import { FaClipboardList, FaVideo, FaSignOutAlt, FaVideo as FaVideoLogo, FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../common/ThemeToggle';
import { toast } from 'react-toastify';
import './SupervisorDashboard.css';

const SupervisorDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    if (!user || user.role !== 'SUPERVISOR') {
        return <Navigate to="/unauthorized" />;
    }

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        
        if (!searchQuery.trim()) {
            toast.info('Please enter a claim number to search');
            return;
        }
        
        setIsSearching(true);
        
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/search?query=${searchQuery}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to search claims');
            }
            
            const data = await response.json();
            
            if (data.length === 0) {
                toast.info(`No claims found matching "${searchQuery}"`);
            } else {
                // Navigate to the claims page with the search results
                navigate('/supervisor/claims', { 
                    state: { 
                        searchResults: data,
                        searchQuery: searchQuery
                    } 
                });
                toast.success(`Found ${data.length} claim(s) matching "${searchQuery}"`);
            }
        } catch (error) {
            console.error('Error searching claims:', error);
            toast.error('Error searching claims');
        } finally {
            setIsSearching(false);
        }
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
                    <ThemeToggle />
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
                                    className={`nav-item ${location.pathname.includes('/claims') && !location.pathname.includes('/search') ? 'active' : ''}`}
                                >
                                    <FaClipboardList />
                                    <span>Claims Management</span>
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/supervisor/search')}
                                    className={`nav-item ${location.pathname.includes('/search') ? 'active' : ''}`}
                                >
                                    <FaSearch />
                                    <span>Search</span>
                                </button>
                            </nav>
                        </motion.aside>
                    )}
                </AnimatePresence>

                <main className={`main-content ${!isSidebarOpen ? 'expanded' : ''}`}>
                    <Routes>
                        <Route path="/claims" element={<ClaimManagement />} />
                        <Route path="/claims/:claimId/media/:mediaType" element={<ClaimManagement />} />
                        <Route path="/search" element={<ClaimSearch />} />
                        <Route path="/monitoring" element={<LiveMonitoring />} />
                        <Route path="/" element={<Navigate to="/supervisor/claims" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default SupervisorDashboard;
