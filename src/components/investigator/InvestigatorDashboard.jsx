import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { 
    FaClipboardCheck, 
    FaSearch, 
    FaUser, 
    FaBars, 
    FaSignOutAlt,
    FaTimes,
    FaHome,
    FaIdCard,
    FaPalette,
    FaFileAlt
} from 'react-icons/fa';
import AssignedClaims from './AssignedClaims';
import Investigation from './Investigation';
import OfflineDocs from './OfflineDocs';
import ThemeToggle from '../common/ThemeToggle';
import './InvestigatorDashboard.css';
import { toast } from 'react-toastify';

const InvestigatorDashboard = () => {
    const { user, logout } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Map());

    if (user?.role !== 'INVESTIGATOR') {
        return <Navigate to="/login" />;
    }

    useEffect(() => {
        if (socket) {
            // Listen for initial online users list
            socket.on('online_users', (users) => {
                const usersMap = new Map();
                users.forEach(user => {
                    usersMap.set(user.userId, user);
                });
                setOnlineUsers(usersMap);
            });

            // Listen for user status changes
            socket.on('user_status_change', ({ userId, isOnline, role, timestamp }) => {
                setOnlineUsers(prev => {
                    const newMap = new Map(prev);
                    newMap.set(userId, { userId, isOnline, role, timestamp });
                    return newMap;
                });
            });

            // Clean up listeners on unmount
            return () => {
                socket.off('online_users');
                socket.off('user_status_change');
            };
        }
    }, [socket]);

    // Handle body scroll lock when menu is open
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [menuOpen]);

    const isUserOnline = (userId) => {
        const user = onlineUsers.get(userId);
        return user?.isOnline || false;
    };

    const menuItems = [
        {
            title: 'Assigned Claims',
            path: '/investigator/claims',
            icon: <FaClipboardCheck />,
            badge: 0 // Will be updated with actual count
        },
        {
            title: 'Active Investigation',
            path: '/investigator/investigation',
            icon: <FaSearch />
        }
    ];

    const handleLogout = async () => {
        try {
            if (window.confirm('Are you sure you want to logout?')) {
                await logout();
                toast.success('Logged out successfully');
                navigate('/login');
            }
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Logout failed. Please try again.');
        }
    };

    const closeMenu = () => {
        setMenuOpen(false);
    };

    const isActive = (path) => {
        return location.pathname.startsWith(path);
    };

    return (
        <div className="investigator-dashboard">
            {/* Mobile Header */}
            <header className="mobile-header">
                <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
                    {menuOpen ? <FaTimes /> : <FaBars />}
                </button>
                <h1>iNube Claims</h1>
                <div className="user-info">
                    <ThemeToggle />
                    <FaUser />
                </div>
            </header>

            {/* Menu Overlay */}
            <div 
                className={`nav-overlay ${menuOpen ? 'open' : ''}`} 
                onClick={closeMenu}
            ></div>

            {/* Enhanced Mobile Navigation */}
            <nav className={`mobile-nav ${menuOpen ? 'open' : ''}`}>
                <div className="nav-header">
                    <div className="user-profile">
                        <FaUser className="profile-icon" />
                        <div className="user-details">
                            <span className="user-name">{user.name || 'Investigator User'}</span>
                            <span className="user-role">
                                <span className="user-role-badge">Investigator</span>
                                {isUserOnline(user.id) ? ' • Online' : ''}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="nav-links">
                    <div className="nav-section">
                        <h3 className="nav-section-title">Main Navigation</h3>
                        {menuItems.map((item) => (
                            <button
                                key={item.path}
                                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                onClick={() => {
                                    navigate(item.path);
                                    closeMenu();
                                }}
                            >
                                <span className="icon">{item.icon}</span>
                                <span className="title">{item.title}</span>
                                {item.badge > 0 && (
                                    <span className="badge">{item.badge}</span>
                                )}
                            </button>
                        ))}
                    </div>
                    
                    <div className="nav-section">
                        <h3 className="nav-section-title">Account</h3>
                        <button className="nav-item">
                            <span className="icon"><FaIdCard /></span>
                            <span className="title">My Profile</span>
                        </button>
                        <div className="nav-item theme-toggle-item">
                            <span className="icon"><FaPalette /></span>
                            <span className="title">Theme</span>
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                <div className="nav-footer">
                    <button className="logout-button" onClick={handleLogout}>
                        <FaSignOutAlt />
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className={`main-content ${menuOpen ? 'blur' : ''}`} onClick={() => menuOpen && closeMenu()}>
                <Routes>
                    <Route 
                        path="claims" 
                        element={
                            <AssignedClaims 
                                onlineUsers={onlineUsers} 
                                isUserOnline={isUserOnline} 
                            />
                        } 
                    />
                    <Route 
                        path="investigation/:investigationId" 
                        element={<Investigation />} 
                    />
                    <Route 
                        path="claims/:claimId/docs" 
                        element={<OfflineDocs />} 
                    />
                    <Route 
                        path="/" 
                        element={<Navigate to="claims" replace />} 
                    />
                </Routes>
            </main>

            {/* Quick Logout Button (Mobile) */}
            <button className="quick-logout" onClick={handleLogout}>
                <FaSignOutAlt />
            </button>

            {/* Mobile Bottom Navigation */}
            <nav className="bottom-nav">
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                    >
                        <span className="icon">{item.icon}</span>
                        <span className="label">{item.title}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default InvestigatorDashboard;