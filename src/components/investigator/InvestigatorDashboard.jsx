import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { FaClipboardCheck, FaSearch, FaUser, FaBars, FaSignOutAlt } from 'react-icons/fa';
import AssignedClaims from './AssignedClaims';
import Investigation from './Investigation';
import './InvestigatorDashboard.css';
import { toast } from 'react-toastify';

const InvestigatorDashboard = () => {
    const { user, logout } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Map());

    useEffect(() => {
        // Redirect to login if not authenticated
        if (!user || user.role !== 'INVESTIGATOR') {
            navigate('/login');
            return;
        }

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
    }, [socket, user, navigate]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Logout failed');
        }
    };

    const menuItems = [
        {
            title: 'Assigned Claims',
            path: '/investigator/claims',
            icon: <FaClipboardCheck />
        },
        {
            title: 'Active Investigation',
            path: '/investigator/investigation',
            icon: <FaSearch />
        }
    ];

    const isActive = (path) => {
        return location.pathname.startsWith(path);
    };

    return (
        <div className="investigator-dashboard">
            {/* Mobile Header */}
            <header className="mobile-header">
                <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
                    <FaBars />
                </button>
                <h1>iNube Claims</h1>
                <div className="user-info">
                    <FaUser />
                </div>
            </header>

            {/* Mobile Navigation */}
            <nav className={`mobile-nav ${menuOpen ? 'open' : ''}`}>
                <div className="nav-header">
                    <div className="user-profile">
                        <FaUser className="profile-icon" />
                        <div className="user-details">
                            <span className="user-name">{user?.name || 'Investigator'}</span>
                            <span className="user-role">Investigator</span>
                        </div>
                    </div>
                </div>

                <ul className="nav-items">
                    {menuItems.map((item) => (
                        <li key={item.path}>
                            <a
                                href={item.path}
                                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    navigate(item.path);
                                    setMenuOpen(false);
                                }}
                            >
                                {item.icon}
                                <span>{item.title}</span>
                            </a>
                        </li>
                    ))}
                    <li>
                        <button onClick={handleLogout} className="nav-item logout">
                            <FaSignOutAlt />
                            <span>Logout</span>
                        </button>
                    </li>
                </ul>
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Navigate to="claims" replace />} />
                    <Route path="claims" element={<AssignedClaims />} />
                    <Route path="investigation" element={<Investigation />} />
                    <Route path="investigation/:investigationId" element={<Investigation />} />
                    <Route path="*" element={<Navigate to="claims" replace />} />
                </Routes>
            </main>
        </div>
    );
};

export default InvestigatorDashboard;
